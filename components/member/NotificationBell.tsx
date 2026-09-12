'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { useNotifications, NOTIFICATION_LINKS, timeAgo } from '@/lib/hooks/useNotifications';

// Desktop-only bell: an inline button meant to sit in the sidebar header row,
// with its dropdown panel anchored to itself (not the viewport) so it never
// overlaps a page's own top-right content. See NotificationSheet for the
// mobile equivalent (bottom-nav icon → full-screen sheet).
export default function NotificationBell() {
  const { memberId, items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
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
          <div style={{ padding: '13px 15px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 800, position: 'sticky', top: 0, background: 'var(--bg)' }}>
            Notifications
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              You&apos;re all caught up.
            </div>
          ) : (
            items.map(n => (
              <a
                key={n.id}
                href={NOTIFICATION_LINKS[n.type] ?? '/member/home'}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block', padding: '11px 15px', borderBottom: '1px solid var(--line)',
                  textDecoration: 'none', color: 'var(--ink)',
                  background: n.read_at ? 'transparent' : 'var(--navy-tint)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: n.read_at ? 600 : 700, lineHeight: 1.4 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
