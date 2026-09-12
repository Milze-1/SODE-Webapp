-- 013: Attendance check-in geofencing
--
-- Adds an org-wide default check-in location (attendance_settings, a
-- singleton row) plus optional per-session coordinates that override it.
-- Self/QR check-in (attendance_records.source IN ('self','qr')) is now
-- rejected server-side by RLS unless the device's reported coordinates are
-- within the effective radius — this can't be bypassed by skipping the
-- client-side distance check, since Postgres itself enforces it in the
-- INSERT policy below. Leader-entered attendance (source='leader', or any
-- insert by an admin) is untouched — leaders can still mark someone present
-- manually regardless of location.

-- ─── Default church location (singleton) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name   text,
  latitude      double precision,
  longitude     double precision,
  radius_meters integer NOT NULL DEFAULT 300,
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_settings_read_authenticated"
  ON public.attendance_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "attendance_settings_write_admin"
  ON public.attendance_settings FOR ALL TO authenticated
  USING  (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ─── Per-session override coordinates ──────────────────────────────────────────

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS longitude double precision;

-- ─── Where the check-in device reported being ──────────────────────────────────

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS check_in_lat double precision;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS check_in_lng double precision;

-- ─── Geofence check (Haversine, no extension needed) ───────────────────────────
-- Resolves the effective location (session override, else the org default),
-- then returns TRUE if p_lat/p_lng are within its radius. If no location has
-- been configured anywhere, returns TRUE (geofencing is opt-in — a fresh
-- install shouldn't block check-in until an admin sets a location).

CREATE OR REPLACE FUNCTION public.within_check_in_radius(p_session_id uuid, p_lat double precision, p_lng double precision)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  eff_lat    double precision;
  eff_lng    double precision;
  eff_radius integer;
  meters     double precision;
BEGIN
  SELECT s.latitude, s.longitude INTO eff_lat, eff_lng FROM public.sessions s WHERE s.id = p_session_id;

  SELECT
    COALESCE(eff_lat, a.latitude),
    COALESCE(eff_lng, a.longitude),
    COALESCE(a.radius_meters, 300)
  INTO eff_lat, eff_lng, eff_radius
  FROM public.attendance_settings a
  LIMIT 1;

  IF eff_lat IS NULL OR eff_lng IS NULL THEN
    RETURN TRUE;
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN FALSE;
  END IF;

  meters := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - eff_lat) / 2), 2) +
    cos(radians(eff_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - eff_lng) / 2), 2)
  ));

  RETURN meters <= eff_radius;
END;
$$;

-- ─── Enforce it on self/QR check-in ─────────────────────────────────────────────

DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance_records;
CREATE POLICY "attendance_insert_own"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    member_id = public.auth_member_id()
    AND source IN ('self', 'qr')
    AND public.within_check_in_radius(session_id, check_in_lat, check_in_lng)
  );
