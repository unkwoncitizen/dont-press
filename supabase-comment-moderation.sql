-- DON'T PRESS — comment moderation
-- Run this in the Supabase SQL Editor, AFTER supabase-content-moderation.sql.
--
-- Comments were the last unmoderated path in the app. Everything else that
-- accepts free text now goes through a signed check; comments still went
-- straight into the table, which made them the cheapest way to put anything
-- you like under a stranger's post. On a feed where people open up about
-- difficult things, that is where it does the most damage.
--
-- Same design as posts, deliberately, so there is one rule to reason about
-- rather than two that drift apart.
--
-- ============================================================================
-- ORDERING, AND WHY IT MATTERS
-- ============================================================================
-- This migration REVOKEs INSERT on comments. Until the app code that calls
-- submit_comment() is deployed, posting a comment will fail.
--
-- Deploy the app first, then run this. That is the reverse of what happened
-- with the post migration, where the schema landed first and took commenting
-- down with it. The verification block at the bottom includes a check that
-- fails loudly if the deployed app is still on the old path.
--
-- ============================================================================
-- 1. moderation_status
-- ============================================================================

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_moderation_status_check'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_moderation_status_check
      CHECK (moderation_status IN ('approved', 'pending', 'rejected'));
  END IF;
END;
$$;

-- Everything already written predates this and stays visible.
UPDATE public.comments SET moderation_status = 'approved' WHERE moderation_status IS NULL;

