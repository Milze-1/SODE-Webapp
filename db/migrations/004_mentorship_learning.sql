-- ============================================================================
-- 004_mentorship_learning.sql — Mentor pairings + learning content library
-- Run in the Supabase SQL Editor after 003_attendance_live.sql.
-- ============================================================================

-- ─── members: mentor flags ─────────────────────────────────────────────────
-- is_mentor / mentor_capacity are referenced by the admin mentorship page but
-- never existed on members (confirmed via db/schema.ts) — adding both here.

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS mentor_capacity INTEGER DEFAULT 3;

-- ─── mentor_pairings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mentor_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES public.members(id),
  mentee_id UUID REFERENCES public.members(id),
  status TEXT DEFAULT 'active',
  pillar TEXT,
  matched_by UUID REFERENCES auth.users(id),
  matched_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(mentor_id, mentee_id)
);

ALTER TABLE public.mentor_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pairings" ON public.mentor_pairings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('director','member_care_lead','career_lead','spiritual_lead','business_lead','data_ops_lead'))
);

CREATE POLICY "Members see own pairings" ON public.mentor_pairings FOR SELECT TO authenticated USING (
  mentor_id = (SELECT id FROM public.members WHERE auth_id = auth.uid())
  OR mentee_id = (SELECT id FROM public.members WHERE auth_id = auth.uid())
);

-- ─── learning_content ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'book'|'article'|'podcast'|'video'|'course'|'devotional'|'other'
  description TEXT,
  author TEXT,
  url TEXT,
  thumbnail_url TEXT,
  pillar TEXT,
  month_number INTEGER, -- 1-12, NULL = always
  is_published BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id),
  content_id UUID REFERENCES public.learning_content(id),
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, content_id)
);

ALTER TABLE public.learning_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read published content" ON public.learning_content FOR SELECT TO authenticated USING (is_published = TRUE);

CREATE POLICY "Admins manage content" ON public.learning_content FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('director','data_ops_lead','career_lead','spiritual_lead','business_lead','member_care_lead'))
);

CREATE POLICY "Members manage own completions" ON public.learning_completions FOR ALL TO authenticated USING (
  member_id = (SELECT id FROM public.members WHERE auth_id = auth.uid())
);

-- ─── point_rules: new rule keys referenced by the form renderer + learning page ──

INSERT INTO public.point_rules (rule_key, label, description, points, cap, cap_period, requires_verification, is_active)
VALUES
  ('form_submitted', 'Form submitted', 'Member completes a dynamic form.', 3, 5, 'month', FALSE, TRUE),
  ('content_completed', 'Learning content completed', 'Member marks a piece of learning content as done.', 10, NULL, NULL, FALSE, TRUE)
ON CONFLICT (rule_key) DO NOTHING;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- These will error harmlessly with "already a member of publication" if already added.

ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentor_pairings;
