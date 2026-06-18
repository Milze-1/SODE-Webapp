'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';

const NAV = [
  { href: '/member/home',        icon: 'home',          label: 'Dashboard'    },
  { href: '/member/goals',       icon: 'target',        label: 'My Goals'     },
  { href: '/member/forms',       icon: 'list',          label: 'Forms'        },
  { href: '/member/learning',    icon: 'bookopen',      label: 'Learn'        },
  { href: '/member/mentorship',  icon: 'heart',         label: 'Mentorship'   },
  { href: '/member/attendance',  icon: 'calendarclock', label: 'Attendance'   },
  { href: '/member/invite',      icon: 'userplus',      label: 'Invite & Earn'},
  { href: '/member/leaderboard', icon: 'trophy',        label: 'Leaderboard'  },
  { href: '/member/share',       icon: 'share',         label: 'Share'        },
  { href: '/member/profile',     icon: 'user',          label: 'Profile'      },
];

export default function MemberSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState('');
  const [points, setPoints] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: member } = await supabase
          .from('members')
          .select('id, name, points')
          .eq('auth_id', user.id)
          .maybeSingle();
        if (!member) return;
        if (member.name) setName(member.name);
        const [{ data: balance }, { data: roleRow }] = await Promise.all([
          supabase.from('user_points_balance').select('total_points').eq('member_id', member.id).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
        ]);
        setPoints(balance?.total_points ?? member.points ?? 0);
        if (roleRow?.role && String(roleRow.role).includes('admin')) setIsAdmin(true);
      } catch { /* keep defaults */ }
    })();
  }, []);

  return (
    <aside className="member-sidebar" style={{ padding: '18px 12px' }}>
      <div className="px-4 py-3 border-b border-gray-100">
        <Image src="/images/sode-primary-logo.png" alt="SODE" width={120} height={48} className="object-contain" />
      </div>

      <nav className="noscroll" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
        {NAV.map(n => {
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
          <Avatar name={name || 'M'} size={34} tone="grey" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'Member'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }} className="tnum">{points} pts</div>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="btn btn-ghost btn-sm btn-block"
            style={{ marginTop: 10 }}
          >
            <Icon name="grid" size={15} /> Switch to Admin
          </button>
        )}
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push('/login');
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 34, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 12.5, fontWeight: 600, marginTop: 6 }}
        >
          <Icon name="logout" size={14} color="var(--faint)" /> Sign out
        </button>
      </div>
    </aside>
  );
}
