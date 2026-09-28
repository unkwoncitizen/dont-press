-- DON'T PRESS — purge hardening
-- Run this in the Supabase SQL Editor.
--
-- Context: every story row is currently gone (2026-09-28) and it could not be
-- recovered -- PITR was off, there were no backups, and reading dead tuples
-- needs superuser. The cause was never pinned down. Since the mechanism is
-- ambiguous, this removes the whole class of accident rather than one guessed
-- cause: three independent gates in front of an irreversible delete.
--
-- Previously the admin panel's purge was a single button behind
-- window.confirm(), calling DELETE straight through PostgREST against a
-- permissive RLS policy. One mis-click, or one mis-wired call, and posts were
-- gone with no way back. Soft delete exists precisely so that removal stays
-- reversible; purge is the one door that breaks that.
--
-- ============================================================================
-- GATE 1 — purge is a function, not a table privilege
-- ============================================================================
-- The DELETE policy on stories is removed, so PostgREST can no longer delete
-- from stories at all. The only way to hard-delete is purge_story(), which
-- re-checks the moderator role itself and refuses unless the caller passes the
-- exact post id as the confirmation. A blank string, a null, or a stale id all
-- fail closed.
--
-- derive the acting user from auth.uid() rather than an argument, so a
-- moderator cannot purge as someone else, and there is no argument that
-- selects which rows to touch.
CREATE OR REPLACE FUNCTION public.purge_story(
  p_story_id UUID,
  p_confirm  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only moderators can permanently remove a post.'
      USING ERRCODE = '42501';
  END IF;

  -- Deliberately awkward on purpose. The caller has to have the id in front of
  -- them, which is exactly the state a mis-click is not in.
  IF p_confirm IS DISTINCT FROM p_story_id::text THEN
    RAISE EXCEPTION
      'Confirmation did not match the post id. Nothing was deleted. A post id looks like 00000000-0000-0000-0000-000000000000.'
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.stories WHERE id = p_story_id) INTO v_deleted;

  IF NOT v_deleted THEN
    RAISE EXCEPTION 'That post no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.stories WHERE id = p_story_id;

  RETURN jsonb_build_object('status', 'purged', 'story_id', p_story_id);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_story(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_story(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_story(UUID, TEXT) TO authenticated;

-- Close the direct path. Without this, any client holding a moderator token
-- could still issue DELETE against stories and bypass purge_story() entirely.
DROP POLICY IF EXISTS "Moderators can delete stories" ON public.stories;

-- ============================================================================
-- GATE 2 — refuse to delete more than one post per statement
-- ============================================================================
-- Catches the shape of mistake that is most damaging: a DELETE with a missing
-- or wrong filter, wiping many rows at once. Firing AFTER the delete is fine
-- because raising here aborts the whole statement, so nothing is committed.
--
-- The escape hatch is a transaction-local GUC, which no HTTP client can set --
-- PostgREST exposes no way to call set_config. Deliberate maintenance from the
-- SQL editor has to ask for it out loud:
--
--   begin;
--   select set_config('app.allow_mass_purge', 'on', true);
--   delete from public.stories where ...;
--   commit;
CREATE OR REPLACE FUNCTION public.guard_mass_purge()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM deleted_rows;

  IF v_count > 1
     AND coalesce(current_setting('app.allow_mass_purge', true), 'off') IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Refusing to delete ' || v_count::text
        || ' posts in a single statement. Purge one at a time. For a deliberate'
        || ' bulk delete, first run: select set_config(''app.allow_mass_purge'', ''on'', true);';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mass_purge ON public.stories;
CREATE TRIGGER trg_guard_mass_purge
  AFTER DELETE ON public.stories
  REFERENCING OLD TABLE AS deleted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.guard_mass_purge();

-- ============================================================================
-- GATE 3 — the UI requires a typed confirmation
-- ============================================================================
-- In app/app/admin/page.tsx. The purge button stays disabled until the
-- moderator types the post id. Three independent gates means any one of them
-- failing is enough to stop an accident.
--
-- ============================================================================
-- WHAT THIS DOES NOT DO
-- ============================================================================
-- A moderator who genuinely wants to destroy posts can still do it, by
-- calling purge_story() once per post with the correct id, or by using the
-- documented GUC from the SQL editor. That is deliberate. The aim is to make
-- destruction impossible by accident, not to lock a human out of a database
-- they administer. Soft delete plus restore remains the normal path, and it is
-- fully reversible.
--
-- ---------------------------------------------------------------------------
-- Still worth doing, which this migration cannot do for you:
--   Turn on point-in-time recovery in the Supabase dashboard. It reads
--   pitr_enabled: false on this project, and that is the reason today's loss
--   is permanent. It cannot be enabled through the API.
-- ---------------------------------------------------------------------------
--
-- Verification after running:
--
--   -- must be gone, so PostgREST cannot delete posts directly
--   select policyname from pg_policies
--   where schemaname='public' and tablename='stories' and cmd='DELETE';
--
--   -- must be true
--   select has_function_privilege('authenticated','public.purge_story(uuid,text)','EXECUTE') as ok;
--
--   -- purge_story('some-uuid', 'wrong') must raise 22023
--   -- purge_story('some-uuid', 'some-uuid') as a moderator must delete exactly one row
--   -- a bare `delete from public.stories;` must now raise 42501
