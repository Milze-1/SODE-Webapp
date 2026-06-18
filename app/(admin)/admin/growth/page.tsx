'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar, PillarChip, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, Bars, AdminSearch } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

interface PointRule {
  id: string; rule_key: string; label: string; points: number;
  cap: number | null; cap_period: string | null; requires_verification: boolean; is_active: boolean;
}
interface FunnelStage { l: string; v: number; }
interface Inviter { name: string; count: number; }

interface MemberPoints {
  auth_id: string;
  id: string;
  name: string;
  email: string;
  pillar: string | null;
  all_time_points: number;
  current_period_points: number;
}

interface PointEvent {
  id: string;
  rule_key: string;
  points: number;
  ref_table: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
}

const STAGE_ORDER = ['sent', 'opened', 'joined', 'attended', 'active'];
const STAGE_LABELS: Record<string, string> = { sent: 'Sent', opened: 'Clicked', joined: 'Joined', attended: 'Attended', active: 'Active' };

const RULE_LABELS: Record<string, string> = {
  win_logged:           'Win logged',
  goal_created:         'Goal created',
  goal_completed:       'Goal completed',
  form_submitted:       'Form submitted',
  session_attended:     'Session attended',
  attendance_present:   'Session attended',
  referral_joined:      'Referral — member joined',
  referral_attended:    'Referral — member attended',
  advocacy_shared:      'Shared SODE content',
  advocacy_click:       'Content click earned',
  content_completed:    'Learning completed',
  leaderboard_reset:    'Leaderboard reset',
};

