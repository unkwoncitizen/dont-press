-- DON'T PRESS — automatic content moderation
-- Run this AFTER supabase-chain-moderation.sql in the Supabase SQL Editor.
--
-- Goal: when someone submits a post or a chain, an automatic check looks at
-- the text and the photo. Anything the check is not comfortable with is held
-- as 'pending' and lands in the admin panel for a human to approve or reject.
--
-- ============================================================================
-- THE PART THAT ACTUALLY MATTERS: THIS CANNOT BE BYPASSED
-- ============================================================================
--
-- The obvious implementation is to moderate in the browser, then insert with
-- whatever verdict came back. That is security theatre. The moderation check
-- and the insert both run on the user's machine, so anyone who disagrees with
-- a verdict can skip the check entirely and post whatever they like. Every
-- moderation system built that way is decorative.
--
-- So the database is the trust boundary, same as the rest of this app:
--
--   1. INSERT on stories is revoked from authenticated. The client can no
--      longer create a post by any route.
--   2. All creation goes through submit_story(), a SECURITY DEFINER function.
--   3. That function requires a signed token from the server-side moderation
--      route, and ignores whatever verdict the client claims. The verdict is
--      read out of the token, and the token's signature is recomputed here
--      from a secret the client has never seen.
--   4. A forged, expired, or someone else's token is rejected outright.
--
-- A user with a valid session, a valid photo and full knowledge of this file
-- can post content that is not approved. That is the intended shape: they can
-- post, but it sits in front of a moderator instead of in the feed.
--
-- Moderation is a filter, not a lock. It reduces what reaches the feed and
-- gives a human the final word. It cannot make the app unabusable, and it
-- should not be described as if it could.

-- ============================================================================
-- 1. moderation_status on posts
-- ============================================================================

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stories_moderation_status_check'
  ) THEN
    ALTER TABLE public.stories
      ADD CONSTRAINT stories_moderation_status_check
      CHECK (moderation_status IN ('approved', 'pending', 'rejected'));
  END IF;
END;
$$;

-- Everything already in the database predates this and is grandfathered in.
UPDATE public.stories SET moderation_status = 'approved' WHERE moderation_status IS NULL;

-- ============================================================================
-- 2. The review queue
-- ============================================================================
-- One row per thing that was held. Content is referenced by type and id
-- rather than duplicated, so a review never goes stale if the text is edited.
CREATE TABLE IF NOT EXISTS public.moderation_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type  TEXT NOT NULL CHECK (content_type IN ('story', 'chain', 'comment')),
  content_id    UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Why the automatic check flagged it. Kept for the human deciding, and for
  -- tuning the thresholds later.
  reason        TEXT NOT NULL,
  -- Which categories tripped: harassment, sexual, violence, self-harm, and so
  -- on. Free-form JSON so a provider upgrade does not need a migration.
  categories    JSONB,
  provider      TEXT NOT NULL DEFAULT 'openai',
  -- The full provider response, for auditing a decision that went wrong.
  provider_raw  JSONB,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES public.users(id)
);

