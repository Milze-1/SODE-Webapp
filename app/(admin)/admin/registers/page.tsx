'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar, StatusPill, ProgressBar, PillarChip, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, AdminSearch } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

interface GoalRow {
  id: string;
  title: string;
  pillar: string | null;
  status: string;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string | null;
  member: { id: string; name: string; email: string; auth_id: string } | null;
}

const STATUS_MAP: Record<string, 'ontrack' | 'atrisk' | 'behind' | 'done'> = {
  on_track: 'ontrack',
  ontrack: 'ontrack',
  at_risk: 'atrisk',
  atrisk: 'atrisk',
  behind: 'behind',
  completed: 'done',
  done: 'done',
};

const STATUS_LABELS: Record<string, string> = {
  on_track: 'On track', ontrack: 'On track',
  at_risk: 'At risk', atrisk: 'At risk',
  behind: 'Behind',
  completed: 'Done', done: 'Done',
};


function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDue(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: '—', overdue: false };
  const d = new Date(iso);
  const overdue = d < new Date();
  const text = overdue ? 'Overdue' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { text, overdue };
}

export default function RegistersPage() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pillarFilter, setPillarFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState<{ id: string; name: string } | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalRow | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const loadGoals = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('goals')
      .select('id,title,pillar,status,current_value,target_value,unit,due_date,created_at,updated_at,member:members!member_id(id,name,email,auth_id)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('loadGoals error:', error);
      setLoading(false);
      return;
    }
    setGoals((data ?? []) as unknown as GoalRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGoals();
    const supabase = createClient();
    const channel = supabase.channel('admin-registers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, loadGoals)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadGoals]);

  const exportCsv = () => {
    const rows = filtered.map(g => [
      g.member?.name ?? '—', g.member?.email ?? '—', g.title,
      g.pillar ?? '—', STATUS_LABELS[g.status] ?? g.status,
      g.current_value ?? 0, g.target_value ?? 0, g.unit ?? '',
      g.due_date ?? '—', relativeTime(g.updated_at ?? g.created_at),
    ]);
    const header = ['Member', 'Email', 'Goal', 'Pillar', 'Status', 'Current', 'Target', 'Unit', 'Due Date', 'Last Updated'];
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'goals-export.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV ✓', 'check');
  };

  const filtered = goals.filter(g => {
    if (memberFilter && g.member?.id !== memberFilter.id) return false;
    if (pillarFilter !== 'all' && g.pillar !== pillarFilter) return false;
    const normalStatus = STATUS_MAP[g.status] ?? g.status;
    if (statusFilter !== 'all' && normalStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (g.member?.name ?? '').toLowerCase().includes(q) || g.title.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <AdminTopbar
        title="Registers"
        subtitle="Goal tracking across all members"
        actions={
          <button onClick={exportCsv} className="btn btn-ghost btn-sm">
            <Icon name="download" size={15} /> Export CSV
          </button>
        }
      />
      <AdminBody>
        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <AdminSearch value={search} onChange={setSearch} placeholder="Search member or goal…" />
          <select
            value={pillarFilter}
            onChange={e => setPillarFilter(e.target.value)}
            style={{ height: 36, borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--surface)', padding: '0 12px', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">All pillars</option>
            {['spiritual', 'career', 'business', 'character'].map(p => (
              <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ height: 36, borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--surface)', padding: '0 12px', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">All statuses</option>
            <option value="ontrack">On track</option>
            <option value="atrisk">At risk</option>
            <option value="behind">Behind</option>
            <option value="done">Completed</option>
          </select>
          <div style={{ flex: 1 }} />
          <span className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{filtered.length} goal{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Member filter pill */}
        {memberFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: 'var(--navy-tint)', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>Showing goals for <strong>{memberFilter.name}</strong></span>
            <button
              type="button"
              onClick={() => setMemberFilter(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--navy)', background: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              <Icon name="x" size={14} color="var(--navy)" /> Clear
            </button>
          </div>
        )}

        <Panel pad={false}>
          {loading ? (
            <div style={{ padding: '28px 16px', color: 'var(--muted)', fontSize: 13 }}>Loading goals…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {goals.length === 0 ? 'No goals found. Members will appear here once they set goals.' : 'No goals match the current filters.'}
            </div>
          ) : (
            <>
              <THead cols={['Member', 'Goal', 'Pillar', 'Progress', 'Status', 'Due', 'Updated']} template="1.2fr 1.5fr .7fr 1.2fr .7fr .6fr .6fr" />
              {filtered.map(g => {
                const due = fmtDue(g.due_date);
                const normalStatus = STATUS_MAP[g.status] ?? 'behind';
                const pct = g.target_value ? ((g.current_value ?? 0) / g.target_value) : 0;
                return (
                  <TRow key={g.id} template="1.2fr 1.5fr .7fr 1.2fr .7fr .6fr .6fr" onClick={() => setSelectedGoal(g)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={g.member?.name ?? '—'} size={26} tone="grey" />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setMemberFilter(g.member ? { id: g.member.id, name: g.member.name } : null); }}
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', background: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--navy)')}
                        onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                      >
                        {g.member?.name ?? '—'}
                      </button>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{g.title}</span>
                    <div>{g.pillar ? <PillarChip pillar={g.pillar} size="sm" /> : <span style={{ color: 'var(--faint)' }}>—</span>}</div>
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <ProgressBar value={Math.min(pct, 1)} height={5} />
                      </div>
                      <span className="tnum" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {g.current_value ?? 0} / {g.target_value ?? '—'}{g.unit ? ` ${g.unit}` : ''}
                      </span>
                    </div>
                    <StatusPill status={normalStatus} size="sm" />
                    <span className="tnum" style={{ fontSize: 12, color: due.overdue ? '#c53030' : 'var(--muted)', fontWeight: due.overdue ? 700 : 400 }}>
                      {due.text}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--faint)' }}>{relativeTime(g.updated_at ?? g.created_at)}</span>
                  </TRow>
                );
              })}
            </>
          )}
        </Panel>
      </AdminBody>

      {/* Goal detail drawer */}
      {selectedGoal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }} onClick={() => setSelectedGoal(null)}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,.35)' }} />
          <div
            style={{ width: 420, background: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sh-pop)', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{selectedGoal.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Goal detail</div>
              </div>
              <button onClick={() => setSelectedGoal(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                <Icon name="x" size={17} />
              </button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar name={selectedGoal.member?.name ?? '—'} size={38} tone="soft" />
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{selectedGoal.member?.name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedGoal.member?.email ?? '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {selectedGoal.pillar && <PillarChip pillar={selectedGoal.pillar} size="sm" />}
                <StatusPill status={STATUS_MAP[selectedGoal.status] ?? 'behind'} size="sm" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Progress</div>
                <ProgressBar value={selectedGoal.target_value ? Math.min((selectedGoal.current_value ?? 0) / selectedGoal.target_value, 1) : 0} height={8} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  <span className="tnum" style={{ fontSize: 24, fontWeight: 800 }}>{selectedGoal.current_value ?? 0}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ {selectedGoal.target_value ?? '—'}{selectedGoal.unit ? ` ${selectedGoal.unit}` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { l: 'Due date', v: fmtDue(selectedGoal.due_date).text },
                  { l: 'Last updated', v: relativeTime(selectedGoal.updated_at ?? selectedGoal.created_at) },
                  { l: 'Created', v: relativeTime(selectedGoal.created_at) },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{item.l}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
