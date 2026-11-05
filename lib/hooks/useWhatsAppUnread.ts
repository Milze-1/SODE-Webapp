'use client';

import { useEffect, useState } from 'react';

// Number of WhatsApp conversations waiting for a reply (Admin → Messages → Inbox).
// Polls every 45 s while the tab is visible; call refreshWhatsAppUnread() after
// opening or answering a conversation to update badges at once.
const EVENT = 'whatsapp-unread-refresh';

export function refreshWhatsAppUnread() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function useWhatsAppUnread(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const r = await fetch('/api/admin/whatsapp/inbox?count=1');
        if (!r.ok) return;
        const j = await r.json() as { unread?: { conversations?: number } };
        if (alive) setCount(j.unread?.conversations ?? 0);
      } catch { /* keep last value */ }
    };
    load();
    const t = setInterval(load, 45_000);
    window.addEventListener(EVENT, load);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; clearInterval(t); window.removeEventListener(EVENT, load); document.removeEventListener('visibilitychange', load); };
  }, []);
  return count;
}
