-- 017: Every-minute scheduler for time-based notifications
--
-- Vercel Hobby crons run at most once a day at an imprecise minute, so
-- Supabase pg_cron calls /api/cron/tick every minute instead (meeting start,
-- 6am/7am devotion, per-goal reminder times — see lib/scheduled-jobs.ts).
--
-- Replace <TICK_SECRET> with the TICK_SECRET value set in Vercel env vars.
-- The secret is kept in Supabase Vault, not in the job definition.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT vault.create_secret('<TICK_SECRET>', 'sode_tick_secret')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'sode_tick_secret');

SELECT cron.unschedule('sode-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sode-tick');

SELECT cron.schedule(
  'sode-tick',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := 'https://app.thesode.org/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sode_tick_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