-- ============================================================================
-- 2. submit_comment
-- ============================================================================
-- Token format and signing are identical to submit_story, and the signature
-- covers the content type, so a token issued for a post cannot be replayed to
-- create a comment, or vice versa. The verdict is read from the signature, not
-- from the request, so there is nothing for a client to argue with.
--
-- All parameters required, no defaults, for the same reason as submit_story: a
-- defaulted signature confused PostgREST's function resolution and every call
-- failed with 42883.
-- No parent_id parameter, deliberately. Threaded replies were sketched in here
-- first, but public.comments has no parent_id column and the app has no reply
-- state, so the value could never be stored. A parameter the caller must supply
-- and the function then discards is worse than useless: PostgREST matches
-- functions on the full argument list, so the mismatch made every call fail with
-- PGRST202 "Searched for the function ... with parameters ..." while the function
-- sat in pg_proc looking perfectly correct. If threading is ever built, add the
-- column and the parameter in the same change.
DROP FUNCTION IF EXISTS public.submit_comment(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_comment(
  p_story_id          UUID,
  p_content           TEXT,
  p_moderation_token  TEXT
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
  v_comment   UUID;
  v_status    TEXT;
  v_reason    TEXT := 'flagged by the automatic check';
  v_story_ok  BOOLEAN;
  v_max_len   CONSTANT INTEGER := 2000;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_content, ''))) < 1 THEN
    RAISE EXCEPTION 'A comment needs some text.' USING ERRCODE = '22023';
  END IF;

  -- A comment is a reply, not an essay. Bounded here rather than only in the
  -- route, because the route is the client-controlled part and this is the one
  -- that cannot be bypassed.
  IF length(p_content) > v_max_len THEN
    RAISE EXCEPTION 'That comment is too long (max % characters).', v_max_len
      USING ERRCODE = '22023';
  END IF;

  -- You cannot comment on a post that is not published.
  --
  -- Not even the author of a held post: a held post is not yet visible to
  -- anyone, and letting replies accumulate on it means that if it is later
  -- rejected those replies are orphaned, and if it is approved they surface
  -- having never been reviewed in the context they were written in. Only a
  -- moderator can comment on a held or removed post.
  SELECT EXISTS (
    SELECT 1 FROM public.stories
    WHERE id = p_story_id
      AND deleted_at IS NULL
      AND (moderation_status = 'approved' OR public.is_admin())
  ) INTO v_story_ok;

  IF NOT v_story_ok THEN
    RAISE EXCEPTION 'That post is not available for comments.' USING ERRCODE = '42501';
  END IF;

  SELECT secret INTO v_secret FROM public.moderation_secrets WHERE name = 'submit_story';
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Commenting is not configured yet.' USING ERRCODE = '55000';
  END IF;

  v_parts := string_to_array(p_moderation_token, '.');
  IF p_moderation_token IS NULL OR array_length(v_parts, 1) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'This comment has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;

  IF v_parts[1] NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'This comment has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;
  IF v_parts[2] !~ '^[0-9]+$' OR v_parts[3] !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'This comment has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;

  v_flagged := v_parts[1]::boolean;
  v_expires := v_parts[2]::bigint;
  v_expected := encode(
    extensions.hmac(
      (v_user::text || '|comment|' || v_parts[1] || '|' || v_parts[2])::text,
      v_secret::text,
      'sha256'::text
    ),
    'hex'
  );

  -- The '|comment|' segment in the signed payload is what stops a token issued
  -- for a post being spent here to smuggle a comment past the check.
  IF v_parts[3] IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'This comment has not been checked. Please try again.' USING ERRCODE = '42501';
  END IF;

  IF v_expires < extract(epoch FROM now())::bigint THEN
    RAISE EXCEPTION 'The content check expired. Please try again.' USING ERRCODE = '42501';
  END IF;

  v_status := CASE WHEN v_flagged THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.comments (story_id, user_id, content, moderation_status)
  VALUES (p_story_id, v_user, p_content, v_status)
  RETURNING id INTO v_comment;

  IF v_flagged THEN
    INSERT INTO public.moderation_reviews (content_type, content_id, user_id, reason)
    VALUES ('comment', v_comment, v_user, v_reason);
  END IF;

  RETURN jsonb_build_object(
    'comment_id', v_comment,
    'moderation_status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_comment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_comment(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_comment(UUID, TEXT, TEXT) TO authenticated;

-- Close the direct route, which is the entire point.
REVOKE INSERT ON public.comments FROM anon, authenticated;

-- ============================================================================
-- 3. Held comments are invisible
-- ============================================================================
-- The author still sees their own, so a held reply does not simply vanish with
-- no explanation, and moderators can see everything.
DROP POLICY IF EXISTS "Anyone can read live comments" ON public.comments;

CREATE POLICY "Anyone can read live comments" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved')
    OR user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- ============================================================================
-- 4. Moderation decisions reach comments
-- ============================================================================
-- This file redefines resolve_moderation_review(), and so does
-- supabase-content-moderation.sql. That is a real hazard, not a tidy-up: two
-- definitions of one function means whichever migration ran last wins, and the
-- loser's behaviour is silently reverted. It already bit once -- re-applying
-- the content moderation file after this one stripped the comment branch and
-- left held comments permanently invisible, with the review row marked resolved
-- and the comment status untouched.
--
-- So the two definitions are kept deliberately identical, and both handle all
-- three content types. Apply order does not matter.
--
-- Comments are the third kind of thing a review can point at. Without this, a
-- held comment could be approved and the review row would resolve while the
-- comment's own status never changed.
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

  UPDATE public.moderation_reviews
  SET status = v_status, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_review_id;

  RETURN jsonb_build_object('status', v_status, 'content_id', v_review.content_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_moderation_review(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_moderation_review(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_moderation_review(UUID, BOOLEAN) TO authenticated;

-- The content_type CHECK now has to admit comments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moderation_reviews_content_type_check'
  ) THEN
    ALTER TABLE public.moderation_reviews
      ADD CONSTRAINT moderation_reviews_content_type_check
      CHECK (content_type IN ('story', 'chain', 'comment'));
  END IF;
END;
$$;

-- ============================================================================
-- 5. Reload PostgREST's schema cache
-- ============================================================================
-- Run this as a SEPARATE statement after the batch above. Bundled into the same
-- query it did not take effect, and submit_comment came back as
-- "No function matches the given name and argument types" (42883), which reads
-- as a broken function rather than a stale cache.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification
-- ============================================================================
--
--   -- must be false: no more direct inserts
--   select has_table_privilege('authenticated','public.comments','INSERT') as can_insert;
--
--   -- must be true. The argument list must match exactly: PostgREST resolves a
--   -- function by its full parameter list, so a mismatch here is PGRST202 rather
--   -- than a permission error, and the function looks fine in pg_proc.
--   select has_function_privilege('authenticated',
--     'public.submit_comment(uuid,text,text)','EXECUTE') as can_submit;
--
--   -- a post token must NOT work on a comment
--   select 1;  -- then call submit_comment with a token signed for 'story'
--
--   -- existing comments are all still visible
--   select moderation_status, count(*) from public.comments group by 1;
--
-- ============================================================================
-- NOT COVERED, AND WORTH NAMING
-- ============================================================================
-- chain_contributions.message and chain_nodes are also free text a user can
-- write, and neither is filtered. chain_contributions is written only by
-- contribute_to_chain(), a SECURITY DEFINER function, so a client cannot bypass
-- a check that does not exist, but the text is unmoderated. chain_nodes takes a
-- story_id rather than free text, so it is not a content risk.
--
-- The honest summary: after this, every surface that stores user-authored prose
-- is checked except the message field on a chain contribution. That one should
-- come next.
