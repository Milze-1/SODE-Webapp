-- 011: Group messages (admin broadcast to members via WhatsApp)
--
-- Lets an admin compose one message, target an audience (reusing the same
-- FormAudience shape as forms.form_audience), and send a personalized
-- WhatsApp/SMS to every matching member with a WhatsApp number on file.
-- This table is a send-history log only — delivery happens server-side via
-- the service-role client in app/api/admin/messages/send, so no INSERT
-- policy is needed.

CREATE TABLE IF NOT EXISTS public.group_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       uuid REFERENCES auth.users(id),
  body            text NOT NULL,
  audience        jsonb NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count      integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_messages_read_admin"
  ON public.group_messages FOR SELECT TO authenticated
  USING (public.auth_is_admin());
