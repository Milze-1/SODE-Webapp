-- 012: In-app notification center
--
-- The `reminders` table already carries member-scoped notification rows
-- (type/message/reference_id) used by cron reminders and forms/publish.
-- This adds read-tracking so the app can show an unread badge and lets a
-- member mark their own notifications read (still cannot touch other
-- members' rows, and can't be used to forge a notification since insert
-- stays admin-only via `reminders_all_admin`).

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_reminders_member_unread
  ON public.reminders (member_id)
  WHERE read_at IS NULL;

CREATE POLICY "reminders_update_own_read_at"
  ON public.reminders FOR UPDATE TO authenticated
  USING      (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());
