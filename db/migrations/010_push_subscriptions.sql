-- 010: Web Push subscriptions
--
-- Stores one row per browser/device a member has enabled push notifications
-- on (a member can have several — phone + laptop, etc). Used to notify
-- members when a new session is scheduled or goes live, prompting them to
-- check in attendance.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_member_id_idx
  ON public.push_subscriptions (member_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Members manage their own subscriptions (subscribe/unsubscribe from settings)
CREATE POLICY push_subscriptions_own
  ON public.push_subscriptions FOR ALL TO authenticated
  USING  (member_id = public.auth_member_id())
  WITH CHECK (member_id = public.auth_member_id());

-- No admin SELECT policy: sending pushes happens server-side via the
-- service-role client (app/api/push/notify-session), which bypasses RLS.
