-- 020: WhatsApp send queue (Admin → Messages via OpenWA)
--
-- Broadcasts are queued here and sent a few per minute by /api/cron/tick
-- (lib/whatsapp-queue.ts) — pacing that keeps sends human-like (lower ban
-- risk on the linked number) and means any audience size works without
-- hitting the 60-second request limit. Service-role only (no policies).

CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_message_id uuid REFERENCES public.group_messages(id) ON DELETE CASCADE,
  member_id        uuid REFERENCES public.members(id) ON DELETE SET NULL,
  phone            text NOT NULL,
  body             text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts         smallint NOT NULL DEFAULT 0,
  last_error       text,
  provider         text,
  provider_message_id text,
  send_after       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_due
  ON public.whatsapp_queue (send_after)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_broadcast
  ON public.whatsapp_queue (group_message_id, status);

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS pending_count integer NOT NULL DEFAULT 0;
