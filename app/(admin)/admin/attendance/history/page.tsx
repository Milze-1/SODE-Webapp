'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/sode/icons';
import { AdminTopbar, AdminBody, Panel, THead, TRow } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

interface SessionRow {
  id: string; title: string; type: string; location: string | null;
  scheduled_at: string; expected_count: number | null; is_live: boolean; pillar: string | null;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sessions')
      .select('id,title,type,location,scheduled_at,expected_count,is_live,pillar')
      .order('scheduled_at', { ascending: false });
    setSessions((data ?? []) as SessionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date().toISOString();
  const filtered = sessions.filter(s => !search.trim() || s.title.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <AdminTopbar
        title="All sessions"
        subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'} on record`}
        actions={
          <button onClick={() => router.push('/admin/attendance')} className="btn btn-ghost btn-sm">
            <Icon name="arrowleft" size={15} /> Back to Attendance
          </button>
        }
      />
      <AdminBody>
        <Panel
          pad={false}
          action={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 11px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)' }}>
              <Icon name="search" size={14} color="var(--faint)" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sessions…"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--ink)', width: 160 }}
              />
            </div>
          }
        >
          {loading ? (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {search ? `No sessions match "${search}".` : 'No sessions found.'}
            </div>
          ) : (
            <>
              <THead cols={['Session', 'Type', 'Date', 'State', 'Expected']} template="1.6fr .9fr .9fr .7fr .7fr" />
              {filtered.map(s => {
                const state = s.is_live ? 'LIVE' : s.scheduled_at > now ? 'UPCOMING' : 'PAST';
                const stateColor = state === 'PAST' ? 'var(--faint)' : state === 'LIVE' ? 'var(--navy)' : 'var(--ink-2)';
                return (
                  <TRow key={s.id} template="1.6fr .9fr .9fr .7fr .7fr" onClick={() => router.push(`/admin/attendance?session=${s.id}`)}>
                    <span style={{ fontWeight: 600 }}>{s.title}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{s.type?.replace('_', ' ')}</span>
                    <span className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fmtDate(s.scheduled_at)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: stateColor }}>{state}</span>
                    <span className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.expected_count ?? '—'}</span>
                  </TRow>
                );
              })}
            </>
          )}
        </Panel>
      </AdminBody>
    </>
  );
}
