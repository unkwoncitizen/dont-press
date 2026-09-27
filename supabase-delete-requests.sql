-- DON'T PRESS — author delete requests, and the soft-delete visibility fix
-- Run this in the Supabase SQL Editor.
--
-- Why this file exists
-- --------------------
-- Soft delete introduced a bug in both directions:
--
--   1. A member deleting their own post failed with 403. Updating any other
--      column worked, but setting deleted_at did not. The story SELECT policy
--      was "deleted_at IS NULL" (plus is_admin()), so the moment a row was
--      soft deleted the author could no longer read it, and PostgREST must read
--      the row back to answer a PATCH. Moderators never hit this because
--      is_admin() kept the row visible to them.
--   2. A deleted post vanished from the feed, then reappeared after a refresh,
--      for exactly the same reason: admins can read all stories, so the feed
--      refetch handed the deleted row straight back.
--
-- Fix: let an author read their own story regardless of deleted_at, and make
-- every normal app query filter deleted_at explicitly. RLS stays the
-- backstop; the app-level filter is what keeps deleted posts out of the feed
-- for privileged users too.
--
-- Deletion is now a REQUEST for members, immediate for moderators. A member
-- cannot remove their own post unilaterally any more, so a mistake or a
-- malicious "delete then repost" is reviewed first.

-- ============================================================================
-- 1. Authors can read their own story, deleted or not
-- ============================================================================

DROP POLICY IF EXISTS "Authors can view own stories" ON public.stories;
CREATE POLICY "Authors can view own stories" ON public.stories
  FOR SELECT USING (auth.uid() = user_id);

-- Same for comments, so a member can still see a comment thread on a post
-- they have removed.
DROP POLICY IF EXISTS "Authors can view own comments" ON public.comments;
CREATE POLICY "Authors can view own comments" ON public.comments
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Deletion requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.story_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(id)
);

-- One live request per person per post. Partial, so a member can delete,
-- re-request after a rejection, and still only have one pending at a time.
CREATE UNIQUE INDEX IF NOT EXISTS story_deletion_requests_pending_key
  ON public.story_deletion_requests (story_id, requester_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS story_deletion_requests_status_idx
  ON public.story_deletion_requests (status, created_at DESC);

ALTER TABLE public.story_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters can view own deletion requests" ON public.story_deletion_requests;
CREATE POLICY "Requesters can view own deletion requests" ON public.story_deletion_requests
  FOR SELECT USING (requester_id = auth.uid() OR public.is_admin());

-- No INSERT policy and no INSERT grant: the only way in is the function below,
-- which validates ownership. Same reasoning as chain_contributions.

REVOKE ALL ON public.story_deletion_requests FROM anon;
REVOKE ALL ON public.story_deletion_requests FROM authenticated;
GRANT SELECT ON public.story_deletion_requests TO authenticated;

-- ============================================================================
-- 3. Member asks to delete their own post
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_story_deletion(
  p_story_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_story public.stories%ROWTYPE;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_story FROM public.stories WHERE id = p_story_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That post no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF v_story.user_id <> v_user_id THEN
    RAISE EXCEPTION 'You can only request deletion of your own posts.'
      USING ERRCODE = '42501';
  END IF;

  IF v_story.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_removed', 'story_id', p_story_id);
  END IF;

  SELECT id INTO v_existing FROM public.story_deletion_requests
  WHERE story_id = p_story_id AND requester_id = v_user_id AND status = 'pending';

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_pending', 'story_id', p_story_id);
  END IF;

  INSERT INTO public.story_deletion_requests (story_id, requester_id, reason)
  VALUES (p_story_id, v_user_id, NULLIF(trim(COALESCE(p_reason, '')), ''));

  RETURN jsonb_build_object('status', 'pending', 'story_id', p_story_id);
END;
$$;

-- ============================================================================
-- 4. Moderator approves or rejects
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_deletion_request(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.story_deletion_requests%ROWTYPE;
  v_result TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can resolve deletion requests.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.story_deletion_requests
  WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That request no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('status', v_req.status, 'unchanged', true);
  END IF;

  IF p_approve THEN
    UPDATE public.stories
    SET deleted_at = NOW(), deleted_by = v_req.requester_id
    WHERE id = v_req.story_id AND deleted_at IS NULL;
    v_result := 'approved';
  ELSE
    v_result := 'rejected';
  END IF;

  UPDATE public.story_deletion_requests
  SET status = v_result,
      resolved_at = NOW(),
      resolved_by = auth.uid()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('status', v_result, 'story_id', v_req.story_id);
END;
$$;

-- ============================================================================
-- 5. Requester withdraws
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_deletion_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.story_deletion_requests
  SET status = 'cancelled', resolved_at = NOW()
  WHERE id = p_request_id
    AND requester_id = v_user_id
    AND status = 'pending'
  RETURNING status INTO v_status;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object('status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.request_story_deletion(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_deletion_request(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_deletion_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_story_deletion(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_deletion_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_deletion_request(UUID) TO authenticated;

-- ============================================================================
-- 6. Grant the comment SELECT policy an owner scope
-- ============================================================================
-- The admin panel reports comment counts. Comments now carry deleted_at, so
-- count only the visible ones rather than every row ever written.
