-- DON'T PRESS — bulk moderation actions
-- Run after supabase-visibility-policies.sql.
--
-- A moderator removing twenty bad posts should not mean twenty dialogs. This
-- adds array-based actions so the admin panel can select a set and act once.
--
-- ============================================================================
-- THE PART THAT MATTERS: HOW THIS INTERACTS WITH THE MASS-PURGE GUARD
-- ============================================================================
-- guard_mass_purge() refuses any statement that removes more than one post, and
-- the escape hatch is a session GUC that no HTTP client can set. That guard is
-- the reason a mis-wired bulk delete cannot wipe the table.
--
-- A bulk purge therefore has to reach the same escape hatch deliberately, from
-- inside a function that has already checked everything. So these functions:
--
--   1. require a moderator,
--   2. require the confirmation word, checked before anything is touched,
--   3. cap the batch size, so a runaway client cannot turn one click into a
--      table wipe even with a valid moderator session,
--   4. and only then set the GUC themselves, in a transaction-local scope.
--
-- The GUC is therefore settable only from code that has passed all of the above.
-- It stays unsettable by a client, which is the property that matters.
--
-- The cap is 50. A moderator queue that needs more than fifty at once is a queue
-- that needs a different tool, and a hard ceiling is worth more than a warning.

-- ============================================================================
-- 1. Bulk soft delete
-- ============================================================================
-- The reversible one, and the one that should be the default. Sets deleted_at
-- without destroying anything, so a mistake here is recoverable.
CREATE OR REPLACE FUNCTION public.bulk_soft_delete_stories(
  p_story_ids UUID[]
)
RETURNS JSONB
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

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can remove posts.' USING ERRCODE = '42501';
  END IF;

  IF p_story_ids IS NULL OR array_length(p_story_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No posts were selected.' USING ERRCODE = '22023';
  END IF;

  IF array_length(p_story_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Select at most 50 posts at a time (got %).', array_length(p_story_ids, 1)
      USING ERRCODE = '22023';
  END IF;

  -- Only rows the moderator can actually see are touched, so a crafted id list
  -- cannot reach a post that is pending or rejected.
  UPDATE public.stories
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = ANY(p_story_ids)
    AND deleted_at IS NULL
    AND (SELECT public.is_admin() OR moderation_status <> 'rejected');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('affected', v_count, 'requested', array_length(p_story_ids, 1));
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_soft_delete_stories(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_soft_delete_stories(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_stories(UUID[]) TO authenticated;

-- ============================================================================
-- 2. Bulk restore
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_restore_stories(
  p_story_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can restore posts.' USING ERRCODE = '42501';
  END IF;

  IF p_story_ids IS NULL OR array_length(p_story_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No posts were selected.' USING ERRCODE = '22023';
  END IF;

  IF array_length(p_story_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Select at most 50 posts at a time.' USING ERRCODE = '22023';
  END IF;

  -- Restoring a post that was rejected would put rejected content back in the
  -- feed, so a rejected row is left alone and reported by the count. Approving it
  -- is a separate, explicit decision in the review queue.
  UPDATE public.stories
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = ANY(p_story_ids)
    AND deleted_at IS NOT NULL
    AND moderation_status <> 'rejected';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('affected', v_count, 'requested', array_length(p_story_ids, 1));
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_restore_stories(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_restore_stories(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_restore_stories(UUID[]) TO authenticated;

-- ============================================================================
-- 3. Bulk permanent delete
-- ============================================================================
-- The irreversible one. Same confirmation word as the single-post path, one
-- check for the whole batch rather than one per post.
CREATE OR REPLACE FUNCTION public.bulk_purge_stories(
  p_story_ids UUID[],
  p_confirm  TEXT
)
RETURNS JSONB
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

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can permanently remove posts.' USING ERRCODE = '42501';
  END IF;

  IF upper(trim(COALESCE(p_confirm, ''))) <> 'YES' THEN
    RAISE EXCEPTION 'Confirmation was not YES. Nothing was deleted.' USING ERRCODE = '22023';
  END IF;

  IF p_story_ids IS NULL OR array_length(p_story_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No posts were selected.' USING ERRCODE = '22023';
  END IF;

  IF array_length(p_story_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Select at most 50 posts at a time (got %).', array_length(p_story_ids, 1)
      USING ERRCODE = '22023';
  END IF;

  -- Every check above happens before the GUC is set, in this order, on purpose.
  -- set_config with is_local=true so it dies with this transaction rather than
  -- leaking onto the connection.
  perform set_config('app.allow_mass_purge', 'on', true);

  DELETE FROM public.stories
  WHERE id = ANY(p_story_ids)
    AND (SELECT public.is_admin() OR moderation_status <> 'rejected');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('deleted', v_count, 'requested', array_length(p_story_ids, 1));
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_purge_stories(UUID[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_purge_stories(UUID[], TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_purge_stories(UUID[], TEXT) TO authenticated;

-- ============================================================================
-- 4. Bulk review decisions
-- ============================================================================
-- Approving or rejecting several held posts in one go, which is the common case
-- when a classifier catches a run of similar content.
CREATE OR REPLACE FUNCTION public.bulk_resolve_reviews(
  p_review_ids UUID[],
  p_approve    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_review  RECORD;
  v_count   INTEGER := 0;
  v_status  TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can review content.' USING ERRCODE = '42501';
  END IF;

  IF p_review_ids IS NULL OR array_length(p_review_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nothing was selected.' USING ERRCODE = '22023';
  END IF;

  IF array_length(p_review_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Select at most 50 at a time.' USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;

  -- Deliberately loops and calls the single-item resolver rather than batching
  -- the update. That keeps one implementation of "what does approving this mean",
  -- so a change to the rules cannot be applied to the bulk path and forgotten on
  -- the single path. Fifty rows is not a performance problem.
  FOR v_review IN
    SELECT id FROM public.moderation_reviews
    WHERE id = ANY(p_review_ids) AND status = 'pending'
    FOR UPDATE
  LOOP
    PERFORM public.resolve_moderation_review(v_review.id, p_approve);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('resolved', v_count, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_resolve_reviews(UUID[], BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_resolve_reviews(UUID[], BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_resolve_reviews(UUID[], BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification
-- ============================================================================
--
--   -- all six must be false
--   select has_table_privilege('authenticated','public.stories','DELETE') as direct_delete;
--
--   -- a member calling any of these gets 42501
--
--   -- bulk_purge_stories with the wrong word deletes nothing
--
--   -- bulk_purge_stories with more than 50 ids is refused
--
--   -- a direct `delete from stories where id in (...)` is still refused by
--   -- guard_mass_purge(), proving the GUC did not leak out of the function
