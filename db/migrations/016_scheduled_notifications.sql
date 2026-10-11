-- 016: Time-based notifications
--
-- Vercel Hobby crons only run once a day at an unpredictable minute, so exact
-- times (meeting start, 6am devotion, per-goal reminder times) are driven by
-- /api/cron/tick, called every minute by pg_cron (see 017_tick_scheduler.sql).
-- All times are Africa/Lagos.

-- Per-goal progress reminders, set by the member when creating/editing a goal.
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS reminder_frequency text NOT NULL DEFAULT 'off'
    CHECK (reminder_frequency IN ('off', 'daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS reminder_time    time,      -- Lagos local time
  ADD COLUMN IF NOT EXISTS reminder_weekday smallint   -- 0 = Sunday … 6 = Saturday (weekly only)
    CHECK (reminder_weekday BETWEEN 0 AND 6);

CREATE INDEX IF NOT EXISTS idx_goals_reminder_on
  ON public.goals (reminder_time)
  WHERE reminder_frequency <> 'off';

-- Run ledger: one row per (job, key) the tick has already handled, e.g.
-- ('session_start', '<session id>') or ('devotion_6am', '2026-10-12').
-- Inserting is the lock — a duplicate key means "already done", so a send can
-- never repeat even if two ticks overlap. Service-role only (no policies).
CREATE TABLE IF NOT EXISTS public.job_runs (
  job        text        NOT NULL,
  run_key    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job, run_key)
);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
