-- 021: WhatsApp inbox (Admin → Messages → Inbox)
--
-- One row per WhatsApp message in or out of the linked SODE number, so admins
-- can see who wrote in, which conversations still need a reply, and answer
-- from the app. Inbound rows come from the OpenWA webhook
-- (app/api/whatsapp/webhook); outbound rows from the send queue and from
-- inbox replies. Service-role only (no policies) — read through admin APIs.
--
-- `contact` groups a conversation: the sender's phone digits when known,
-- otherwise the WhatsApp chat id (privacy-id senders without a resolved phone).

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact             text NOT NULL,
  phone               text,
  chat_id             text,
  member_id           uuid REFERENCES public.members(id) ON DELETE SET NULL,
  direction           text NOT NULL CHECK (direction IN ('in', 'out')),
  body                text NOT NULL,
  msg_type            text NOT NULL DEFAULT 'text',
  sender_name         text,
  provider_message_id text UNIQUE,
  sent_by             uuid REFERENCES auth.users(id),
  read_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact
  ON public.whatsapp_messages (contact, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recent
  ON public.whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_unread
  ON public.whatsapp_messages (contact)
  WHERE direction = 'in' AND read_at IS NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
