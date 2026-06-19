-- ============================================================================
-- 005_leaderboard_rls.sql — Allow all authenticated members to read
--   point_events so the leaderboard month/cycle tabs work for everyone.
-- Run in the Supabase SQL Editor after 004_mentorship_learning.sql.
-- ============================================================================

-- Drop the restrictive member-only read policy
DROP POLICY IF EXISTS "point_events_read_own"   ON public.point_events;

-- Drop any other names this policy may have been created under
DROP POLICY IF EXISTS "Members read own point events"        ON public.point_events;
DROP POLICY IF EXISTS "Authenticated can read point_events"  ON public.point_events;
DROP POLICY IF EXISTS "members_read_own_events"              ON public.point_events;
DROP POLICY IF EXISTS "read_all_point_events"                ON public.point_events;

-- Allow every authenticated user to read all rows.
-- point_events contains no sensitive personal data beyond member_id and
-- points earned — the same data that is visible on the public leaderboard.
CREATE POLICY "read_all_point_events"
  ON public.point_events FOR SELECT
  TO authenticated
  USING (true);
