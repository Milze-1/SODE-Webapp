'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { EmptyState, StatusPill } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface RecordRow {
  id: string; session_id: string; status: string; checked_in_at: string | null;
  sessions: { title: string; scheduled_at: string; location: string | null } | null;
}

const statusMeta: Record<string, { label: string; s: 'done' | 'atrisk' | 'behind' }> = {
  present: { label: 'Present', s: 'done' },
  excused: { label: 'Excused', s: 'atrisk' },
  absent:  { label: 'Missed',  s: 'behind' },
};

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<RecordRow[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getAuthUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const { data } = await supabase
        .from('attendance_records')
        .select('id,session_id,status,checked_in_at,sessions(title,scheduled_at,location)')
        .eq('member_id', memberRow.id)
        .order('checked_in_at', { ascending: false });

      setHistory((data ?? []) as unknown as RecordRow[]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[56, 68, 68, 68, 68].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--navy)', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="arrowleft" size={18} /> Back
          </button>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Attendance history</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{history.length} session{history.length === 1 ? '' : 's'} recorded</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {history.length === 0 ? (
            <EmptyState icon="calendarclock" title="No sessions yet" body="Your attendance history will appear here." />
          ) : (
            history.map(r => {
              const m = statusMeta[r.status] ?? statusMeta.absent;
              const s = r.sessions;
              return (
                <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name="calendarclock" size={18} stroke={2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s?.title ?? 'Session'}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                      {s?.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                  </div>
                  <StatusPill status={m.s} size="sm" />
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
