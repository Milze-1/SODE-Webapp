// SODE runs on Lagos time. Africa/Lagos is UTC+1 all year (no DST), so a
// fixed offset is exact and avoids depending on the server's ICU data.

export const LAGOS_TZ = 'Africa/Lagos';
const OFFSET_MS = 60 * 60 * 1000;

export interface LagosClock {
  date: string;     // YYYY-MM-DD
  minutes: number;  // minutes since Lagos midnight
  weekday: number;  // 0 = Sunday
}

export function lagosClock(now = new Date()): LagosClock {
  const l = new Date(now.getTime() + OFFSET_MS);
  return {
    date: l.toISOString().slice(0, 10),
    minutes: l.getUTCHours() * 60 + l.getUTCMinutes(),
    weekday: l.getUTCDay(),
  };
}

// "HH:MM" or "HH:MM:SS" → minutes since midnight
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Human-readable session time in Lagos, e.g. "Sun 12 Oct, 08:00"
export function fmtLagos(iso: string, opts: Intl.DateTimeFormatOptions = {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
}): string {
  return new Date(iso).toLocaleString('en-GB', { ...opts, timeZone: LAGOS_TZ });
}
