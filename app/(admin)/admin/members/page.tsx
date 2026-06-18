'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, PillarChip, StatusPill } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, AdminSearch, Panel, THead, TRow, Skeleton } from '@/components/admin/chrome';

interface MemberRow {
  id: string; name: string; email: string | null; whatsapp: string | null; pillar: string | null;
  life_stage: string | null; department: string | null; is_leader: boolean | null;
  onboarding_complete: boolean; created_at: string; updated_at: string | null;
  points: number | null;
}
interface GoalRow { id: string; title: string; status: string; }
interface WinRow { id: string; title: string; created_at: string; }
interface AttRow { id: string; status: string; sessions: { title: string; date: string } | null; }
interface FollowUpRow { id: string; name: string; created_at: string; attendanceCount: number; }

const SEGMENTS = ['All members', 'First-timers', 'No cert yet', 'High NPS', 'Business owners', 'Overdue check-in'];

function relTime(iso: string | null) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function MembersPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [seg, setSeg] = useState('All members');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selMember, setSelMember] = useState<MemberRow | null>(null);
  const [memberGoals, setMemberGoals] = useState<GoalRow[]>([]);
  const [memberWins, setMemberWins] = useState<WinRow[]>([]);
  const [memberAtt, setMemberAtt] = useState<AttRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'goals' | 'wins' | 'attendance' | 'checkins'>('goals');
  const [error, setError] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('members')
          .select('id,name,email,whatsapp,pillar,life_stage,department,is_leader,onboarding_complete,created_at,updated_at,points')
          .order('created_at', { ascending: false });
        const rows = (data ?? []) as MemberRow[];
        setMembers(rows);

        const cutoff = Date.now() - 30 * 86400000;
        const recent = rows.filter(m => new Date(m.created_at).getTime() > cutoff);
        if (recent.length > 0) {
          const { data: attRows } = await supabase
            .from('attendance_records')
            .select('member_id')
            .in('member_id', recent.map(m => m.id));
          const counts = new Map<string, number>();
          ((attRows ?? []) as { member_id: string }[]).forEach(r => counts.set(r.member_id, (counts.get(r.member_id) ?? 0) + 1));
          setFollowUps(
            recent
              .filter(m => (counts.get(m.id) ?? 0) < 3)
              .map(m => ({ id: m.id, name: m.name, created_at: m.created_at, attendanceCount: counts.get(m.id) ?? 0 })),
          );
        }
      } catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  const isFirstTimer = (m: MemberRow) =>
    Date.now() - new Date(m.created_at).getTime() < 30 * 86400000 && !m.onboarding_complete;

  const openMember = async (m: MemberRow) => {
    setSelMember(m);
    setDrawerTab('goals');
    setDrawerLoading(true);
    try {
      const supabase = createClient();
      const [goalsRes, winsRes, attRes] = await Promise.all([
        supabase.from('goals').select('id,title,status').eq('member_id', m.id).limit(10),
        supabase.from('wins').select('id,title,created_at').eq('member_id', m.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('attendance_records').select('id,status,sessions:session_id(title,date)').eq('member_id', m.id).limit(10),
      ]);
      setMemberGoals((goalsRes.data ?? []) as GoalRow[]);
      setMemberWins((winsRes.data ?? []) as WinRow[]);
      setMemberAtt((attRes.data ?? []) as unknown as AttRow[]);
    } catch { /* show empty */ }
    finally { setDrawerLoading(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const displayed = members.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !(m.email ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (seg === 'First-timers') return isFirstTimer(m);
    if (seg === 'Business owners') return m.pillar === 'business';
    if (seg === 'Overdue check-in') return !m.updated_at || Date.now() - new Date(m.updated_at).getTime() > 14 * 86400000;
    return true;
  });

  const firstTimersCount = members.filter(isFirstTimer).length;

  const exportCsv = () => {
    const rows = [['Name', 'Email', 'Pillar', 'Department', 'Leader', 'Updated'], ...displayed.map(m => [m.name, m.email ?? '', m.pillar ?? '', m.department ?? '', m.is_leader ? 'Yes' : 'No', relTime(m.updated_at)])];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const MEM_COL = '1.8fr .7fr .8fr .8fr .6fr';

  return (
    <>
      <AdminTopbar
        title="Members"
        subtitle={`${members.length} total · ${firstTimersCount} first-timer${firstTimersCount !== 1 ? 's' : ''} this week`}
        actions={
          <>
            <AdminSearch value={search} onChange={setSearch} placeholder="Search members…" />
            <button onClick={exportCsv} className="btn btn-ghost btn-sm"><Icon name="download" size={16} /> Export</button>
          </>
        }
      />
      <AdminBody>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--r-sm)', background: '#fff3f3', border: '1px solid #ffc5c5', color: '#c0392b', fontSize: 13, marginBottom: 16 }}>
            <Icon name="info" size={16} /> Could not load members
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[60, 48, 48, 48, 48].map((h, i) => <Skeleton key={i} h={h} />)}
          </div>
        ) : (
          <>
            {/* First-timer queue */}
            {followUps.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <Panel title="First-timer follow-up queue" action={<span style={{ fontSize: 12, color: 'var(--muted)' }}>{followUps.length} open</span>} pad={false}>
                  <THead cols={['New face', 'Member since', 'Check-ins', 'Quick actions']} template="1.4fr 1fr .8fr 1fr" />
                  {followUps.map(f => (
                    <TRow key={f.id} template="1.4fr 1fr .8fr 1fr">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={f.name} size={28} tone="soft" />
                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                      </div>
                      <span className="tnum" style={{ color: 'var(--muted)' }}>{relTime(f.created_at)}</span>
                      <span className="tnum" style={{ color: 'var(--muted)' }}>{f.attendanceCount}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Mark contacted"><Icon name="check" size={15} /></button>
                        <button style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="WhatsApp"><Icon name="message" size={15} /></button>
                        <button style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Plug into dept"><Icon name="users" size={15} /></button>
                      </div>
                    </TRow>
                  ))}
                </Panel>
              </div>
            )}

            {/* Segment chips */}
            <div style={{ display: 'flex', gap: 8, margin: '0 0 14px', flexWrap: 'wrap' }}>
              {SEGMENTS.map(s => <FilterChip key={s} active={seg === s} label={s} onClick={() => setSeg(s)} />)}
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--navy)', color: '#fff', marginBottom: 12 }}>
                <span className="tnum" style={{ fontWeight: 700 }}>{selected.size} selected</span>
                <div style={{ flex: 1 }} />
                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                  <Icon name="message" size={15} color="#fff" /> Message
                </button>
                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                  <Icon name="flag" size={15} color="#fff" /> Assign
                </button>
              </div>
            )}

            {/* Members table */}
            <Panel pad={false}>
              <THead cols={['Member', 'Pillar stage', 'Department', 'Role', 'Updated']} template={MEM_COL} />
              {displayed.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No members match your filter</div>
              ) : displayed.map(m => (
                <TRow key={m.id} template={MEM_COL} onClick={() => openMember(m)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span onClick={e => { e.stopPropagation(); toggleSelect(m.id); }} style={{ width: 18, height: 18, borderRadius: 5, flex: 'none', border: selected.has(m.id) ? 'none' : '1.5px solid var(--line-2)', background: selected.has(m.id) ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected.has(m.id) && <Icon name="check" size={12} stroke={3} color="#fff" />}
                    </span>
                    <Avatar name={m.name} size={30} tone="grey" />
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    {isFirstTimer(m) && <span style={{ flex: 'none', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'var(--navy)', color: '#fff', whiteSpace: 'nowrap' }}>FIRST-TIMER</span>}
                  </div>
                  {m.pillar
                    ? <PillarChip pillar={m.pillar} size="sm" />
                    : <span style={{ color: 'var(--faint)', fontSize: 12 }}>{m.life_stage?.replace(/_/g, ' ') ?? '—'}</span>}
                  <span style={{ color: m.department ? 'var(--ink)' : 'var(--faint)' }}>{m.department ?? '—'}</span>
                  {m.is_leader
                    ? <span style={{ fontWeight: 600, color: 'var(--navy)' }}>Leader</span>
                    : <span style={{ color: 'var(--muted)' }}>Member</span>}
                  <span className="tnum" style={{ color: 'var(--muted)' }}>{relTime(m.updated_at)}</span>
                </TRow>
              ))}
            </Panel>
          </>
        )}
      </AdminBody>

      {/* Member detail drawer */}
      {selMember && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelMember(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.32)' }} />
          <div style={{ position: 'relative', width: 420, maxWidth: '90%', background: 'var(--bg)', height: '100%', boxShadow: '-12px 0 40px rgba(20,29,58,.16)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={selMember.name} size={48} tone="grey" />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{selMember.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{selMember.email ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{selMember.whatsapp ?? '—'}</div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                    {selMember.pillar && <PillarChip pillar={selMember.pillar} size="sm" />}
                    {selMember.points != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{selMember.points} pts</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelMember(null)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flex: 'none' }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', padding: '0 16px' }}>
              {(['goals', 'wins', 'attendance', 'checkins'] as const).map(t => (
                <button key={t} onClick={() => setDrawerTab(t)} style={{ padding: '10px 12px', fontSize: 13, fontWeight: drawerTab === t ? 700 : 500, color: drawerTab === t ? 'var(--navy)' : 'var(--muted)', borderBottom: drawerTab === t ? '2px solid var(--navy)' : '2px solid transparent', marginBottom: -1, background: 'none', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
            <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {drawerLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[36, 36, 36].map((h, i) => <Skeleton key={i} h={h} />)}
                </div>
              ) : (
                <>
                  {drawerTab === 'goals' && (memberGoals.length === 0
                    ? <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No goals yet</div>
                    : memberGoals.map(g => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{g.title}</div>
                        <StatusPill status={g.status === 'done' ? 'done' : g.status === 'active' ? 'ontrack' : 'atrisk'} size="sm" />
                      </div>
                    ))
                  )}
                  {drawerTab === 'wins' && (memberWins.length === 0
                    ? <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No wins yet</div>
                    : memberWins.map(w => (
                      <div key={w.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{w.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                    ))
                  )}
                  {drawerTab === 'attendance' && (memberAtt.length === 0
                    ? <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No attendance records</div>
                    : memberAtt.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.sessions?.title ?? 'Session'}</div>
                        <StatusPill status={a.status === 'present' ? 'done' : a.status === 'excused' ? 'atrisk' : 'behind'} size="sm" />
                      </div>
                    ))
                  )}
                  {drawerTab === 'checkins' && (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No 1:1 notes yet</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
