-- DON'T PRESS — chain moderation
-- Run this in the Supabase SQL Editor.
--
-- Chains had no moderation at all. They had no deleted_at column, no update
-- policy and no delete policy, so an admin could neither hide a chain nor
-- bring one back. This adds the same soft-delete control that posts already
-- have, plus the moderation_status column that the automatic content filter
-- in supabase-content-moderation.sql depends on.
--
-- Soft delete only, deliberately. Chains are collaborative and a public URL
-- may already have been shared, so removal hides a chain from the app without
-- destroying the contributions attached to it. There is no purge path for
-- chains at all.

-- ============================================================================
-- 1. Columns
-- ============================================================================

ALTER TABLE public.chains ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;
ALTER TABLE public.chains ADD COLUMN IF NOT EXISTS deleted_by    UUID REFERENCES public.users(id);
ALTER TABLE public.chains ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

-- Existing rows are grandfathered as approved so nothing disappears on deploy.
UPDATE public.chains SET moderation_status = 'approved' WHERE moderation_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chains_moderation_status_check'
  ) THEN
    ALTER TABLE public.chains
      ADD CONSTRAINT chains_moderation_status_check
      CHECK (moderation_status IN ('approved', 'pending', 'rejected'));
  END IF;
END;
$$;

-- Discover and "my chains" both order by this, and the public list filters on
-- it, so an index keeps the feed cheap as chains accumulate.
CREATE INDEX IF NOT EXISTS chains_live_idx
  ON public.chains (started_at DESC)
  WHERE deleted_at IS NULL AND moderation_status = 'approved';

-- ============================================================================
-- 2. Policies
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view chains"      ON public.chains;
DROP POLICY IF EXISTS "Users can create chains"     ON public.chains;
DROP POLICY IF EXISTS "Moderators can update chains" ON public.chains;
DROP POLICY IF EXISTS "Moderators can delete chains" ON public.chains;

-- A removed or unreviewed chain is hidden from everyone except the person who
-- started it and moderators. The author still sees their own chain so that
-- "awaiting review" is not a silent disappearance.
--
-- moderation_status is included here even though nothing writes it yet: the
-- automatic filter in supabase-content-moderation.sql sets it, and having it
-- enforced in the same policy means that file needs no policy changes.
CREATE POLICY "Anyone can read live chains" ON public.chains
  FOR SELECT TO anon, authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved')
    OR started_by_user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Users can create chains" ON public.chains
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = started_by_user_id);

-- Soft delete and moderation decisions are moderator-only, and that is the only
-- way to change them. Members have no UPDATE policy on chains at all, so they
-- cannot un-hide a chain a moderator removed, which is exactly the hole that
-- existed on posts until supabase-rls-consolidation.sql closed it.
CREATE POLICY "Moderators can update chains" ON public.chains
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Intentionally no DELETE policy. A chain is never destroyed, only hidden.

-- ============================================================================
-- 3. A moderator cannot remove a chain that still has contributions
-- ============================================================================
-- Not enforced: this is a guard rail, not a rule. Removing a chain with
-- history is legitimate, but it is worth the moderator seeing the count first,
-- so the admin panel surfaces it rather than silently hiding the chain.
-- Nothing to do here; the note is so the absence is not read as an oversight.

-- ============================================================================
-- 4. Verification
-- ============================================================================
--
-- These should now return one row each:
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema='public' and table_name='chains'
--     and column_name in ('deleted_at','deleted_by','moderation_status');
--
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='chains' order by cmd;
--     -- expect: Anyone can read live chains (SELECT)
--     --          Users can create chains (INSERT)
--     --          Moderators can update chains (UPDATE)
--     --          and no DELETE row at all
--
-- Moderators can still change a chain through contribute_to_chain(), which is
-- SECURITY DEFINER and writes current_amount directly.
--
-- ---------------------------------------------------------------------------
-- The admin panel's new Chains tab needs this migration applied first, or the
-- tab renders empty.
-- ---------------------------------------------------------------------------
