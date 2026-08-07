-- 009: Fix goals/wins/course_completions visibility for super_admin
--
-- Migration 007 added the super_admin role with "unrestricted access to
-- everything", but auth_can_access_pillar() — the helper backing the
-- pillar-lead SELECT policies on goals, wins, and course_completions —
-- was never updated to recognize it. Every other admin-facing table has
-- an explicit `USING (public.auth_is_admin())` bypass policy; these three
-- never got one. Result: an admin logged in as super_admin sees zero rows
-- on these tables for any member other than themselves — RLS silently
-- filters the rows, no error is raised.
--
-- This adds a dedicated auth_is_super_admin() helper and an explicit
-- bypass SELECT policy on each of the three affected tables. Scoped to
-- super_admin only, per migration 007's intent — business_dev and
-- external_mentor keep their existing, more limited access.
--
-- Run against Supabase with: psql $DATABASE_URL -f db/migrations/009_super_admin_visibility.sql

CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  )
$$;

CREATE POLICY "goals_read_super_admin"
  ON public.goals FOR SELECT TO authenticated
  USING (public.auth_is_super_admin());

CREATE POLICY "wins_read_super_admin"
  ON public.wins FOR SELECT TO authenticated
  USING (public.auth_is_super_admin());

CREATE POLICY "course_completions_read_super_admin"
  ON public.course_completions FOR SELECT TO authenticated
  USING (public.auth_is_super_admin());
