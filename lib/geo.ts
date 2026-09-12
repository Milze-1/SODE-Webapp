// Haversine distance in meters. Mirrors the check the database performs in
// public.within_check_in_radius (db/migrations/013_attendance_geofence.sql) —
// used client-side to give a precise, friendly message before hitting the
// server; the DB is still the real enforcement point.
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface GeoCoords { lat: number; lng: number }

export function getCurrentCoords(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(new Error(
        err.code === err.PERMISSION_DENIED
          ? 'Location access is required to check in — please enable it and try again.'
          : 'Could not get your location — try again.',
      )),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}
