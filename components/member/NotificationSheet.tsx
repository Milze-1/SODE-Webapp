'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/sode/icons';
import { EmptyState } from '@/components/sode/ui';
import { useNotifications, NOTIFICATION_LINKS, timeAgo } from '@/lib/hooks/useNotifications';

// Mobile-only notification bell: a bottom-nav item that opens a full-screen
// sheet (rather than a corner dropdown, which would collide with the
// top-right content several member pages already render in their own
// sticky header — see NotificationBell for the desktop sidebar version).
//
// The sheet is portalled to <body>: the bottom nav uses backdrop-filter,
// which makes it the containing block for position:fixed descendants, so
// rendering the sheet inline squashed it into the nav bar on mobile.
export default function NotificationSheet() {
  const { memberId, items, unread, markAllRead, clearAll, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // "Clear all" asks for a second tap; the prompt reverts after a few seconds
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3500);
    return () => clearTimeout(t);
  }, [confirmClear]);

  // Lock background scroll while the sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!memberId) return null;

  const openSheet = () => { setOpen(true); markAllRead(); };

  const sheet = (
    <div className="sode" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)', display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{
        flex: 'none', background: 'rgba(255,255,255,.86)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)',
        padding: 'calc(13px + env(safe-area-inset-top)) 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', flex: 1 }}>Notifications</div>
        {items.length > 0 && (
          <button
            onClick={() => { if (confirmClear) { clearAll(); setConfirmClear(false); } else setConfirmClear(true); }}
            style={{ height: 32, padding: '0 12px', marginRight: 8, borderRadius: 99, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: confirmClear ? '#dc2626' : 'var(--surface)', color: confirmClear ? '#fff' : 'var(--ink-2)' }}
          >
            {confirmClear ? 'Tap to confirm' : 'Clear all'}
          </button>
        )}
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px calc(24px + env(safe-area-inset-bottom))' }}>
        {items.length === 0 ? (
          <EmptyState icon="bell" title="You're all caught up" body="New sessions, forms, content and reminders will show up here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map(n => (
              <div key={n.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', background: n.read_at ? undefined : 'var(--navy-tint)' }}>
                <a
                  href={NOTIFICATION_LINKS[n.type] ?? '/member/home'}
                  onClick={() => setOpen(false)}
                  style={{ flex: 1, minWidth: 0, display: 'block', padding: '12px 4px 12px 14px', textDecoration: 'none', color: 'var(--ink)' }}
                >
                  <div style={{ fontSize: 14, fontWeight: n.read_at ? 600 : 700, lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                </a>
                <button onClick={() => dismiss(n.id)} aria-label="Remove notification"
                  style={{ flex: 'none', width: 40, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icon name="x" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={openSheet}
        aria-label="Notifications"
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, padding: '5px 0', color: 'var(--faint)',
        }}
      >
        <div style={{ position: 'relative', display: 'flex' }}>
          <Icon name="bell" size={23} stroke={2} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -6, minWidth: 15, height: 15, padding: '0 3px',
              borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 9.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.01em' }}>Alerts</span>
      </button>

      {open && createPortal(sheet, document.body)}
    </>
  );
}
