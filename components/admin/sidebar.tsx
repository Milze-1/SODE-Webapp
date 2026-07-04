'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';

const ADMIN_NAV = [
  { href: '/admin/dashboard', icon: 'grid', label: 'Scorecard' },
  { href: '/admin/goals', icon: 'target', label: 'Pillar Goals' },
  { href: '/admin/members', icon: 'users', label: 'Members' },
  { href: '/admin/attendance', icon: 'calendarclock', label: 'Attendance' },
  { href: '/admin/forms', icon: 'list', label: 'Forms' },
  { href: '/admin/learning', icon: 'sparkles', label: 'Learning' },
  { href: '/admin/devotion', icon: 'heart',    label: 'Devotion'  },
  { href: '/admin/registers', icon: 'bookopen', label: 'Registers' },
  { href: '/admin/mentorship', icon: 'heart', label: 'Mentorship' },
  { href: '/admin/growth', icon: 'trendingup', label: 'Growth' },
  { href: '/admin/reports', icon: 'download', label: 'Reports' },
  { href: '/admin/advocacy', icon: 'share', label: 'Advocacy' },
  { href: '/admin/settings', icon: 'settings', label: 'Settings' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminName, setAdminName] = useState('Admin');
  const [adminRole, setAdminRole] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: member }, { data: roleRow }] = await Promise.all([
          supabase.from('members').select('name').eq('auth_id', user.id).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
        ]);
        if (member?.name) setAdminName(member.name);
        if (roleRow?.role) setAdminRole((roleRow.role as string).replace(/_/g, ' '));
      } catch { /* keep defaults */ }
    })();
  }, []);

  return (
    <aside style={{ width: 230, flex: 'none', background: 'var(--bg)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>
      <div className="px-4 py-3 border-b border-gray-100">
        <Image src="/images/sode-primary-logo.png" alt="SODE" width={120} height={48} className="object-contain" />
      </div>

      <nav className="slim-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {ADMIN_NAV.map(n => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 11px', borderRadius: 10, cursor: 'pointer',
                background: active ? 'var(--navy)' : 'transparent',
                color: active ? '#fff' : 'var(--ink-2)',
                fontWeight: active ? 700 : 600, fontSize: 13.5, textDecoration: 'none',
                transition: 'background .12s, color .12s',
              }}
            >
              <Icon name={n.icon} size={18} stroke={2} color={active ? '#fff' : 'var(--muted)'} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '12px 8px 0', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={adminName} size={34} tone="grey" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{adminRole || 'Admin'}</div>
          </div>
        </div>
        <button
          onClick={() => router.push('/member/home')}
          className="btn btn-ghost btn-sm btn-block"
          style={{ marginTop: 10 }}
        >
          <Icon name="user" size={15} /> Switch to Member
        </button>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push('/login');
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 38, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#dc2626', fontSize: 13, fontWeight: 700, marginTop: 6 }}
        >
          <Icon name="logout" size={15} color="#dc2626" /> Sign out
        </button>
      </div>
    </aside>
  );
}
