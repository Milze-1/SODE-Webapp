-- 015: Per-member notification preferences
--
-- Shape: { "email": boolean, "off": ["sessions", "forms", ...] }
-- See lib/notification-prefs.ts. Empty object = everything on (the default).
-- Members already update their own row (consent_contact, leaderboard_opt_in),
-- so no new RLS policy is needed.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
