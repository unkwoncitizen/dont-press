-- Rollback safety net for supabase-rls-consolidation.sql
-- Captured automatically before the rewrite was applied. Only needed if the
-- rewrite has to be undone.
--
-- Roles are restored as TO public, which is what they were before, so this is
-- an exact revert of the policy layer only. The users UPDATE grant and the
-- moderation trigger are NOT reverted here; drop them explicitly if needed:
--
--   DROP TRIGGER IF EXISTS trg_guard_story_moderation_fields ON public.stories;
--   DROP FUNCTION IF EXISTS public.guard_story_moderation_fields();
--   REVOKE UPDATE (display_name, bio, avatar_url, updated_at) ON public.users FROM authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public.challenges TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view all profiles"                ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"               ON public.users;
DROP POLICY IF EXISTS "Anyone can view active challenges"          ON public.challenges;
DROP POLICY IF EXISTS "Users can view own assignments"             ON public.challenge_assignments;
DROP POLICY IF EXISTS "Users can insert own assignments"            ON public.challenge_assignments;
DROP POLICY IF EXISTS "Users can update own assignments"            ON public.challenge_assignments;
DROP POLICY IF EXISTS "Anyone can read live stories"               ON public.stories;
DROP POLICY IF EXISTS "Users can insert own stories"               ON public.stories;
DROP POLICY IF EXISTS "Owners and moderators can update stories"   ON public.stories;
DROP POLICY IF EXISTS "Moderators can delete stories"              ON public.stories;
DROP POLICY IF EXISTS "Anyone can read live comments"              ON public.comments;
DROP POLICY IF EXISTS "Users can insert comments"                  ON public.comments;
DROP POLICY IF EXISTS "Owners and moderators can update comments"  ON public.comments;
DROP POLICY IF EXISTS "Owners and moderators can delete comments"  ON public.comments;
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
DROP POLICY IF EXISTS "Reporters and moderators can view reports"  ON public.story_reports;
DROP POLICY IF EXISTS "Users can report others posts"              ON public.story_reports;
DROP POLICY IF EXISTS "Moderators can update reports"              ON public.story_reports;
DROP POLICY IF EXISTS "Reporters and moderators can delete reports" ON public.story_reports;
DROP POLICY IF EXISTS "Requesters and moderators can view deletion requests" ON public.story_deletion_requests;

CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT TO public USING (true);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO public USING (auth.uid() = id);
CREATE POLICY "Anyone can view active challenges" ON public.challenges
  FOR SELECT TO public USING (active = true);
CREATE POLICY "Users can view own assignments" ON public.challenge_assignments
  FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assignments" ON public.challenge_assignments
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assignments" ON public.challenge_assignments
  FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view non-deleted stories" ON public.stories
  FOR SELECT TO public USING (deleted_at IS NULL);
CREATE POLICY "Authors can view own stories" ON public.stories
  FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all stories" ON public.stories
  FOR SELECT TO public USING (is_admin());
CREATE POLICY "Users can insert own stories" ON public.stories
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stories" ON public.stories
  FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any story" ON public.stories
  FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any story" ON public.stories
  FOR DELETE TO public USING (is_admin());
CREATE POLICY "Anyone can view non-deleted comments" ON public.comments
  FOR SELECT TO public USING (deleted_at IS NULL);
CREATE POLICY "Authors can view own comments" ON public.comments
  FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all comments" ON public.comments
  FOR SELECT TO public USING (is_admin());
CREATE POLICY "Users can insert comments" ON public.comments
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.comments
  FOR DELETE TO public USING (is_admin());
CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view reactions" ON public.reactions
  FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert reactions" ON public.reactions
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.reactions
  FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view inspiration events" ON public.inspiration_events
  FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert inspiration events" ON public.inspiration_events
  FOR INSERT TO public WITH CHECK (auth.uid() = inspired_user_id);
CREATE POLICY "Anyone can view chains" ON public.chains
  FOR SELECT TO public USING (true);
CREATE POLICY "Users can create chains" ON public.chains
  FOR INSERT TO public WITH CHECK (auth.uid() = started_by_user_id);
CREATE POLICY "Anyone can view chain nodes" ON public.chain_nodes
  FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert chain nodes" ON public.chain_nodes
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view chain contributions" ON public.chain_contributions
  FOR SELECT TO public USING (true);
CREATE POLICY "Reporters can view own reports" ON public.story_reports
  FOR SELECT TO public USING ((reporter_id = auth.uid()) OR is_admin());
CREATE POLICY "Users can report others posts" ON public.story_reports
  FOR INSERT TO public
  WITH CHECK ((reporter_id = auth.uid()) AND (status = 'open'::text) AND reportable_story(story_id, reporter_id));
CREATE POLICY "Admins can update reports" ON public.story_reports
  FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Reporters can delete own reports" ON public.story_reports
  FOR DELETE TO public USING ((reporter_id = auth.uid()) OR is_admin());
CREATE POLICY "Requesters can view own deletion requests" ON public.story_deletion_requests
  FOR SELECT TO public USING ((requester_id = auth.uid()) OR is_admin());
