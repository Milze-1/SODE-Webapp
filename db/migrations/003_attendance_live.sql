-- ============================================================================
-- 003_attendance_live.sql — Live session check-in (admin go-live + member QR/self check-in)
-- Run in the Supabase SQL Editor after 002_forms_audience.sql.
-- ============================================================================

-- ─── sessions: is_live flag ───────────────────────────────────────────────────

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS pillar public.pillar;

-- Only one session can be live at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_live_session ON public.sessions(is_live) WHERE is_live = TRUE;

-- ─── attendance_records: device_hint ──────────────────────────────────────────

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS device_hint TEXT;

-- ─── RLS: allow members to self-check-in via QR (source = 'qr'), not just 'self' ──

DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance_records;
CREATE POLICY "attendance_insert_own"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (member_id = public.auth_member_id() AND source IN ('self', 'qr'));

-- ─── Realtime: emit changes for live sessions + attendance ───────────────────
-- These will error harmlessly with "already a member of publication" if already added.

ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
