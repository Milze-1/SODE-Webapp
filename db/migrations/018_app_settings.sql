-- 018: App-wide settings (key/value), starting with the growth cycle
--
-- The cycle ("2026 Growth Cycle", Month X of 12) was hard-coded in several
-- screens and in the points "cycle" cap. Admins now edit it in
-- Settings → Active cycle (written server-side via /api/admin/cycle).

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read settings; writes go through the service role
DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings (key, value)
VALUES ('growth_cycle', '{"label": "2026 Growth Cycle", "start": "2026-01-01", "months": 12}')
ON CONFLICT (key) DO NOTHING;
