-- DON'T PRESS — authoritative visibility policies
-- Run this LAST, after every other migration. It is the single source of truth
-- for who can read posts, comments and chains.
--
-- WHY A SEPARATE FILE AT ALL
-- --------------------------
-- The read policies accumulated across eight migrations that each redefine the
-- same policies. That is how resolve_moderation_review() ended up defined twice
-- and silently reverted by whichever file ran last. Read policies are worse,
-- because a stale definition is not an error: it is a policy that still works,
-- just with the wrong rules.
--
-- This file therefore sets the final state in full rather than layering another
-- change on top. Apply order for everything else does not matter; this one goes
-- last. It is idempotent, so re-running it is safe.
--
-- ============================================================================
-- THE RULE
-- ============================================================================
-- Three things can be true of a post, a comment or a chain:
--
--   approved  it passed the check, it is in the feed
--   pending   the check held it, a moderator has not decided yet
--   rejected  a moderator said no
--
-- Who sees what:
--
--                      public feed   author   moderator
--   approved             yes         yes        yes
--   pending               no         yes        yes   <- this is the work queue
--   rejected              no         yes        NO    <- gone, including for us
--   soft-deleted          no         yes        yes   <- the Removed tab
--
-- Two decisions worth stating, because both are deliberate:
--
-- 1. A moderator cannot see rejected content. "Rejected" is meant to mean gone,
--    not "hidden from the public but still in my queue". A moderator who can
--    still read it will keep second-guessing, and it stays in their head. The
--    audit trail lives in moderation_reviews, which is a separate table and is
--    not affected by this. That is the right place to answer "did we reject
--    this?" -- not the content itself.
--
-- 2. The author still sees their own rejected content. Silently making
--    somebody's post vanish teaches them nothing and looks like data loss. They
--    see it, marked as removed, and can delete it themselves if they want.
--    If you would rather the author could not see it either, remove
--    `user_id = (SELECT auth.uid())` from the rejected branch below -- but do
--    not remove it from the approved branch, or authors lose access to their own
--    live posts.
--
-- Note the pending branch keeps moderators in. That is the whole point of a
-- queue: an undecided post has to be reviewable.

-- ============================================================================
-- stories
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read live stories" ON public.stories;

CREATE POLICY "Anyone can read live stories" ON public.stories
  FOR SELECT TO anon, authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved')
    OR user_id = (SELECT auth.uid())
    OR ((SELECT public.is_admin()) AND moderation_status <> 'rejected')
  );

-- ============================================================================
-- comments
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read live comments" ON public.comments;

CREATE POLICY "Anyone can read live comments" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved')
    OR user_id = (SELECT auth.uid())
    OR ((SELECT public.is_admin()) AND moderation_status <> 'rejected')
  );

-- ============================================================================
-- chains
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read live chains" ON public.chains;

CREATE POLICY "Anyone can read live chains" ON public.chains
  FOR SELECT TO anon, authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved')
    OR started_by_user_id = (SELECT auth.uid())
    OR ((SELECT public.is_admin()) AND moderation_status <> 'rejected')
  );

-- ============================================================================
-- resolve_moderation_review
-- ============================================================================
-- Redefined here as well, for the same reason: it exists in two other files and
-- whichever runs last wins. This is the comment-aware version.
DROP FUNCTION IF EXISTS public.resolve_moderation_review(UUID, BOOLEAN);

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
  ELSIF v_review.content_type = 'comment' THEN
    UPDATE public.comments SET moderation_status = v_status WHERE id = v_review.content_id;
  END IF;

  -- Rejecting also soft-deletes, so the post is gone from the author's profile
  -- and the Removed tab reflects reality rather than showing an approved post
  -- that is nonetheless invisible.
  IF v_status = 'rejected' AND v_review.content_type = 'story' THEN
    UPDATE public.stories
    SET deleted_at = now(), deleted_by = auth.uid()
    WHERE id = v_review.content_id AND deleted_at IS NULL;
  ELSIF v_status = 'rejected' AND v_review.content_type = 'comment' THEN
    UPDATE public.comments
    SET deleted_at = now()
    WHERE id = v_review.content_id AND deleted_at IS NULL;
  ELSIF v_status = 'rejected' AND v_review.content_type = 'chain' THEN
    UPDATE public.chains
    SET deleted_at = now(), deleted_by = auth.uid()
    WHERE id = v_review.content_id AND deleted_at IS NULL;
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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification
-- ============================================================================
-- Create a post as a moderator, hold it, then reject it, and check visibility
-- as each of the three roles. The rejected row must be visible to nobody except
-- its author.
--
--   -- author, public and moderator after a rejection
--   select
--     (select count(*) from stories where id = '<id>')                     as nobody_sees,
--     (select count(*) from stories where id = '<id>' and user_id = auth.uid()) as author_sees;
--
-- Run the public and moderator checks as the anon key and as a moderator
-- respectively. Both must be 0.
