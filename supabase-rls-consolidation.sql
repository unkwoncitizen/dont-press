-- DON'T PRESS — RLS consolidation, security fixes and init-plan performance
-- Run this in the Supabase SQL Editor.
--
-- This came out of triaging the Supabase advisor's two PERFORMANCE warnings
-- (auth_rls_initplan, multiple_permissive_policies). Chasing them turned up
-- four real security bugs, which are fixed first because they matter more
-- than the warnings did.
--
-- ============================================================================
-- FOUR REAL BUGS FOUND WHILE AUDITING (these are the reason to run this)
-- ============================================================================
--
-- 1. A member could HARD DELETE their own post.
--    "Users can delete own stories" was USING (auth.uid() = user_id) with no
--    reference to deleted_at, so DELETE removed the row outright. That skipped
--    the moderation request flow entirely and cascade-deleted the comments and
--    reactions attached to the post. The app never offers this, but the
--    database allowed it, so the UI was the only thing enforcing the rule.
--    Fixed: only moderators may hard DELETE a story.
--
-- 2. A member could set deleted_at on their own post directly.
--    The app routes members through request_story_deletion() and hides the
--    delete button for non-moderators, but a PATCH straight to PostgREST
--    bypassed that completely. Moderation was advisory, not enforced.
--
-- 3. Worse: a member could set deleted_at back to NULL on their own post.
--    So a moderator soft-deletes a post, and its author un-deletes it. The
--    reverse of bug 2, and the more serious of the two.
--    Bugs 2 and 3 are fixed with a BEFORE UPDATE trigger, because a WITH CHECK
--    clause cannot express "this column must not change" -- it only sees the
--    new row, not the old one. The trigger compares both.
--
-- 4. No member could update their own profile at all.
--    The email-privacy migration did REVOKE ALL ON public.users followed by a
--    column-level GRANT for SELECT only. That also removed UPDATE, so the
--    "Users can update own profile" policy became unreachable and every
--    profile edit returned 403. No screen exposes this yet, which is why it
--    went unnoticed. Fixed with a column-level UPDATE grant limited to the
--    fields a profile may legitimately change.
--
-- ============================================================================
-- THE TWO WARNINGS
-- ============================================================================
--
-- auth_rls_initplan (27 policies) -- FIXED, and worth doing.
-- Every policy called auth.uid() or is_admin() unqualified, so PostgreSQL
-- re-evaluated it once per row. Wrapping the call in (select ...) lets the
-- planner evaluate it a single time as an InitPlan. This is Supabase's own
-- documented remedy and it changes no results, only how they are computed.
--
-- multiple_permissive_policies -- FIXED as a side effect of the rewrite below.
-- The warnings were mostly noise: with two stories in the table there is no
-- measurable cost, and the rule fires for internal roles such as
-- authenticator and dashboard_user. The reason it appeared at all is that
-- every policy had been created TO public, so all of those roles nominally
-- matched. Scoping each policy to the roles that actually need it
-- (anon for public reads, authenticated for everything else) both removes the
-- warnings and adds a real second barrier: anon holds INSERT/UPDATE/DELETE
-- grants on nine tables and was being stopped only by policy predicates. It
-- now has no write policy on any of them.
--
-- Where a table had several permissive policies for one action, they are
-- merged into a single policy with OR. Permissive policies are OR'd together
-- by PostgreSQL, so the merged form allows exactly the same rows.

-- ============================================================================
-- 1. SECURITY FIXES
-- ============================================================================

-- 1a. Only a moderator may change a post's deletion state, from any path.
--
-- current_user is postgres for the table owner (SQL editor, service-side
-- maintenance) and for SECURITY DEFINER functions, which is how
-- resolve_deletion_request() still works. It is 'authenticated' for anything
-- arriving through PostgREST, so a client cannot reach that branch.
--
-- Intentionally NOT SECURITY DEFINER: current_user has to stay the real
-- acting role for this check to mean anything.
CREATE OR REPLACE FUNCTION public.guard_story_moderation_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.deleted_at, NEW.deleted_by) IS DISTINCT FROM (OLD.deleted_at, OLD.deleted_by)
     AND NOT public.is_admin()
     AND current_user <> pg_get_userbyid(
           (SELECT relowner FROM pg_class WHERE oid = 'public.stories'::regclass))
  THEN
    RAISE EXCEPTION
      'Only a moderator can change whether a post is deleted. Call request_story_deletion() to ask for removal.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_story_moderation_fields ON public.stories;
CREATE TRIGGER trg_guard_story_moderation_fields
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_story_moderation_fields();