function ruleLabel(key: string, fallback: Record<string, string>): string {
  return RULE_LABELS[key] ?? fallback[key] ?? key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export default function GrowthPage() {
  const [vis, setVis] = useState('members');
  const [showEdit, setShowEdit] = useState<PointRule | null>(null);
  const [rules, setRules] = useState<PointRule[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [topInviters, setTopInviters] = useState<Inviter[]>([]);
  const [editVal, setEditVal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Member points table
  const [memberPoints, setMemberPoints] = useState<MemberPoints[]>([]);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpSearch, setMpSearch] = useState('');
  const [mpPillar, setMpPillar] = useState('all');
  const [selectedMember, setSelectedMember] = useState<MemberPoints | null>(null);
  const [pointEvents, setPointEvents] = useState<PointEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [ruleLabels, setRuleLabels] = useState<Record<string, string>>({});

  // Reset leaderboard
  const [showReset, setShowReset] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetting, setResetting] = useState(false);

  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const loadMemberPoints = useCallback(async () => {
    setMpLoading(true);
    const supabase = createClient();
    const { data: members } = await supabase
      .from('members')
      .select('id,name,email,pillar,auth_id')
      .eq('onboarding_complete', true)
      .order('name');

    const memberList = (members ?? []) as { id: string; name: string; email: string; pillar: string | null; auth_id: string }[];

    if (memberList.length === 0) { setMemberPoints([]); setMpLoading(false); return; }

    const memberIds = memberList.map(m => m.id).filter(Boolean);
    const { data: balances } = await supabase
      .from('user_points_balance')
      .select('member_id,total_points,this_month_points')
      .in('member_id', memberIds);

    const balMap = Object.fromEntries(
      ((balances ?? []) as { member_id: string; total_points: number; this_month_points: number }[]).map(b => [b.member_id, b]),
    );

    const rows: MemberPoints[] = memberList
      .map(m => ({
        ...m,
        all_time_points: balMap[m.id]?.total_points ?? 0,
        current_period_points: balMap[m.id]?.this_month_points ?? 0,
      }))
      .sort((a, b) => b.all_time_points - a.all_time_points);

    setMemberPoints(rows);
    setMpLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const [rulesRes, invRes, membersRes] = await Promise.all([
        supabase.from('point_rules').select('id,rule_key,label,points,cap,cap_period,requires_verification,is_active').order('points', { ascending: false }),
        supabase.from('invitations').select('inviter_id,stage'),
        supabase.from('members').select('id,name').eq('onboarding_complete', true),
      ]);

      const ruleRows = (rulesRes.data ?? []) as PointRule[];
      setRules(ruleRows);
      setRuleLabels(Object.fromEntries(ruleRows.map(r => [r.rule_key, r.label])));

      const invitations = (invRes.data ?? []) as { inviter_id: string; stage: string }[];
      const stageCounts = new Map<string, number>();
      for (const inv of invitations) {
        const idx = STAGE_ORDER.indexOf(inv.stage);
        for (let i = 0; i <= idx && i < STAGE_ORDER.length; i++) {
          stageCounts.set(STAGE_ORDER[i], (stageCounts.get(STAGE_ORDER[i]) ?? 0) + 1);
        }
      }
      setFunnel(STAGE_ORDER.map(k => ({ l: STAGE_LABELS[k], v: stageCounts.get(k) ?? 0 })));

      const inviterMap = new Map<string, number>();
      for (const inv of invitations) {
        inviterMap.set(inv.inviter_id, (inviterMap.get(inv.inviter_id) ?? 0) + 1);
      }
      const memberLookup = new Map<string, string>();
      ((membersRes.data ?? []) as { id: string; name: string }[]).forEach(m => memberLookup.set(m.id, m.name));
      const sorted = Array.from(inviterMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      setTopInviters(sorted.map(([id, count]) => ({ name: memberLookup.get(id) ?? 'Unknown', count })));

      setLoading(false);
    };

    load();
    loadMemberPoints();

    const channel = supabase.channel('admin-growth')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_rules' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points_balance' }, loadMemberPoints)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadMemberPoints]);

  const openMemberDrawer = async (m: MemberPoints) => {
    setSelectedMember(m);
    setEventsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('point_events')
      .select('id,rule_key,points,ref_table,ref_id,note,created_at')
      .eq('member_id', m.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setPointEvents((data ?? []) as PointEvent[]);
    setEventsLoading(false);
  };

  const openEdit = (r: PointRule) => { setShowEdit(r); setEditVal(r.points); };

  const saveEdit = async () => {
    if (!showEdit) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('point_rules').update({ points: editVal }).eq('id', showEdit.id);
      setRules(rs => rs.map(r => r.id === showEdit.id ? { ...r, points: editVal } : r));
    } catch { /* silent */ }
    setSaving(false);
    setShowEdit(null);
  };

  const handleReset = async () => {
    if (resetInput !== 'RESET') return;
    setResetting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: adminMember } = await supabase.from('members').select('name').eq('auth_id', user?.id ?? '').maybeSingle();
    const adminName = adminMember?.name ?? user?.email ?? 'Admin';

    await supabase.from('user_points_balance').update({ this_month_points: 0 }).neq('member_id', '00000000-0000-0000-0000-000000000000');

    const { data: allUsers } = await supabase.from('user_points_balance').select('member_id');
    if (allUsers?.length) {
      try {
        await supabase.from('point_events').insert(
          allUsers.map(u => ({
            member_id: u.member_id,
            rule_key: 'leaderboard_reset',
            points: 0,
            note: `Manual reset by ${adminName} on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          })),
        );
      } catch { /* audit insert is non-critical */ }
    }

    setResetting(false);
    setShowReset(false);
    setResetInput('');
    loadMemberPoints();
    showToast('Leaderboard reset ✓ All period points set to zero.', 'check');
  };

  const joinRate = funnel[2]?.v && funnel[0]?.v ? Math.round((funnel[2].v / funnel[0].v) * 100) : 0;
  const displayFunnel = funnel.length > 0 ? funnel : STAGE_ORDER.map(k => ({ l: STAGE_LABELS[k], v: 0 }));

  const filteredMp = memberPoints.filter(m => {
    if (mpPillar !== 'all' && m.pillar !== mpPillar) return false;
    if (mpSearch.trim()) {
      const q = mpSearch.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <AdminTopbar
        title="Growth & Rewards"
        subtitle="Points · referrals · leaderboard"
        actions={
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <button
              onClick={() => setShowReset(true)}
              className="btn btn-sm"
              style={{ border: '1.5px solid #c53030', color: '#c53030', background: 'transparent', fontWeight: 700 }}
            >
              <Icon name="refresh" size={15} color="#c53030" /> Reset leaderboard
            </button>
            <button onClick={saveEdit} disabled={!showEdit || saving} className="btn btn-primary btn-sm">
              <Icon name="check" size={16} color="#fff" /> Save rules
            </button>
          </div>
        }
      />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Panel title="Points rules" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Invitations stay highest</span>} pad={false}>
            {loading ? (
              <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Loading rules…</div>
            ) : rules.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>No point rules configured yet.</div>
            ) : (
              <>
                <THead cols={['Action', 'Points', 'Cap', 'Verify']} template="1.4fr .6fr .6fr .6fr" />
                {rules.filter(r => r.is_active).map(r => (
                  <TRow key={r.id} template="1.4fr .6fr .6fr .6fr" onClick={() => openEdit(r)}>
                    <span style={{ fontWeight: 600 }}>{r.label}</span>
                    <span className="tnum" style={{ fontWeight: 800, color: 'var(--navy)' }}>+{r.points}</span>
                    <span className="tnum" style={{ color: 'var(--muted)' }}>{r.cap ? `${r.cap}/${r.cap_period ?? 'mo'}` : '—'}</span>
                    {r.requires_verification ? <Icon name="shieldcheck" size={17} color="var(--navy)" /> : <span style={{ color: 'var(--faint)' }}>—</span>}
                  </TRow>
                ))}
              </>
            )}
          </Panel>

          <Panel title="Referral funnel">
            <Bars data={displayFunnel.map(f => f.v)} labels={displayFunnel.map(f => f.l)} w={400} h={160} />
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              {[[`${joinRate}%`, 'Join rate'], [String(funnel[4]?.v ?? 0), 'Now active'], [String(funnel[2]?.v ?? 0), 'Reg. via referral']].map(([v, l], i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Panel title="Top inviters" pad={false}>
            {topInviters.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--muted)', fontSize: 13 }}>No referrals tracked yet.</div>
            ) : topInviters.map((r, i) => (
              <TRow key={i} template="auto 1fr auto">
                <span className="tnum" style={{ fontWeight: 800, color: 'var(--muted)', width: 18 }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Avatar name={r.name} size={28} tone="soft" />
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                </div>
                <span className="tnum" style={{ fontWeight: 700 }}>{r.count} joined</span>
              </TRow>
            ))}
          </Panel>

          <Panel title="Leaderboard visibility">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([['members', 'Members only', 'Default — signed-in members'], ['public', 'Public link', 'Anyone with the link'], ['indexed', 'Public & indexed', 'Doubles as a growth surface']] as const).map(([k, t, d]) => {
                const active = vis === k;
                return (
                  <button key={k} onClick={() => setVis(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, background: active ? 'var(--navy-tint)' : 'var(--surface)', border: active ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', border: active ? '6px solid var(--navy)' : '2px solid var(--line-2)', background: '#fff' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Members & Points table */}
        <Panel
          title="Members & Points"
          action={
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <AdminSearch value={mpSearch} onChange={setMpSearch} placeholder="Search member…" />
              <select
                value={mpPillar}
                onChange={e => setMpPillar(e.target.value)}
                style={{ height: 34, borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--surface)', padding: '0 10px', fontSize: 12.5, outline: 'none' }}
              >
                <option value="all">All pillars</option>
                {['spiritual', 'career', 'business', 'character'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          }
          pad={false}
        >
          {mpLoading ? (
            <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: 13 }}>Loading members…</div>
          ) : filteredMp.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No members found.</div>
          ) : (
            <>
              <THead cols={['Rank', 'Member', 'Pillar', 'This period', 'All time']} template="50px 1.5fr .8fr .8fr .8fr" />
              {filteredMp.map((m, i) => (
                <TRow key={m.id} template="50px 1.5fr .8fr .8fr .8fr" onClick={() => openMemberDrawer(m)}>
                  <span className="tnum" style={{ fontWeight: 800, color: 'var(--muted)', fontSize: 13 }}>#{i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar name={m.name} size={28} tone="grey" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>{m.email}</div>
                    </div>
                  </div>
                  <div>{m.pillar ? <PillarChip pillar={m.pillar} size="sm" /> : <span style={{ color: 'var(--faint)' }}>—</span>}</div>
                  <span className="tnum" style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{m.current_period_points.toLocaleString()}</span>
                  <span className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>{m.all_time_points.toLocaleString()}</span>
                </TRow>
              ))}
            </>
          )}
        </Panel>
      </AdminBody>

      {/* Edit rule modal */}
      {showEdit && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowEdit(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 20, padding: 28, width: 360, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Edit rule</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>{showEdit.label}</div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Points value</label>
              <input type="number" value={editVal} onChange={e => setEditVal(Number(e.target.value))} className="input" style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowEdit(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset leaderboard modal */}
      {showReset && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => { setShowReset(false); setResetInput(''); }} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 20, padding: 28, width: 400, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="info" size={18} color="#c53030" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Reset leaderboard?</div>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 6 }}>
              This will set <strong>all member points to zero</strong> for the current period.
              Historical point events are kept for audit purposes.
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>
              All-time points are <strong>not affected</strong> — only current period points reset.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 7 }}>Type &quot;RESET&quot; to confirm</label>
              <input
                value={resetInput}
                onChange={e => setResetInput(e.target.value)}
                placeholder="RESET"
                className="input"
                style={{ width: '100%', letterSpacing: '.08em', fontWeight: 700, fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowReset(false); setResetInput(''); }} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={handleReset}
                disabled={resetInput !== 'RESET' || resetting}
                style={{ flex: 1, height: 42, borderRadius: 10, background: resetInput === 'RESET' ? '#c53030' : 'var(--surface-2)', color: resetInput === 'RESET' ? '#fff' : 'var(--muted)', fontWeight: 700, border: 'none', cursor: resetInput === 'RESET' ? 'pointer' : 'not-allowed', fontSize: 14 }}
              >
                {resetting ? 'Resetting…' : 'Reset leaderboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member points drawer */}
      {selectedMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }} onClick={() => setSelectedMember(null)}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,.35)' }} />
          <div style={{ width: 440, background: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sh-pop)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={selectedMember.name} size={40} tone="soft" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{selectedMember.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Points history</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="tnum" style={{ fontSize: 22, fontWeight: 900 }}>{selectedMember.all_time_points.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>total pts</div>
                </div>
                <button onClick={() => setSelectedMember(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  <Icon name="x" size={17} />
                </button>
              </div>
            </div>

            <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
              {eventsLoading ? (
                <div style={{ padding: '28px 22px', color: 'var(--muted)', fontSize: 13 }}>Loading events…</div>
              ) : pointEvents.length === 0 ? (
                <div style={{ padding: '40px 22px', textAlign: 'center' }}>
                  {selectedMember.all_time_points > 0 ? (
                    <>
                      <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy)' }} className="tnum">{selectedMember.all_time_points.toLocaleString()}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>pts recorded</div>
                      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10, padding: '0 16px', lineHeight: 1.5 }}>Legacy points — no detailed breakdown available</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>No point events yet</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, padding: '0 8px' }}>
                        Points are earned by submitting wins, attending sessions, completing goals and inviting members.
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr .5fr .7fr', padding: '9px 22px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <div>Date</div><div>Action</div><div>Pts</div><div>Status</div>
                  </div>
                  {pointEvents.map(ev => {
                    const ptsNum     = ev.points ?? 0;
                    const isReset    = ev.rule_key === 'leaderboard_reset';
                    const ptsDisplay = ptsNum > 0 ? `+${ptsNum}` : ptsNum < 0 ? String(ptsNum) : '0';
                    const ptsColor   = ptsNum > 0 ? 'var(--navy)' : ptsNum < 0 ? '#c53030' : 'var(--muted)';
                    const statusText = isReset ? 'Reset' : ptsNum >= 0 ? 'Earned' : 'Reversed';
                    const statusBg   = isReset ? 'var(--surface-2)' : ptsNum >= 0 ? '#d1fae5' : '#fee2e2';
                    const statusColor = isReset ? 'var(--muted)' : ptsNum >= 0 ? '#065f46' : '#c53030';
                    const d = new Date(ev.created_at);
                    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
                    return (
                      <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr .5fr .7fr', padding: '11px 22px', borderBottom: '1px solid var(--line)', fontSize: 12.5, alignItems: 'center', gap: 8 }}>
                        <span className="tnum" style={{ color: 'var(--muted)', fontSize: 11.5 }}>{dateStr}</span>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ruleLabel(ev.rule_key, ruleLabels)}</span>
                        <span className="tnum" style={{ fontWeight: 800, color: ptsColor }}>{ptsDisplay}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 700 }}>{statusText}</span>
                      </div>
                    );
                  })}
                  <div style={{ padding: '14px 22px', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
                    Total: <strong>{selectedMember.all_time_points.toLocaleString()} points</strong> from {pointEvents.length} event{pointEvents.length !== 1 ? 's' : ''}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
