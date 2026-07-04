'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, SectionHead, EmptyState } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface CheckInRow {
  id: string; notes: string | null; follow_up_action: string | null;
  follow_up_due_date: string | null; follow_up_done: boolean; created_at: string;
  leaders: { name: string } | null;
}

export default function CheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<CheckInRow[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getAuthUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const { data } = await supabase
        .from('check_ins')
        .select('id,notes,follow_up_action,follow_up_due_date,follow_up_done,created_at,leaders:leader_id(name)')
        .eq('member_id', memberRow.id)
        .order('created_at', { ascending: false });

      setCheckIns((data ?? []) as unknown as CheckInRow[]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[56, 100, 100, 100].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--navy)', fontWeight: 600, fontSize: 13 }}>
            <Icon name="arrowleft" size={18} /> Back
          </button>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>1:1 Check-ins</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Notes from your leader</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionHead title="Session notes" />

          {checkIns.length === 0 ? (
            <EmptyState icon="users" title="No notes yet" body="Your leader&apos;s notes from 1:1 sessions will appear here once they&apos;ve been recorded." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {checkIns.map(ci => (
                <div key={ci.id} className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: ci.notes ? 10 : 0 }}>
                    <Avatar name={ci.leaders?.name ?? 'Leader'} size={36} tone="soft" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{ci.leaders?.name ?? 'Your leader'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                        {new Date(ci.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {ci.notes && <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)', marginBottom: ci.follow_up_action ? 10 : 0 }}>{ci.notes}</div>}

                  {ci.follow_up_action && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: ci.follow_up_done ? 'var(--navy-tint)' : 'var(--surface-2)' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, flex: 'none', marginTop: 1, background: ci.follow_up_done ? 'var(--navy)' : '#fff', border: ci.follow_up_done ? 'none' : '1.5px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {ci.follow_up_done && <Icon name="check" size={13} stroke={3} color="#fff" />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: ci.follow_up_done ? 'var(--faint)' : 'var(--ink)', textDecoration: ci.follow_up_done ? 'line-through' : 'none' }}>{ci.follow_up_action}</div>
                        {ci.follow_up_due_date && (
                          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                            Due {new Date(ci.follow_up_due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
