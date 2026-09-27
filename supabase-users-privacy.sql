-- DON'T PRESS — stop exposing user email addresses
-- Run this in the Supabase SQL Editor AFTER deploying the matching code change.
--
-- The problem
-- -----------
-- public.users carries a policy of `FOR SELECT USING (true)`, and Supabase's
-- default privileges grant table-level SELECT to anon and authenticated. The
-- anon key ships in the browser bundle, so anyone could read every registered
-- user's email address with a single request:
--
--   curl "$SUPABASE/rest/v1/users?select=email" -H "apikey: $ANON_KEY"
--
-- RLS cannot fix this on its own. RLS is a ROW filter, not a COLUMN filter:
-- tightening the policy to "only your own row" would break the app, which
-- legitimately needs to see other people's display_name and avatar on the
-- feed, on profiles, and on chains.
--
-- The fix
-- -------
-- Revoke the table-level grant and re-grant SELECT on the safe columns only.
-- Postgres then rejects any query that mentions `email`, so the column is
-- unreachable regardless of the RLS policy.
--
-- Deploy order matters: the app must stop selecting `*` and `email` from
-- public.users BEFORE this runs, or profile pages will error with
-- "permission denied for table users".

-- ============================================================================
-- 1. Restrict SELECT to non-sensitive columns
-- ============================================================================

REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.users FROM authenticated;

GRANT SELECT (id, username, display_name, bio, avatar_url, created_at, updated_at)
  ON public.users TO anon;
GRANT SELECT (id, username, display_name, bio, avatar_url, created_at, updated_at)
  ON public.users TO authenticated;

-- Kept so a future "edit profile" feature can work. email is deliberately not
-- writable from the client; the signup trigger populates it as SECURITY
-- DEFINER, which runs as the table owner and bypasses these grants.
GRANT UPDATE (display_name, bio, avatar_url) ON public.users TO authenticated;

-- ============================================================================
-- 2. Confirm email is genuinely unreadable
-- ============================================================================
-- Both should return false. If either returns true, a grant is still in place.
--
--   select has_column_privilege('anon','public.users','email','SELECT');
--   select has_column_privilege('authenticated','public.users','email','SELECT');
--
-- Reading a user's own email still works, via the auth session
-- (session.user.email), which is unaffected by this change.
