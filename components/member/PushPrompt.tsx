'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/sode/icons';
import { isPushSupported, isIOS, isStandalone, getPushSubscriptionStatus, subscribeToPush } from '@/lib/push-client';

const DISMISS_KEY = 'sode-push-prompt-dismissed-at';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // re-ask after 3 days

type Mode = 'enable' | 'install-ios' | null;

// Floating card that asks members to turn on phone notifications. Push used
// to be reachable only from a Settings toggle (hidden entirely on iOS outside
// the installed PWA), so almost no device was ever subscribed and reminders
// never reached anyone outside the app.
export default function PushPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Home only: as a fixed overlay it would cover sheets and buttons elsewhere
    if (pathname !== '/member/home') { setMode(null); return; }
    let snoozed = false;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      snoozed = Date.now() - at < SNOOZE_MS;
    } catch { /* storage blocked — just show it */ }
    if (snoozed) return;

    (async () => {
      if (isIOS() && !isStandalone()) { setMode('install-ios'); return; }
      if (!isPushSupported() || Notification.permission === 'denied') return;
      const status = await getPushSubscriptionStatus();
      if (status === 'unsubscribed') setMode('enable');
    })();
  }, [pathname]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setMode(null);
  };

  const enable = async () => {
    setBusy(true);
    const ok = await subscribeToPush().catch(() => false);
    setBusy(false);
    if (ok) setMode(null); else dismiss();
  };

  if (!mode) return null;

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, zIndex: 900,
      bottom: 'calc(78px + env(safe-area-inset-bottom))',
      maxWidth: 440, margin: '0 auto',
      background: 'var(--navy)', color: '#fff', borderRadius: 16, padding: '14px 14px 12px',
      boxShadow: '0 12px 32px rgba(0,0,0,.22)', animation: 'sode-pop .35s cubic-bezier(.16,1,.3,1)',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name="bell" size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>Don&apos;t miss a thing</div>
          {mode === 'enable' ? (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>
              Turn on notifications to get session alerts, reminders and tasks on your phone — even when SODE is closed.
            </div>
          ) : (
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>
              To get notifications on iPhone, add SODE to your Home Screen: tap <strong style={{ color: '#fff' }}>Share</strong> <Icon name="share" size={12} color="#fff" /> then <strong style={{ color: '#fff' }}>Add to Home Screen</strong>, and open SODE from there.
            </div>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" style={{ color: 'rgba(255,255,255,.7)', display: 'flex', padding: 2 }}>
          <Icon name="x" size={16} />
        </button>
      </div>
      {mode === 'enable' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={dismiss} className="btn btn-sm" style={{ flex: 1, background: 'rgba(255,255,255,.12)', color: '#fff' }}>Not now</button>
          <button onClick={enable} disabled={busy} className="btn btn-sm" style={{ flex: 1, background: '#fff', color: 'var(--navy)', fontWeight: 700 }}>
            {busy ? 'Turning on…' : 'Turn on'}
          </button>
        </div>
      )}
    </div>
  );
}