-- The trigger has to be callable by the roles that run UPDATE on stories.
GRANT EXECUTE ON FUNCTION public.guard_story_moderation_fields() TO authenticated;

-- 1b. Restore the profile UPDATE that the email-privacy grant removed.
--
-- Column level on purpose. username stays immutable so nobody can take over
-- another person's handle, and role / email / id / created_at are not granted
-- at all, so self-promotion remains impossible. This is the same technique
-- already used to hide the email column.
GRANT UPDATE (display_name, bio, avatar_url, updated_at) ON public.users TO authenticated;

-- 1c. The challenges table is seed data written once from the SQL editor.
-- Nothing in the app writes to it, so drop the write grants entirely rather
-- than relying on RLS to deny. RLS already denied it; this removes the
-- attempt as well.
REVOKE INSERT, UPDATE, DELETE ON public.challenges FROM anon, authenticated;

-- ============================================================================
-- 2. POLICY REWRITE
-- ============================================================================
-- Read the baseline first if you want to diff:
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--   where schemaname = 'public' order by 1, 3, 2;

-- --- drop every existing policy -------------------------------------------------
DROP POLICY IF EXISTS "Users can view all profiles"                ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"               ON public.users;

DROP POLICY IF EXISTS "Anyone can view active challenges"          ON public.challenges;

DROP POLICY IF EXISTS "Users can view own assignments"             ON public.challenge_assignments;
DROP POLICY IF EXISTS "Users can insert own assignments"            ON public.challenge_assignments;
DROP POLICY IF EXISTS "Users can update own assignments"            ON public.challenge_assignments;

DROP POLICY IF EXISTS "Anyone can view non-deleted stories"        ON public.stories;
DROP POLICY IF EXISTS "Authors can view own stories"               ON public.stories;
DROP POLICY IF EXISTS "Admins can view all stories"                ON public.stories;
DROP POLICY IF EXISTS "Users can insert own stories"               ON public.stories;
DROP POLICY IF EXISTS "Users can update own stories"               ON public.stories;
DROP POLICY IF EXISTS "Admins can update any story"                ON public.stories;
DROP POLICY IF EXISTS "Users can delete own stories"               ON public.stories;
DROP POLICY IF EXISTS "Admins can delete any story"                ON public.stories;

DROP POLICY IF EXISTS "Anyone can view non-deleted comments"       ON public.comments;
DROP POLICY IF EXISTS "Authors can view own comments"              ON public.comments;
DROP POLICY IF EXISTS "Admins can view all comments"               ON public.comments;
DROP POLICY IF EXISTS "Users can insert comments"                  ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments"              ON public.comments;
DROP POLICY IF EXISTS "Admins can update any comment"              ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments"              ON public.comments;
DROP POLICY IF EXISTS "Admins can delete any comment"              ON public.comments;

DROP POLICY IF EXISTS "Anyone can view reactions"                  ON public.reactions;
DROP POLICY IF EXISTS "Users can insert reactions"                 ON public.reactions;
DROP POLICY IF EXISTS "Users can delete own reactions"             ON public.reactions;

DROP POLICY IF EXISTS "Anyone can view inspiration events"         ON public.inspiration_events;
DROP POLICY IF EXISTS "Users can insert inspiration events"        ON public.inspiration_events;

DROP POLICY IF EXISTS "Anyone can view chains"                     ON public.chains;
DROP POLICY IF EXISTS "Users can create chains"                    ON public.chains;

DROP POLICY IF EXISTS "Anyone can view chain nodes"                ON public.chain_nodes;
DROP POLICY IF EXISTS "Users can insert chain nodes"               ON public.chain_nodes;

DROP POLICY IF EXISTS "Anyone can view chain contributions"        ON public.chain_contributions;

DROP POLICY IF EXISTS "Reporters can view own reports"             ON public.story_reports;
DROP POLICY IF EXISTS "Admins can view all reports"                ON public.story_reports;
DROP POLICY IF EXISTS "Users can report others posts"              ON public.story_reports;
DROP POLICY IF EXISTS "Admins can update reports"                 ON public.story_reports;
DROP POLICY IF EXISTS "Reporters can delete own reports"           ON public.story_reports;

DROP POLICY IF EXISTS "Requesters can view own deletion requests"  ON public.story_deletion_requests;

-- --- users ---------------------------------------------------------------------
-- Profiles are public within the app. Which columns are readable is handled by
-- the column-level grants in supabase-users-privacy.sql, not here: RLS filters
-- rows, not columns, so the email column is kept out of reach by privilege
-- rather than by policy.
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- --- challenges ----------------------------------------------------------------
CREATE POLICY "Anyone can view active challenges" ON public.challenges
  FOR SELECT TO anon, authenticated USING (active = true);

