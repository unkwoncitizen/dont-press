-- DON'T PRESS — post reporting
-- Run this in the Supabase SQL Editor.
--
-- Reporting is intentionally NOT auto-hiding. A report is a signal for a human,
-- not a verdict: on a small app an auto-hide threshold is trivially abused by a
-- group of accounts, and it would let people bury a post they simply dislike.
-- Moderators decide what gets removed, and removal reuses the soft delete
-- already in place.
--
-- A reporter cannot report their own post, enforced here rather than in the UI,
-- and one account can only report a given post once (UNIQUE below), so a single
-- user cannot inflate the count.

-- ============================================================================
-- 1. Reports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.story_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam', 'abuse', 'misinformation', 'inappropriate', 'other'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(id),
  -- One report per person per post. ON CONFLICT in the client turns a repeat
  -- report into a friendly "already reported" instead of an error.
  UNIQUE (story_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS story_reports_story_idx ON public.story_reports (story_id);
CREATE INDEX IF NOT EXISTS story_reports_status_idx ON public.story_reports (status);

ALTER TABLE public.story_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Policies
-- ============================================================================

-- You can see your own reports; moderators see everything.
DROP POLICY IF EXISTS "Reporters can view own reports" ON public.story_reports;
CREATE POLICY "Reporters can view own reports" ON public.story_reports
  FOR SELECT USING (reporter_id = auth.uid() OR public.is_admin());

-- SECURITY DEFINER helper so the "not your own post" check can read the story
-- even once it is soft deleted (the non-deleted SELECT policy would hide it and
-- make an already-removed post unreportable, and would recurse through RLS).
CREATE OR REPLACE FUNCTION public.reportable_story(p_story_id UUID, p_reporter_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stories
    WHERE id = p_story_id
      AND user_id <> p_reporter_id
      AND deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.reportable_story(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reportable_story(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can report others posts" ON public.story_reports;
CREATE POLICY "Users can report others posts" ON public.story_reports
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'open'
    AND public.reportable_story(story_id, reporter_id)
  );

-- Only a moderator may resolve a report. A reporter cannot dismiss their own.
DROP POLICY IF EXISTS "Admins can update reports" ON public.story_reports;
CREATE POLICY "Admins can update reports" ON public.story_reports
  FOR UPDATE USING (public.is_admin());

-- Reporters may withdraw their own report, which is why a post that turns out
-- to be fine does not stay permanently flagged.
DROP POLICY IF EXISTS "Reporters can delete own reports" ON public.story_reports;
CREATE POLICY "Reporters can delete own reports" ON public.story_reports
  FOR DELETE USING (reporter_id = auth.uid() OR public.is_admin());

-- Supabase's default privileges grant ALL on new tables to anon and
-- authenticated, so the grants above are not additive: anon would otherwise
-- hold INSERT/UPDATE/DELETE on the reports table. RLS already rejects anon
-- (auth.uid() is null, so the INSERT policy fails), but the grant should not
-- exist at all. Revoke first, then grant only what each role actually needs.
REVOKE ALL ON public.story_reports FROM anon;
REVOKE ALL ON public.story_reports FROM authenticated;

GRANT SELECT ON public.story_reports TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_reports TO authenticated;
