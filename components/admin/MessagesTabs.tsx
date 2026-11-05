'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/sode/icons';
import { useWhatsAppUnread } from '@/lib/hooks/useWhatsAppUnread';

// Send ↔ Inbox switcher at the top of Admin → Messages
export default function MessagesTabs() {
  const pathname = usePathname();
  const unread = useWhatsAppUnread();
  const tabs = [
    { href: '/admin/messages/inbox', label: 'Inbox', icon: 'message', badge: unread },
    { href: '/admin/messages', label: 'Send', icon: 'mail', badge: 0 },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line-2)', width: 'fit-content' }}>
      {tabs.map(t => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
            fontSize: 13, fontWeight: 700, background: active ? 'var(--navy)' : 'transparent', color: active ? '#fff' : 'var(--ink-2)',
          }}>
            <Icon name={t.icon} size={15} color={active ? '#fff' : 'var(--muted)'} />
            {t.label}
            {t.badge > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#25d366', color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
