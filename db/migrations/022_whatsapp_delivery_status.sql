-- 022: Delivery / read ticks for messages SODE sends (Admin → Messages → Inbox)
--
-- Updated from OpenWA's message.ack webhook: sent (✓) → delivered (✓✓) →
-- read (blue ✓✓), or failed. Only ever moves forward.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivery_status text
  CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed'));
