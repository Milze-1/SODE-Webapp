'use client';

// Signs an admin out after 30 minutes of inactivity on admin pages.
//
// Activity = mouse, keyboard, scroll, touch or click anywhere in the admin
// area. The last-active timestamp is kept in localStorage so multiple open
// admin tabs count as one session — activity in any tab keeps all alive.
//
// IMPORTANT ordering: every activity event FIRST checks whether the session
// already expired while the admin was away. Otherwise the returning admin's
// own mouse movement would refresh the timer before the expiry check runs,
// and the timeout would never fire.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const TOUCH_THROTTLE_MS = 10 * 1000;  // write timestamp at most every 10s
const STORAGE_KEY = 'sode-admin-last-active';

export default function IdleLogout() {
  const router = useRouter();
  const signingOut = useRef(false);

  useEffect(() => {
    const readLastActive = (): number => {
      try {
        const v = Number(localStorage.getItem(STORAGE_KEY));
        return Number.isFinite(v) && v > 0 ? v : Date.now();
      } catch { return Date.now(); }
    };

    const touch = () => {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* private mode */ }
    };

    const expire = async () => {
      if (signingOut.current) return;
      signingOut.current = true;
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      try { await createClient().auth.signOut(); } catch { /* proceed to login regardless */ }
      router.replace('/internal/admin-login?error=session_timeout');
    };

    const isExpired = () => Date.now() - readLastActive() >= IDLE_LIMIT_MS;

    // On mount: if the last session on this browser already ran out, sign out
    // immediately; otherwise start the clock fresh.
    if (isExpired()) { void expire(); return; }
    touch();

    let lastWrite = Date.now();
    const onActivity = () => {
      if (signingOut.current) return;
      // Check BEFORE refreshing — returning after 30+ min must log out, not
      // silently revive the session.
      if (isExpired()) { void expire(); return; }
      const now = Date.now();
      if (now - lastWrite > TOUCH_THROTTLE_MS) {
        lastWrite = now;
        touch();
      }
    };

    const check = () => {
      if (!signingOut.current && isExpired()) void expire();
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    const interval = setInterval(check, 30 * 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [router]);

  return null;
}
