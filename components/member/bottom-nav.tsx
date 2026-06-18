'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/sode/icons';

const ITEMS = [
  {
    key: 'home',
    primary: '/member/home',
    paths: ['/member/home', '/member/attendance', '/member/invite', '/member/leaderboard', '/member/share', '/member/mentorship'],
    icon: 'home',
    label: 'Home',
  },
  { key: 'devotion', primary: '/member/devotion', paths: ['/member/devotion'], icon: 'heart', label: 'Devotion' },
  { key: 'goals', primary: '/member/goals', paths: ['/member/goals'], icon: 'target', label: 'Goals' },
  { key: 'forms', primary: '/member/forms', paths: ['/member/forms', '/member/wins'], icon: 'list', label: 'Forms' },
  { key: 'you', primary: '/member/profile', paths: ['/member/profile', '/member/settings'], icon: 'user', label: 'You' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="member-bottom-nav flex" style={{
      flex: 'none', borderTop: '1px solid var(--line)',
      background: 'rgba(255,255,255,.92)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      padding: '7px 6px calc(7px + env(safe-area-inset-bottom))',
    }}>
      {ITEMS.map(it => {
        const active = it.paths.some(p => pathname === p || pathname.startsWith(p + '/'));
        return (
          <button
            key={it.key}
            onClick={() => router.push(it.primary)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '5px 0',
              color: active ? 'var(--navy)' : 'var(--faint)',
            }}
          >
            <div style={{ position: 'relative', display: 'flex' }}>
              <Icon name={it.icon} size={23} stroke={active ? 2.4 : 2} />
              {active && (
                <span style={{
                  position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'var(--navy)',
                }} />
              )}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600, letterSpacing: '.01em' }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
