-- ============================================================================
-- 006_daily_devotionals.sql — Admin-created daily devotionals + new devotion
--   check-in system for members.
-- Run in the Supabase SQL Editor after 005_leaderboard_rls.sql.
-- ============================================================================

-- ─── daily_devotionals ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_devotionals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  scripture_ref    TEXT NOT NULL DEFAULT '',
  scripture_text   TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL,
  prayer_focus     TEXT NOT NULL DEFAULT '',
  key_declaration  TEXT NOT NULL DEFAULT '',
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_devotionals ENABLE ROW LEVEL SECURITY;

-- Drop old policy if it exists (e.g. re-running this migration)
DROP POLICY IF EXISTS "Admins manage daily_devotionals" ON public.daily_devotionals;
DROP POLICY IF EXISTS "Members read published devotionals" ON public.daily_devotionals;

-- Admins can fully manage devotionals (WITH CHECK required for INSERT/UPDATE)
CREATE POLICY "Admins manage daily_devotionals"
  ON public.daily_devotionals FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('director','spiritual_lead','data_ops_lead','member_care_lead')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('director','spiritual_lead','data_ops_lead','member_care_lead')
    )
  );

-- All authenticated users can read published devotionals
CREATE POLICY "Members read published devotionals"
  ON public.daily_devotionals FOR SELECT TO authenticated
  USING (is_published = TRUE);

-- ─── devotion_checkins: add new columns for the new system ───────────────────
-- The existing plan-based columns (plan_id, checkin_date, completed, notes,
-- duration_minutes) are preserved. The new columns support the member+date
-- daily devotion flow independently.

ALTER TABLE public.devotion_checkins
  ADD COLUMN IF NOT EXISTS member_id      UUID REFERENCES public.members(id),
  ADD COLUMN IF NOT EXISTS entry_date     DATE,
  ADD COLUMN IF NOT EXISTS checklist      JSONB,
  ADD COLUMN IF NOT EXISTS journal_entry  TEXT,
  ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Point rules ─────────────────────────────────────────────────────────────

INSERT INTO public.point_rules (rule_key, label, description, points, cap, cap_period, requires_verification, is_active)
VALUES
  ('devotion_checkin',   'Devotion check-in',       'Member completes 3+ devotion checklist items.',  5,   1, 'day',  FALSE, TRUE),
  ('devotion_full_day',  'Full devotion day',        'Member checks all devotion items for the day.',  10,  1, 'day',  FALSE, TRUE),
  ('devotion_streak_7',  '7-day devotion streak',    'Member completes devotion 7 consecutive days.',  25,  1, 'week', FALSE, TRUE),
  ('devotion_streak_30', '30-day devotion streak',   'Member completes devotion 30 consecutive days.', 100, NULL, NULL, FALSE, TRUE)
ON CONFLICT (rule_key) DO NOTHING;

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_devotionals;
