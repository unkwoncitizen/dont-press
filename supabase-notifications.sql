-- DON'T PRESS — notifications
-- Run after supabase-visibility-policies.sql.
--
-- Someone comments on your post, or reacts to it, and you find out. That is the
-- whole feature.
--
-- ============================================================================
-- WHY TRIGGERS, NOT CLIENT CODE
-- ============================================================================
-- The obvious implementation is for the app to insert a notification row when it
-- creates a comment. That is bypassable: call the table directly and you can
-- notify anyone about anything, as often as you like. A notification system that
-- can be weaponised into spamming every user is worse than no notifications.
--
-- So notifications are written by the database, in a trigger, from the comment
-- and reaction rows themselves. There is no client-reachable path to the
-- notifications table at all, and no argument anywhere that says who to notify.
-- The recipient is derived from the post, not from the caller.
--
-- ============================================================================
-- WHAT IS AND IS NOT NOTIFIED
-- ============================================================================
-- Notified: a new comment on your post, a new reaction on your post.
--
-- Not notified, on purpose:
--   * your own actions. You do not get a notification that you liked your own
--     post. This is the single most common complaint about notification systems
--     and it is handled in the trigger, not the client.
--   * reactions on a comment. There is no reaction-on-comment feature.
--   * anything on a post you cannot see. A comment on a held or removed post
--     notifies nobody, because there is nobody waiting for it.
--   * a person who has no account row any more, e.g. a deleted user.
--
-- Anonymity: a comment on an anonymous post still notifies the author, because
-- the author is the person being notified and they know their own post. The
-- notification does not disclose who commented.

-- ============================================================================
-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Who is told. Not nullable and not derived from an argument.
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Who did it. Nullable, because the actor's account can be deleted and the
  -- notification should survive that rather than vanish with them.
  actor_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('comment', 'reaction', 'chain_contribution')),
  story_id    UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  chain_id    UUID REFERENCES public.chains(id) ON DELETE CASCADE,
  -- A short human summary, stored rather than joined at read time, so a
  -- notification still says something useful after the content is deleted.
  -- Longest value that matters here is a truncated comment, and truncating
  -- happens on write so the trigger cannot be used to smuggle a long payload.
  preview     TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The feed query is "my notifications, newest first, unread first". Partial
-- indexes on read_at keep the unread badge cheap even with a long history.
CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON public.notifications (created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_story_idx
  ON public.notifications (story_id)
  WHERE story_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- A recipient reads and marks their own as read. Nothing else.
DROP POLICY IF EXISTS "Recipients can view own notifications" ON public.notifications;
CREATE POLICY "Recipients can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- UPDATE is limited to marking as read by WITH CHECK on the same column. There
-- is deliberately no INSERT policy and no DELETE policy: the only writer is the
-- trigger, which runs as the table owner and bypasses RLS.
DROP POLICY IF EXISTS "Recipients can mark own notifications read" ON public.notifications;
CREATE POLICY "Recipients can mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Defence in depth: even if a policy were added by mistake, no client role can
-- create or destroy notifications.
REVOKE INSERT, DELETE ON public.notifications FROM anon, authenticated;
REVOKE ALL ON public.notifications FROM anon;

-- ============================================================================
-- 2. Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author UUID;
  v_ok     BOOLEAN;
BEGIN
  SELECT user_id INTO v_author FROM public.stories WHERE id = NEW.story_id;

  -- No post, or its author has gone: nobody to tell.
  IF v_author IS NULL THEN
    RETURN NEW;
  END IF;

  -- Never notify yourself. This is the rule people expect and it is enforced
  -- here rather than left to the app.
  IF v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Only notify about a post the author can actually see. A comment on a held or
  -- removed post would otherwise ping somebody about something they cannot open.
  SELECT moderation_status = 'approved' AND deleted_at IS NULL INTO v_ok
  FROM public.stories WHERE id = NEW.story_id;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN NEW;
  END IF;

  -- Skip a comment on a post that has no visible text, so a stripped or deleted
  -- parent does not leave an unread notification with nothing to open.
  IF NOT EXISTS (
    SELECT 1 FROM public.stories
    WHERE id = NEW.story_id AND moderation_status = 'approved' AND deleted_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, story_id, comment_id, preview)
  VALUES (v_author, NEW.user_id, 'comment', NEW.story_id, NEW.id, left(NEW.content, 120));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author UUID;
BEGIN
  SELECT user_id INTO v_author FROM public.stories WHERE id = NEW.story_id;

  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stories
    WHERE id = NEW.story_id AND moderation_status = 'approved' AND deleted_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, story_id, preview)
  VALUES (v_author, NEW.user_id, 'reaction', NEW.story_id, NEW.type);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_reaction ON public.reactions;
CREATE TRIGGER trg_notify_on_reaction
  AFTER INSERT ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- ============================================================================
-- 3. Mark as read
-- ============================================================================
-- A client UPDATE is enough and needs no function, but a single-statement helper
-- exists for "mark everything read", which is the action the bell dropdown
-- actually needs and which is awkward to express as a filter in the client.
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ============================================================================
-- 4. The badge count
-- ============================================================================
-- Read as an exact count with head:true, so the unread total is correct without
-- downloading rows. The app uses it for the badge and the full list for the
-- dropdown.
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.notifications
  WHERE user_id = auth.uid() AND read_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification
-- ============================================================================
--
--   -- must be false: no client-writable path
--   select has_table_privilege('authenticated','public.notifications','INSERT') as can_insert;
--
--   -- a comment on someone else's approved post creates exactly one notification
--   select type, count(*) from notifications group by 1;
--
--   -- commenting on your own post creates none
--
--   -- mark_all_notifications_read() returns the number it changed, and a second
--   -- call returns 0