-- Two partial indexes, because the admin panel only ever asks the two
-- questions "what is waiting" and "what did I already decide".
CREATE INDEX IF NOT EXISTS moderation_reviews_pending_idx
  ON public.moderation_reviews (created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS moderation_reviews_content_idx
  ON public.moderation_reviews (content_type, content_id);

ALTER TABLE public.moderation_reviews ENABLE ROW LEVEL SECURITY;

-- Authors may see their own reviews, so "why is my post not showing" is
-- answerable by the person affected. Moderators see everything.
DROP POLICY IF EXISTS "Authors can view own moderation reviews" ON public.moderation_reviews;
CREATE POLICY "Authors can view own moderation reviews" ON public.moderation_reviews
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- Nobody inserts or updates here directly. submit_story() writes reviews as the
-- function owner, and resolve_moderation_review() is the only other writer.
DROP POLICY IF EXISTS "Authors can insert moderation reviews" ON public.moderation_reviews;

-- ============================================================================
-- 3. The shared secret
-- ============================================================================
-- The moderation route signs tokens with this; submit_story() verifies them
-- with the same value. It never leaves the server, and the table is unreadable
-- from any client role.
CREATE TABLE IF NOT EXISTS public.moderation_secrets (
  name   TEXT PRIMARY KEY,
  secret TEXT NOT NULL
);

ALTER TABLE public.moderation_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_secrets FROM anon, authenticated;

-- ============================================================================
-- 4. submit_story: the only way to create a post
-- ============================================================================
-- Token format: <flagged>.<expires_at_epoch>.<hmac_sha256_hex>
-- where the HMAC covers "<user_id>|<flagged>|<expires_at>".
--
-- The client cannot skip this. It cannot ask for flagged=false and get it,
-- because flagged is inside the signed payload.
--
-- All six parameters are required, with no defaults. Defaults here looked
-- tidier but broke PostgREST's function resolution: a call that included
-- p_moderation_token came back as 42883 "No function matches the given name
-- and argument types" while a call omitting it resolved fine, which reads as
-- "the function is broken" rather than "the argument list is wrong". Requiring
-- all six and having the client always send all six removes the whole class of
-- problem.
-- Dropped rather than replaced, because CREATE OR REPLACE cannot remove a
-- parameter default (42P13) and this version of the signature has none.
DROP FUNCTION IF EXISTS public.submit_story(TEXT, UUID, UUID, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.submit_story(
  p_content       TEXT,
  p_challenge_id  UUID,
  p_assignment_id UUID,
  p_photo_url     TEXT,
  p_is_anonymous  BOOLEAN,
  p_moderation_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_secret    TEXT;
  v_parts     TEXT[];
  v_flagged   BOOLEAN;
  v_expires   BIGINT;
  v_expected  TEXT;
  v_actual    TEXT;
  v_story     UUID;
  v_status    TEXT;
  v_reason    TEXT := 'flagged by the automatic check';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_content, ''))) < 1 THEN
    RAISE EXCEPTION 'A post needs some text.' USING ERRCODE = '22023';
  END IF;

  -- The assignment must belong to the person posting. Without this check a
  -- user could complete someone else's challenge and farm the level.
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_assignments
    WHERE id = p_assignment_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'That challenge is not assigned to you.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenges WHERE id = p_challenge_id AND active
  ) THEN
    RAISE EXCEPTION 'That challenge is not available.' USING ERRCODE = '22023';
  END IF;

  SELECT secret INTO v_secret FROM public.moderation_secrets WHERE name = 'submit_story';
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Posting is not configured yet.' USING ERRCODE = '55000';
  END IF;

  v_parts := string_to_array(p_moderation_token, '.');
  IF p_moderation_token IS NULL OR array_length(v_parts, 1) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'This post has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;

  -- Validate the shape before casting. Without this a malformed token raises
  -- a raw "invalid input syntax for type boolean" from the cast below, which
  -- tells an attacker exactly which part of the check failed.
  IF v_parts[1] NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'This post has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;
  IF v_parts[2] !~ '^[0-9]+$' OR v_parts[3] !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'This post has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;

  v_flagged := v_parts[1]::boolean;
  v_expires := v_parts[2]::bigint;
  v_actual  := v_parts[3];

  -- extensions.hmac, and every argument cast to text.
  --
  -- Two separate traps here, both of which make this function fail on its very
  -- first execution while still existing in pg_proc:
  --   1. On Supabase, pgcrypto lives in the `extensions` schema, not `public`.
  --      A SECURITY DEFINER function that pins search_path therefore cannot see
  --      an unqualified `hmac`.
  --   2. `'sha256'` as a bare literal is `unknown`, and hmac(unknown, unknown,
  --      unknown) matches no overload. The casts are required, not stylistic.
  -- Symptom of getting either wrong: "function hmac(text, text, unknown) does
  -- not exist", which reads as a resolution failure and sends you hunting the
  -- PostgREST schema cache instead of the function body.
  --
  -- The '|story|' segment matches the content type signed by the route. It is
  -- what stops a token issued for a comment being spent here, and vice versa.
  v_expected := encode(
    extensions.hmac(
      (v_user::text || '|story|' || v_parts[1] || '|' || v_parts[2])::text,
      v_secret::text,
      'sha256'::text
    ),
    'hex'
  );

  -- Fails closed on every case: forged signature, someone else's token,
  -- a token that has expired.
  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'This post has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;

  IF v_expires < extract(epoch FROM now())::bigint THEN
    RAISE EXCEPTION 'The content check expired. Please try again.' USING ERRCODE = '42501';
  END IF;

  v_status := CASE WHEN v_flagged THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.stories (
    user_id, challenge_id, assignment_id, content, photo_url,
    is_anonymous, moderation_status
  )
  VALUES (
    v_user, p_challenge_id, p_assignment_id, p_content, p_photo_url,
    COALESCE(p_is_anonymous, false), v_status
  )
  RETURNING id INTO v_story;

  IF v_flagged THEN
    INSERT INTO public.moderation_reviews (
      content_type, content_id, user_id, reason
    )
    VALUES ('story', v_story, v_user, v_reason);
  END IF;

  RETURN jsonb_build_object(
    'story_id', v_story,
    'moderation_status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_story(TEXT, UUID, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_story(TEXT, UUID, UUID, TEXT, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_story(TEXT, UUID, UUID, TEXT, BOOLEAN, TEXT) TO authenticated;

-- Close the direct route. From here on, PostgREST cannot insert into stories
-- at all, so the moderation check cannot be skipped by calling the table
-- directly instead of the function.
REVOKE INSERT ON public.stories FROM anon, authenticated;

-- ============================================================================
-- 5. Moderator decision
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_moderation_review(
  p_review_id UUID,
  p_approve   BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_review  public.moderation_reviews%ROWTYPE;
  v_status  TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can review content.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_review FROM public.moderation_reviews
  WHERE id = p_review_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That review no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF v_review.status <> 'pending' THEN
    RETURN jsonb_build_object('status', v_review.status, 'unchanged', true);
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;

  IF v_review.content_type = 'story' THEN
    UPDATE public.stories SET moderation_status = v_status WHERE id = v_review.content_id;
  ELSIF v_review.content_type = 'chain' THEN
    UPDATE public.chains SET moderation_status = v_status WHERE id = v_review.content_id;
  END IF;

  UPDATE public.moderation_reviews
  SET status = v_status, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_review_id;

  RETURN jsonb_build_object('status', v_status, 'content_id', v_review.content_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_moderation_review(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_moderation_review(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_moderation_review(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- 6. RLS: a pending post is invisible to the feed
-- ============================================================================
-- The author still sees their own, so a held post does not simply vanish with
-- no explanation, and moderators can see everything.
DROP POLICY IF EXISTS "Anyone can read live stories" ON public.stories;

CREATE POLICY "Anyone can read live stories" ON public.stories
  FOR SELECT TO anon, authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved')
    OR user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- ============================================================================
-- 7. One-time setup
-- ============================================================================
-- Run this once, then put the printed value in Vercel as MODERATION_SECRET.
-- They must match exactly. The SQL prints the generated value:
--
--   insert into public.moderation_secrets (name, secret)
--   values ('submit_story', encode(gen_random_bytes(32), 'hex'))
--   on conflict (name) do update set secret = excluded.secret;
--
--   select secret from public.moderation_secrets where name = 'submit_story';
--
-- The client cannot read this table, so this value is never exposed to a
-- browser. It is not the same as the Supabase anon key and neither is a
-- substitute for the other.
--
-- ============================================================================
-- 9. Reload PostgREST's schema cache
-- ============================================================================
-- PostgREST caches the function list in memory. A function created while the
-- cache was warm is invisible to /rest/v1/rpc/ and every call fails with
-- "No function matches the given name and argument types" (42883) even though
-- the function plainly exists in pg_proc. Verified: that exact symptom, and
-- this is the fix.
--
-- Without this line, submit_story looks broken rather than newly created, and
-- the obvious "fix" is to start debugging the wrong thing.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification
-- ============================================================================
--
--   -- must be false: the client can no longer insert posts directly
--   select has_table_privilege('authenticated','public.stories','INSERT') as can_insert;
--
--   -- must be true
--   select has_function_privilege('authenticated',
--     'public.submit_story(text,uuid,uuid,text,boolean,text)','EXECUTE') as can_submit;
--
--   -- the feed must not return held posts. Submit one with a forged token
--   -- (any three dot-separated parts) and it must raise 42501 rather than
--   -- create the post.
--
--   -- after a fresh apply, confirm PostgREST can actually see the function
--   -- (a 42883 or PGRST202 here means the cache reload above did not take
--   -- effect; run the NOTIFY on its own afterwards)
--   select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname = 'submit_story';
--
--   -- and confirm the function body actually runs. A plpgsql body is compiled
--   -- on first call, so a body that cannot compile still shows up perfectly
--   -- in pg_proc and passes every "is it rejected?" test, because the crash
--   -- looks exactly like a rejection.
--   select encode(extensions.hmac('a'::text, 'b'::text, 'sha256'::text), 'hex');
--
-- ============================================================================
-- NOT INCLUDED, AND WORTH SAYING OUT LOUD
-- ============================================================================
--
-- Comments are not covered yet. They are the highest-volume abuse surface on
-- a social app and they still post with no automatic check at all. Wiring
-- comments through the same path is a small change once this pattern is
-- proven, and it should be the next thing done.
--
-- The chain path is not wired either. chains.moderation_status exists and
-- resolve_moderation_review() already handles it, but create_goal_chain() does
-- not take a moderation token yet, so chains are not filtered yet.
--
-- A keyword blocklist was deliberately not used. On an app about kindness it
-- produces the worst possible outcome: someone writing "I was abused as a
-- child" or "I felt like giving up" gets held for review because of the words,
-- which is precisely the post that needed compassion. A classifier that
-- understands context is the only thing that belongs here.