-- --- challenge_assignments -----------------------------------------------------
-- Note the WITH CHECK on UPDATE, which the original policy omitted. Without it
-- a member could reassign a completed challenge to another user.
CREATE POLICY "Users can view own assignments" ON public.challenge_assignments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own assignments" ON public.challenge_assignments
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own assignments" ON public.challenge_assignments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- --- stories -------------------------------------------------------------------
-- The three SELECT policies that used to overlap are now one. An author can
-- always read their own post even after it is removed; that is the deliberate
-- exception the earlier "Authors can view own stories" policy existed for,
-- and every normal app query filters deleted_at explicitly.
CREATE POLICY "Anyone can read live stories" ON public.stories
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL OR (SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "Users can insert own stories" ON public.stories
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners and moderators can update stories" ON public.stories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- Security fix 1. Hard deletion is a moderator action only; members go through
-- request_story_deletion(), which creates a row a human reviews.
CREATE POLICY "Moderators can delete stories" ON public.stories
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- --- comments ------------------------------------------------------------------
CREATE POLICY "Anyone can read live comments" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL OR (SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "Users can insert comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners and moderators can update comments" ON public.comments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "Owners and moderators can delete comments" ON public.comments
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- Deliberate gap, recorded so it is not mistaken for an oversight: the trigger
-- that locks a post's deletion state has no equivalent on comments, so a member
-- can soft-delete and restore their own comment. That is acceptable while
-- comments have no moderation queue, which they currently do not. If comment
-- moderation is ever added, copy the trigger across first.

-- --- reactions -----------------------------------------------------------------
CREATE POLICY "Anyone can view reactions" ON public.reactions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can insert reactions" ON public.reactions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own reactions" ON public.reactions
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- --- inspiration_events --------------------------------------------------------
CREATE POLICY "Anyone can view inspiration events" ON public.inspiration_events
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can insert inspiration events" ON public.inspiration_events
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = inspired_user_id);

-- --- chains --------------------------------------------------------------------
CREATE POLICY "Anyone can view chains" ON public.chains
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can create chains" ON public.chains
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = started_by_user_id);

CREATE POLICY "Anyone can view chain nodes" ON public.chain_nodes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can insert chain nodes" ON public.chain_nodes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- chain_contributions has no INSERT policy for anyone, and no INSERT grant
-- either. contribute_to_chain() and create_goal_chain() are SECURITY DEFINER,
-- which is what writes here.

CREATE POLICY "Anyone can view chain contributions" ON public.chain_contributions
  FOR SELECT TO anon, authenticated USING (true);

-- --- story_reports -------------------------------------------------------------
CREATE POLICY "Reporters and moderators can view reports" ON public.story_reports
  FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Users can report others posts" ON public.story_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND status = 'open'::text
    AND public.reportable_story(story_id, reporter_id)
  );

CREATE POLICY "Moderators can update reports" ON public.story_reports
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Reporters and moderators can delete reports" ON public.story_reports
  FOR DELETE TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- --- story_deletion_requests ----------------------------------------------------
-- No INSERT policy for anyone. request_story_deletion() is the only way in,
-- and it derives the requester from auth.uid() rather than accepting an
-- argument, so a client cannot file a request in someone else's name.
CREATE POLICY "Requesters and moderators can view deletion requests"
  ON public.story_deletion_requests
  FOR SELECT TO authenticated
  USING (requester_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================
-- Policy count per table, and every one should now be role-scoped:
--
--   select tablename, roles::text, cmd, count(*)
--   from pg_policies where schemaname = 'public'
--   group by 1,2,3 order by 1,3;
--
-- No policy should remain TO public, and the advisor's two PERFORMANCE
-- warnings should clear on the next scan.
--
-- The escape hatch must not be reachable from a client, i.e. these are all
-- false:
--
--   select pg_has_role('authenticated','postgres','MEMBER') as member_of_owner,
--          pg_has_role('anon','postgres','MEMBER')         as anon_is_owner;
--
-- A story photo URL must still return 200, and challenges must still be
-- readable by anon, or the app is broken:
--
--   select count(*) from challenges where active;
--
-- ---------------------------------------------------------------------------
-- Behaviour deliberately changed, in one place only:
--   A member can no longer DELETE or set deleted_at on their own story.
--   request_story_deletion() is the supported path and is unchanged.
-- ---------------------------------------------------------------------------
