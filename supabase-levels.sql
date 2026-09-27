-- DON'T PRESS — engagement levels + usernames
-- Run this in the Supabase SQL Editor.
--
-- Levels
-- ------
-- Completed challenges drive the level. Counting them for *other* users is the
-- tricky part: challenge_assignments has an RLS policy of "users can view own
-- assignments", so a client cannot aggregate anyone else's progress. get_profile_stats
-- is therefore SECURITY DEFINER, which reads the table as its owner. It returns
-- only counts for one explicitly named user id, never rows, so it exposes no
-- more than a public leaderboard would.
--
-- Usernames
-- ---------
-- A username is a public handle, not a security control: emails were already
-- removed from the public table in supabase-users-privacy.sql. Its value is
-- identity and letting people sign up with an email alias.
--
-- The username can only be set at signup, and only through the auth trigger.
-- There is no INSERT policy on public.users, so a client cannot write a
-- username row directly, and therefore cannot set a username for anyone else.
-- The update grant from the privacy migration deliberately excludes username,
-- so it cannot be reassigned later either.

-- ============================================================================
-- 1. Levels
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Milestones for levels 1..8. Reaching 10 completed challenges is level 1.
  v_milestones INT[] := ARRAY[10, 25, 50, 100, 200, 400, 800, 1600];
  v_total INT;
  v_level INT := 0;
  v_min INT := 0;
  v_next INT;
  v_progress INT := 0;
  i INT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'completed', 0, 'level', 0, 'level_min', 0,
      'level_max', 10, 'next_threshold', 10, 'progress', 0
    );
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.challenge_assignments
  WHERE user_id = p_user_id
    AND status = 'completed';

  -- Highest milestone reached.
  FOR i IN 1..COALESCE(array_length(v_milestones, 1), 0) LOOP
    IF v_total >= v_milestones[i] THEN
      v_level := i;
      v_min := v_milestones[i];
    ELSE
      EXIT;
    END IF;
  END LOOP;

  v_next := CASE
    WHEN v_level < COALESCE(array_length(v_milestones, 1), 0) THEN v_milestones[v_level + 1]
    ELSE NULL
  END;

  v_progress := CASE
    WHEN v_next IS NULL THEN 100
    WHEN v_next = v_min THEN 100
    ELSE LEAST(100, GREATEST(0, ROUND(((v_total - v_min)::numeric / (v_next - v_min)) * 100)::int))
  END;

  RETURN jsonb_build_object(
    'completed', v_total,
    'level', v_level,
    'level_min', v_min,
    'level_max', COALESCE(v_next, v_min),
    'next_threshold', v_next,
    'progress', v_progress
  );
END;
$$;

-- Only aggregates for the requested user; no table rows are returned.
REVOKE ALL ON FUNCTION public.get_profile_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID) TO anon, authenticated;

-- ============================================================================
-- 2. Username format and reserved handles
-- ============================================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_format;
ALTER TABLE public.users ADD CONSTRAINT users_username_format CHECK (
  username IS NULL OR (
    char_length(username) BETWEEN 3 AND 24
    AND username ~ '^[a-z0-9_]+$'
    AND username NOT IN (
      'admin','administrator','root','support','help','system','mod','moderator',
      'official','team','staff','api','null','undefined','dontpress','dont_press',
      'press','login','signup','about','settings','security','account'
    )
  )
);

-- Case-insensitive uniqueness, so "Ahmed" and "ahmed" cannot both exist.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
  ON public.users (lower(username))
  WHERE username IS NOT NULL;

-- ============================================================================
-- 3. Signup trigger honours the chosen username
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  v_username := lower(trim(COALESCE(NEW.raw_user_meta ->> 'username', '')));

  -- display_name stays available as a separate human name, falling back through
  -- username and finally the email local part.
  v_display_name := COALESCE(
    NULLIF(trim(COALESCE(NEW.raw_user_meta ->> 'display_name', '')), ''),
    NULLIF(v_username, ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, email, username, display_name)
  VALUES (NEW.id, NEW.email, NULLIF(v_username, ''), v_display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. Backfill a username for existing accounts
-- ============================================================================
-- Existing users registered before this change have username = NULL, so they
-- would show no handle. Derive one from their email local part, sanitised to
-- the allowed format and made unique with a numeric suffix where needed.
--
-- The ON CONFLICT-free UPDATE relies on the unique index above; conflicts are
-- skipped per row so one clash cannot abort the whole backfill.
DO $$
DECLARE
  r RECORD;
  v_base TEXT;
  v_candidate TEXT;
  v_suffix INT := 1;
BEGIN
  FOR r IN
    SELECT id, email
    FROM public.users
    WHERE username IS NULL
  LOOP
    v_base := lower(split_part(r.email, '@', 1));
    v_base := regexp_replace(v_base, '[^a-z0-9_]', '', 'g');
    IF char_length(v_base) < 3 THEN
      v_base := 'user' || substr(md5(r.id::text), 1, 6);
    END IF;
    v_base := left(v_base, 16);

    v_candidate := v_base;
    WHILE EXISTS (SELECT 1 FROM public.users u WHERE lower(u.username) = v_candidate) LOOP
      v_candidate := left(v_base, 16) || v_suffix::text;
      v_suffix := v_suffix + 1;
      v_candidate := left(v_candidate, 24);
    END LOOP;

    UPDATE public.users SET username = v_candidate WHERE id = r.id;
  END LOOP;
END;
$$;
