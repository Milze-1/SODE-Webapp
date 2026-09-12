'use client';

import { useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { EmptyState } from '@/components/sode/ui';
import { useNotifications, NOTIFICATION_LINKS, timeAgo } from '@/lib/hooks/useNotifications';

// Mobile-only notification bell: a bottom-nav item that opens a full-screen
// sheet (rather than a corner dropdown, which would collide with the
// top-right content several member pages already render in their own
// sticky header — see NotificationBell for the desktop sidebar version).
export default function NotificationSheet() {
  const { memberId, items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  if (!memberId) return null;

  const openSheet = () => { setOpen(true); markAllRead(); };

  return (
    <>
      <button
        onClick={openSheet}
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

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 1, background: 'rgba(255,255,255,.86)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)',
            padding: '13px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Notifications</div>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
            {items.length === 0 ? (
              <EmptyState icon="bell" title="You're all caught up" body="New sessions, forms, content and reminders will show up here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.map(n => (
                  <a
                    key={n.id}
                    href={NOTIFICATION_LINKS[n.type] ?? '/member/home'}
                    onClick={() => setOpen(false)}
                    className="card"
                    style={{ display: 'block', padding: '12px 14px', textDecoration: 'none', color: 'var(--ink)' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: n.read_at ? 600 : 700, lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
