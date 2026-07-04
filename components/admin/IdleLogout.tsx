'use client';

// Signs an admin out after 30 minutes of inactivity on admin pages.
//
// Activity = mouse, keyboard, scroll, touch or click anywhere in the admin
// area. The last-active timestamp is kept in localStorage so multiple open
// admin tabs count as one session — activity in any tab keeps all alive.
// A stale tab (e.g. laptop lid closed) is caught on visibilitychange and on
// the 30-second interval check.

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
    const touch = () => {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* private mode */ }
    };
    touch();

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite > TOUCH_THROTTLE_MS) {
        lastWrite = now;
        touch();
      }
    };

    const check = async () => {
      if (signingOut.current) return;
      let lastActive = Date.now();
      try { lastActive = Number(localStorage.getItem(STORAGE_KEY) ?? Date.now()); } catch { /* ignore */ }
      if (Date.now() - lastActive >= IDLE_LIMIT_MS) {
        signingOut.current = true;
        try { await createClient().auth.signOut(); } catch { /* proceed to login regardless */ }
        router.replace('/internal/admin-login?error=session_timeout');
      }
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    const interval = setInterval(check, 30 * 1000);
    document.addEventListener('visibilitychange', check);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [router]);

  return null;
}
