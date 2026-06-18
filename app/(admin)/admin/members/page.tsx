'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, PillarChip, StatusPill } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, AdminSearch, Panel, THead, TRow, Skeleton } from '@/components/admin/chrome';

interface MemberRow {
  id: string; name: string; email: string | null; whatsapp: string | null; pillar: string | null;
  life_stage: string | null; department: string | null; is_leader: boolean | null;
  onboarding_complete: boolean; created_at: string; updated_at: string | null;
  points: number | null; auth_id: string | null;
}
interface GoalRow { id: string; title: string; status: string; }
interface WinRow { id: string; title: string; created_at: string; }
interface AttRow { id: string; status: string; sessions: { title: string; date: string } | null; }
interface FollowUpRow { id: string; name: string; created_at: string; attendanceCount: number; whatsapp: string | null; }
interface CellRow { id: string; name: string; meeting_schedule: string | null; member_count: number; }

const SEGMENTS = ['All members', 'First-timers', 'No cert yet', 'High NPS', 'Business owners', 'Overdue check-in'];

function relTime(iso: string | null) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const qBtn = (danger?: boolean): React.CSSProperties => ({
  width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
  background: danger ? '#dc2626' : 'var(--surface)',
  border: danger ? 'none' : '1px solid var(--line-2)',
  color: danger ? '#fff' : 'var(--navy)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

export default function MembersPage() {
  const [loading, setLoading]           = useState(true);
  const [members, setMembers]           = useState<MemberRow[]>([]);
  const [seg, setSeg]                   = useState('All members');
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [search, setSearch]             = useState('');
  const [selMember, setSelMember]       = useState<MemberRow | null>(null);
  const [memberGoals, setMemberGoals]   = useState<GoalRow[]>([]);
  const [memberWins, setMemberWins]     = useState<WinRow[]>([]);
  const [memberAtt, setMemberAtt]       = useState<AttRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab]       = useState<'goals' | 'wins' | 'attendance' | 'checkins'>('goals');
  const [error, setError]               = useState(false);
  const [followUps, setFollowUps]       = useState<FollowUpRow[]>([]);

  // Admin context
  const [adminName, setAdminName]       = useState('Admin');
  const [canDelete, setCanDelete]       = useState(false);

  // Toast
  const [toast, setToast]               = useState<string | null>(null);
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [clearModal, setClearModal]     = useState(false);
  const [cells, setCells]               = useState<CellRow[]>([]);
  const [cellsLoaded, setCellsLoaded]   = useState(false);
  const [cellsLoading, setCellsLoading] = useState(false);
  const [cellModal, setCellModal]       = useState<{ open: boolean; followUp: FollowUpRow | null }>({ open: false, followUp: null });
  const [delModal, setDelModal]         = useState<{ open: boolean; member: MemberRow | null; nameInput: string; deleting: boolean }>({
    open: false, member: null, nameInput: '', deleting: false,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();

        // Load admin identity + role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: adminRow } = await supabase.from('members').select('name').eq('auth_id', user.id).maybeSingle();
          if (adminRow?.name) setAdminName(adminRow.name);
          const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
          const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
          setCanDelete(roles.includes('director') || roles.includes('data_ops_lead'));
        }

        const { data } = await supabase
          .from('members')
          .select('id,name,email,whatsapp,pillar,life_stage,department,is_leader,onboarding_complete,created_at,updated_at,points,auth_id')
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
              .map(m => ({ id: m.id, name: m.name, created_at: m.created_at, attendanceCount: counts.get(m.id) ?? 0, whatsapp: m.whatsapp })),
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

  // ─── First-timer queue actions ──────────────────────────────────────────────

  const markContacted = async (f: FollowUpRow) => {
    const supabase = createClient();
    await supabase.from('members').update({
      first_timer_source: 'leader_marked',
      notes: `Contacted by ${adminName} on ${new Date().toLocaleDateString()}`,
    }).eq('id', f.id);
    setFollowUps(fs => fs.filter(x => x.id !== f.id));
    showToast(`${f.name} marked as contacted ✓`);
  };

  const openWhatsApp = (f: FollowUpRow) => {
    if (!f.whatsapp) {
      showToast(`No WhatsApp number on file for ${f.name}`);
      return;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thesode.org';
    const message = encodeURIComponent(
      `Hi ${f.name}! 👋\n\nWelcome to SODE — The School of Daniels & Esthers.\n\nWe noticed you recently joined and wanted to reach out personally.\n\nPlease complete your profile at:\n${appUrl}/member/onboarding\n\n— SODE Leadership Team`,
    );
    window.open(`https://wa.me/${f.whatsapp.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const openCellModal = async (f: FollowUpRow) => {
    setCellModal({ open: true, followUp: f });
    if (!cellsLoaded) {
      setCellsLoading(true);
      const supabase = createClient();
      const { data: cellData } = await supabase.from('cells').select('id,name,meeting_schedule').eq('is_active', true).order('name');
      const cellIds = (cellData ?? []).map((c: { id: string }) => c.id);
      const countsMap: Record<string, number> = {};
      if (cellIds.length > 0) {
        const { data: cmData } = await supabase.from('cell_members').select('cell_id').in('cell_id', cellIds);
        (cmData ?? []).forEach((cm: { cell_id: string }) => { countsMap[cm.cell_id] = (countsMap[cm.cell_id] ?? 0) + 1; });
      }
      setCells((cellData ?? []).map((c: { id: string; name: string; meeting_schedule: string | null }) => ({
        id: c.id, name: c.name, meeting_schedule: c.meeting_schedule, member_count: countsMap[c.id] ?? 0,
      })));
      setCellsLoaded(true);
      setCellsLoading(false);
    }
  };

  const assignToCell = async (cellId: string, cellName: string) => {
    const f = cellModal.followUp;
    if (!f) return;
    const supabase = createClient();
    await supabase.from('cell_members').insert({ cell_id: cellId, member_id: f.id });
    setCellModal({ open: false, followUp: null });
    showToast(`${f.name} added to ${cellName} ✓`);
  };

  const removeFromQueue = async (f: FollowUpRow) => {
    const supabase = createClient();
    await supabase.from('members').update({ is_first_timer: false }).eq('id', f.id);
    setFollowUps(fs => fs.filter(x => x.id !== f.id));
    showToast(`${f.name} removed from queue`);
  };

  const clearAllFirstTimers = async () => {
    const supabase = createClient();
    const ids = followUps.map(f => f.id);
    await supabase.from('members').update({ is_first_timer: false }).in('id', ids);
    const count = followUps.length;
    setFollowUps([]);
    setClearModal(false);
    showToast(`${count} member${count !== 1 ? 's' : ''} cleared from first-timer queue`);
  };

  // ─── Delete member ──────────────────────────────────────────────────────────

  const deleteMember = async () => {
    const m = delModal.member;
    if (!m || delModal.nameInput !== m.name) return;
    setDelModal(d => ({ ...d, deleting: true }));
    try {
      const res = await fetch('/api/admin/delete-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.id, authId: m.auth_id }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? 'Delete failed — try again');
        setDelModal(d => ({ ...d, deleting: false }));
        return;
      }
      setMembers(ms => ms.filter(x => x.id !== m.id));
      setFollowUps(fs => fs.filter(x => x.id !== m.id));
      setDelModal({ open: false, member: null, nameInput: '', deleting: false });
      setSelMember(null);
      showToast(`${m.name}'s account has been permanently deleted`);
    } catch {
      showToast('Delete failed — try again');
      setDelModal(d => ({ ...d, deleting: false }));
    }
  };

  // ─── Derived display list ────────────────────────────────────────────────────

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
            {/* First-timer follow-up queue */}
            {followUps.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <Panel
                  title="First-timer follow-up queue"
                  action={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{followUps.length} open</span>
                      <button
                        onClick={() => setClearModal(true)}
                        style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 7, border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer' }}
                      >
                        Clear all ({followUps.length})
                      </button>
                    </div>
                  }
                  pad={false}
                >
                  <THead cols={['New face', 'Member since', 'Check-ins', 'Quick actions']} template="1.4fr 1fr .8fr 1.2fr" />
                  {followUps.map(f => (
                    <TRow key={f.id} template="1.4fr 1fr .8fr 1.2fr">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={f.name} size={28} tone="soft" />
                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                      </div>
                      <span className="tnum" style={{ color: 'var(--muted)' }}>{relTime(f.created_at)}</span>
                      <span className="tnum" style={{ color: 'var(--muted)' }}>{f.attendanceCount}</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button style={qBtn()} title="Mark contacted" onClick={() => markContacted(f)}>
                          <Icon name="check" size={15} />
                        </button>
                        <button style={qBtn()} title="WhatsApp" onClick={() => openWhatsApp(f)}>
                          <Icon name="message" size={15} />
                        </button>
                        <button style={qBtn()} title="Assign to cell" onClick={() => openCellModal(f)}>
                          <Icon name="userplus" size={15} />
                        </button>
                        <button style={qBtn(true)} title="Remove from queue" onClick={() => removeFromQueue(f)}>
                          <Icon name="x" size={15} color="#fff" />
                        </button>
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

      {/* Member 360° drawer */}
      {selMember && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelMember(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.32)' }} />
          <div style={{ position: 'relative', width: 420, maxWidth: '90%', background: 'var(--bg)', height: '100%', boxShadow: '-12px 0 40px rgba(20,29,58,.16)', display: 'flex', flexDirection: 'column' }}>

            {/* Drawer header */}
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

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', padding: '0 16px' }}>
              {(['goals', 'wins', 'attendance', 'checkins'] as const).map(t => (
                <button key={t} onClick={() => setDrawerTab(t)} style={{ padding: '10px 12px', fontSize: 13, fontWeight: drawerTab === t ? 700 : 500, color: drawerTab === t ? 'var(--navy)' : 'var(--muted)', borderBottom: drawerTab === t ? '2px solid var(--navy)' : '2px solid transparent', marginBottom: -1, background: 'none', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Tab content */}
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

            {/* Delete account */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
              <button
                onClick={() => canDelete ? setDelModal({ open: true, member: selMember, nameInput: '', deleting: false }) : undefined}
                disabled={!canDelete}
                title={canDelete ? undefined : 'Only Directors and Data Ops can delete accounts'}
                style={{
                  width: '100%', padding: '9px 16px', borderRadius: 9, cursor: canDelete ? 'pointer' : 'not-allowed',
                  border: '1.5px solid #fca5a5', background: '#fff5f5', color: canDelete ? '#dc2626' : '#fca5a5',
                  fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <Icon name="trash" size={15} color={canDelete ? '#dc2626' : '#fca5a5'} />
                Delete member account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cell picker modal */}
      {cellModal.open && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setCellModal({ open: false, followUp: null })} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.42)' }} />
          <div style={{ position: 'relative', width: 360, background: 'var(--bg)', borderRadius: 16, boxShadow: '0 16px 48px rgba(20,29,58,.22)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Assign to cell</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Assigning: <strong>{cellModal.followUp?.name}</strong></div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {cellsLoading ? (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[40, 40, 40].map((h, i) => <Skeleton key={i} h={h} />)}
                </div>
              ) : cells.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No cells configured yet</div>
              ) : cells.map(c => (
                <button
                  key={c.id}
                  onClick={() => assignToCell(c.id, c.name)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', textAlign: 'left', background: 'transparent', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name="users" size={18} color="var(--navy)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      {c.member_count} member{c.member_count !== 1 ? 's' : ''}{c.meeting_schedule ? ` · ${c.meeting_schedule}` : ''}
                    </div>
                  </div>
                  <Icon name="chevronright" size={16} color="var(--faint)" />
                </button>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
              <button onClick={() => setCellModal({ open: false, followUp: null })} className="btn btn-ghost btn-block">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear all confirmation modal */}
      {clearModal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setClearModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.42)' }} />
          <div style={{ position: 'relative', width: 380, background: 'var(--bg)', borderRadius: 16, padding: '24px', boxShadow: '0 16px 48px rgba(20,29,58,.22)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Clear all first-timers from queue?</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 20 }}>
              This will mark all <strong>{followUps.length} first-timer{followUps.length !== 1 ? 's' : ''}</strong> as regular members. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setClearModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={clearAllFirstTimers}
                style={{ flex: 1, padding: '9px', borderRadius: 9, background: '#dc2626', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete member confirmation modal */}
      {delModal.open && delModal.member && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.55)' }} />
          <div style={{ position: 'relative', width: 420, background: 'var(--bg)', borderRadius: 16, padding: '24px', boxShadow: '0 20px 60px rgba(20,29,58,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff5f5', border: '2px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="info" size={20} color="#dc2626" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#dc2626' }}>Delete member account?</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.65 }}>
              This will permanently delete:
            </div>
            <ul style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.9, margin: '0 0 14px 18px', padding: 0 }}>
              <li><strong>{delModal.member.name}</strong>&apos;s account</li>
              <li>All their goals and milestones</li>
              <li>All their wins and points</li>
              <li>All their form responses</li>
              <li>All their attendance records</li>
            </ul>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff5f5', border: '1px solid #fca5a5', fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 16 }}>
              This CANNOT be undone.
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
              Type &ldquo;{delModal.member.name}&rdquo; to confirm:
            </div>
            <input
              type="text"
              value={delModal.nameInput}
              onChange={e => setDelModal(d => ({ ...d, nameInput: e.target.value }))}
              placeholder={delModal.member.name}
              autoFocus
              style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', fontSize: 14, padding: '0 12px', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDelModal({ open: false, member: null, nameInput: '', deleting: false })}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={deleteMember}
                disabled={delModal.nameInput !== delModal.member.name || delModal.deleting}
                style={{
                  flex: 1, padding: '9px', borderRadius: 9, border: 'none',
                  background: delModal.nameInput === delModal.member.name ? '#dc2626' : '#fca5a5',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: delModal.nameInput === delModal.member.name && !delModal.deleting ? 'pointer' : 'not-allowed',
                  transition: 'background .15s',
                }}
              >
                {delModal.deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin toast */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, background: 'var(--navy)', color: '#fff', fontSize: 13.5, fontWeight: 600, boxShadow: '0 8px 24px rgba(20,29,58,.25)', whiteSpace: 'nowrap', animation: 'sode-rise .25s ease', pointerEvents: 'none' }}>
          <Icon name="check" size={16} color="#fff" />
          {toast}
        </div>
      )}
    </>
  );
}
