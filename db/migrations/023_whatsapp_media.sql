-- 023: Images in WhatsApp messages (Admin → Messages: Inbox + Send)
--
-- media_path points into the private Supabase Storage bucket `whatsapp-media`
-- (created by the app on first upload — lib/whatsapp-media.ts). Pages get
-- short-lived signed links; the gateway gets one to fetch the image it sends.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_mime text;

ALTER TABLE public.whatsapp_queue
  ADD COLUMN IF NOT EXISTS media_path text;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS media_path text;
