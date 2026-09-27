-- DON'T PRESS — security advisor remediation
-- Run this in the Supabase SQL Editor.
--
-- Triaged from 22 advisor warnings. What is fixed here and, deliberately,
-- what is not.
--
-- FIXED
-- 1. handle_new_user() and insert_initial_challenges() were executable by
--    PUBLIC, anon AND authenticated. handle_new_user is a trigger function
--    that references NEW, and insert_initial_challenges is a one-off seed
--    helper. Neither is meant to be called over the API at all.
-- 2. Both lacked a search_path. As SECURITY DEFINER functions that is a real
--    hardening gap: an unqualified name inside them can be resolved through
--    a hijacked pg_temp object. Pinned to public, pg_temp.
-- 3. anon could execute get_my_role, get_profile_stats, reportable_story,
--    request_story_deletion, resolve_deletion_request and
--    cancel_deletion_request. Every one of these is called by the signed-in
--    app, and each validates the caller itself, but the grant should not
--    have been there.
-- 4. The "Anyone can view story photos" policy on storage.objects is a broad
--    SELECT that lets any client enumerate every file in the bucket. The
--    bucket is public and story photos are meant to be world-readable, but
--    public object URLs do not need this policy to work, so it is dropped.
--
-- DELIBERATELY NOT CHANGED
-- * is_admin() stays executable by anon. RLS policy expressions are
--   evaluated with the querying role's privileges, and the stories SELECT
--   policies include "Admins can view all stories" USING is_admin(). Revoking
--   it from anon would make every logged-out read of the feed fail, not
--   merely hide the role check. The function takes no argument and can only
--   ever report whether the CALLER is an admin, so there is nothing to leak.
-- * The signed-in warnings on contribute_to_chain, create_goal_chain,
--   request_story_deletion, resolve_deletion_request, cancel_deletion_request,
--   get_my_role and get_profile_stats are the intended API surface. Every one
--   derives the acting user from auth.uid() rather than an argument, and
--   resolves its own target rows, so a signed-in user cannot act as anyone
--   else. Revoking these would break the app rather than secure it.

-- ============================================================================
-- 1. Trigger and seed functions: pin search_path, remove all execute grants
-- ============================================================================

ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.insert_initial_challenges() SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.insert_initial_challenges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_initial_challenges() FROM anon;
REVOKE ALL ON FUNCTION public.insert_initial_challenges() FROM authenticated;

-- Belt and braces: keep the seed helper out of the exposed API entirely.
-- It only needs to run from the SQL editor, which runs as the owner.
DROP FUNCTION IF EXISTS public.insert_initial_challenges();

-- ============================================================================
-- 2. anon should not be able to call the signed-in app functions
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_stats(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reportable_story(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_story_deletion(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_deletion_request(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_deletion_request(UUID) FROM anon;

-- reportable_story is also called from a story_reports INSERT policy. Only
-- signed-in users insert reports, so anon does not need it there either.
REVOKE EXECUTE ON FUNCTION public.reportable_story(UUID, UUID) FROM PUBLIC;

-- ============================================================================
-- 3. Stop clients listing every file in the public photo bucket
-- ============================================================================
-- The bucket stays public and story photos stay world-readable through their
-- object URL, which the storage API serves without consulting this policy.
-- What goes away is the ability to enumerate the whole bucket.
DROP POLICY IF EXISTS "Anyone can view story photos" ON storage.objects;

-- ============================================================================
-- 4. Verification
-- ============================================================================
-- These should now be false:
--
--   select has_function_privilege('anon','public.request_story_deletion(uuid,text)','EXECUTE');
--   select has_function_privilege('anon','public.get_profile_stats(uuid)','EXECUTE');
--   select has_function_privilege('public','public.handle_new_user()','EXECUTE');
--
-- This one must stay TRUE, or logged-out reads of the feed break:
--
--   select has_function_privilege('anon','public.is_admin()','EXECUTE');
--
-- And a story photo URL must still return 200 without the storage policy.
