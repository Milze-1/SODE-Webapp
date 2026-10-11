'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { useNotifications, NOTIFICATION_LINKS, timeAgo } from '@/lib/hooks/useNotifications';

// Desktop-only bell: an inline button meant to sit in the sidebar header row,
// with its dropdown panel anchored to itself (not the viewport) so it never
// overlaps a page's own top-right content. See NotificationSheet for the
// mobile equivalent (bottom-nav icon → full-screen sheet).
export default function NotificationBell() {
  const { memberId, items, unread, markAllRead, clearAll, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3500);
    return () => clearTimeout(t);
  }, [confirmClear]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggleOpen = () => {
    setOpen(v => {
      const next = !v;
      if (next) markAllRead();
      return next;
    });
  };

  if (!memberId) return null;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        style={{
          width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--line-2)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', padding: 0, flex: 'none',
        }}
      >
        <Icon name="bell" size={16} stroke={2} color="var(--ink-2)" />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, padding: '0 3px',
            borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 40, left: 0, width: 320, maxHeight: 420, overflowY: 'auto',
          background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--line)',
          boxShadow: '0 12px 32px rgba(0,0,0,.16)', zIndex: 100,
        }}>
          <div style={{ padding: '10px 10px 10px 15px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', zIndex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>Notifications</span>
            {items.length > 0 && (
              <button
                onClick={() => { if (confirmClear) { clearAll(); setConfirmClear(false); } else setConfirmClear(true); }}
                style={{ height: 26, padding: '0 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: confirmClear ? '#dc2626' : 'var(--surface)', color: confirmClear ? '#fff' : 'var(--ink-2)' }}
              >
                {confirmClear ? 'Click to confirm' : 'Clear all'}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              You&apos;re all caught up.
            </div>
          ) : (
            items.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', background: n.read_at ? 'transparent' : 'var(--navy-tint)' }}>
                <a
                  href={NOTIFICATION_LINKS[n.type] ?? '/member/home'}
                  onClick={() => setOpen(false)}
                  style={{ flex: 1, minWidth: 0, display: 'block', padding: '11px 4px 11px 15px', textDecoration: 'none', color: 'var(--ink)' }}
                >
                  <div style={{ fontSize: 13, fontWeight: n.read_at ? 600 : 700, lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </a>
                <button onClick={() => dismiss(n.id)} aria-label="Remove notification" title="Remove"
                  style={{ flex: 'none', width: 34, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
