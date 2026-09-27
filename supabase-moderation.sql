-- DON'T PRESS — post deletion and moderation roles
-- Run this in the Supabase SQL Editor.
--
-- Design notes
-- ------------
-- Deletion is SOFT (deleted_at), not a hard DELETE, for two reasons:
--   * A moderation mistake is recoverable, and a user deleting the wrong post
--     is not permanently destructive.
--   * Comments and reactions cascade on a hard DELETE, so removing one bad
--     post would silently destroy everyone else's comments with it.
--
-- The role column is deliberately NOT granted to the client. The privacy
-- migration granted SELECT on a fixed column list and UPDATE on
-- (display_name, bio, avatar_url), so `role` is unreadable and unwritable from
-- the browser. A user therefore cannot promote themselves, and the UI asks the
-- database whether to show admin controls rather than assuming.

-- ============================================================================
-- 1. Roles
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_valid;
ALTER TABLE public.users ADD CONSTRAINT users_role_valid
  CHECK (role IN ('user', 'moderator', 'admin'));

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

-- SECURITY DEFINER so policies can call it without recursing through the users
-- RLS policy on every candidate row. STABLE because it is read-only.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$;

-- Lets the client ask "am I an admin?" for the signed-in user. Revealing your
-- own role is not sensitive, and the function ignores any argument, so it
-- cannot be used to inspect someone else's.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.users WHERE id = auth.uid()), 'user');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated;

-- ============================================================================
-- 2. Soft delete on stories
-- ============================================================================

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS stories_deleted_at_idx ON public.stories (deleted_at);

-- Replace the blanket read policy. Without this, soft-deleted posts would stay
-- visible to everyone, which is the whole point of soft deleting them.
DROP POLICY IF EXISTS "Anyone can view stories" ON public.stories;
CREATE POLICY "Anyone can view non-deleted stories" ON public.stories
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all stories" ON public.stories;
CREATE POLICY "Admins can view all stories" ON public.stories
  FOR SELECT USING (public.is_admin());

-- Authors and staff can soft delete. The existing own-stories UPDATE policy
-- already lets an author set deleted_at; this adds staff.
DROP POLICY IF EXISTS "Admins can update any story" ON public.stories;
CREATE POLICY "Admins can update any story" ON public.stories
  FOR UPDATE USING (public.is_admin());

-- Staff may hard delete permanently, for content that should not be recoverable.
DROP POLICY IF EXISTS "Admins can delete any story" ON public.stories;
CREATE POLICY "Admins can delete any story" ON public.stories
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- 3. Same soft delete for comments
-- ============================================================================

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Anyone can view non-deleted comments" ON public.comments
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all comments" ON public.comments;
CREATE POLICY "Admins can view all comments" ON public.comments
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Admins can delete any comment" ON public.comments
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- 4. Promote the owner
-- ============================================================================
-- Run one of these, or add more later. Do not add a client-side way to change
-- this: role is intentionally unreachable from the browser.
--
--   update public.users set role = 'admin' where username = 'unownkcitizen';
