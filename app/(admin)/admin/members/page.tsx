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

  // Admin context
  const [canDelete, setCanDelete]       = useState(false);

  // Toast
  const [toast, setToast]               = useState<string | null>(null);
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete modal
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

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
          const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
          setCanDelete(roles.includes('director') || roles.includes('data_ops_lead'));
        }

        const { data } = await supabase
          .from('members')
          .select('id,name,email,whatsapp,pillar,life_stage,department,is_leader,onboarding_complete,created_at,updated_at,points,auth_id')
          .order('created_at', { ascending: false });
        setMembers((data ?? []) as MemberRow[]);
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

  // ─── Convert first-timer → full member ─────────────────────────────────────

  const [converting, setConverting] = useState<string | null>(null);

  const convertToMember = async (m: MemberRow) => {
    if (converting) return;
    setConverting(m.id);
    try {
      // Server-side with the admin client — RLS blocks admins updating other
      // members' rows directly from the browser.
      const res = await fetch('/api/admin/convert-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Convert failed');
      const updated = { ...m, onboarding_complete: true, updated_at: new Date().toISOString() };
      setMembers(ms => ms.map(x => x.id === m.id ? updated : x));
      setSelMember(s => (s && s.id === m.id ? updated : s));
      showToast(`${m.name} is now a full member 🎉`);
    } catch {
      showToast('Could not convert — try again');
    } finally {
      setConverting(null);
    }
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
                    {!m.onboarding_complete && (
                      <button
                        onClick={e => { e.stopPropagation(); convertToMember(m); }}
                        disabled={converting === m.id}
                        title="Mark as a full member — they'll appear on all member lists and the leaderboard"
                        style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {converting === m.id ? 'Converting…' : '→ Convert to member'}
                      </button>
                    )}
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

            {/* Convert first-timer */}
            {!selMember.onboarding_complete && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
                <button
                  onClick={() => convertToMember(selMember)}
                  disabled={converting === selMember.id}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 9, cursor: 'pointer',
                    border: 'none', background: 'var(--navy)', color: '#fff',
                    fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                >
                  <Icon name="userplus" size={15} color="#fff" />
                  {converting === selMember.id ? 'Converting…' : 'Convert to full member'}
                </button>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 2px 0', lineHeight: 1.5 }}>
                  Completes their onboarding — they&apos;ll appear in attendance, forms, points and the leaderboard.
                </p>
              </div>
            )}

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
