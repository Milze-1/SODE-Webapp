'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar, PillarChip, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, AdminSearch } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

interface PointRule {
  id: string; rule_key: string; label: string; points: number;
  cap: number | null; cap_period: string | null; requires_verification: boolean; is_active: boolean;
}
interface FunnelStage { l: string; v: number; }
interface Inviter { name: string; count: number; }
interface MonthlyGrowth { month: string; count: number; cumulative: number; }
interface DevotionDay { date: string; label: string; completed: number; }

interface MemberPoints {
  auth_id: string;
  id: string;
  name: string;
  email: string;
  pillar: string | null;
  mountains: string[] | null;
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

const MOUNTAIN_TO_PILLAR: Record<string, string> = {
  'Business': 'business', 'Government': 'career', 'Education': 'career',
  'Media & arts': 'character', 'Family': 'character', 'Religion': 'spiritual', 'Healthcare': 'career',
};

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
  advocacy_share:       'Shared SODE content',
  advocacy_click:       'Content click earned',
  content_completed:    'Learning completed',
  leaderboard_reset:    'Leaderboard reset',
};

function ruleLabel(key: string, fallback: Record<string, string>): string {
  return RULE_LABELS[key] ?? fallback[key] ?? key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export default function GrowthPage() {
  const [showEdit, setShowEdit] = useState<PointRule | null>(null);
  const [rules, setRules] = useState<PointRule[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [regFunnel, setRegFunnel] = useState<FunnelStage[]>([]);
  const [devotionTrend, setDevotionTrend] = useState<DevotionDay[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [topInviters, setTopInviters] = useState<Inviter[]>([]);
  const [growthTrend, setGrowthTrend] = useState<MonthlyGrowth[]>([]);
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
      .select('id,name,email,pillar,mountains,auth_id,points')
      .eq('onboarding_complete', true)
      .order('points', { ascending: false });

    const rows: MemberPoints[] = ((members ?? []) as { id: string; name: string; email: string; pillar: string | null; mountains: string[] | null; auth_id: string; points: number }[])
      .map(m => {
        const derivedPillar = m.pillar ?? (m.mountains?.[0] ? (MOUNTAIN_TO_PILLAR[m.mountains[0]] ?? null) : null);
        return {
          id: m.id,
          auth_id: m.auth_id,
          name: m.name,
          email: m.email,
          pillar: derivedPillar,
          mountains: m.mountains ?? null,
          all_time_points: m.points ?? 0,
          current_period_points: m.points ?? 0,
        };
      });

    setMemberPoints(rows);
    setMpLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const devotionFrom = new Date();
      devotionFrom.setDate(devotionFrom.getDate() - 13);
      const devotionFromStr = devotionFrom.toISOString().slice(0, 10);

      const [rulesRes, invRes, membersRes, attendanceRes, devotionRes] = await Promise.all([
        supabase.from('point_rules').select('id,rule_key,label,points,cap,cap_period,requires_verification,is_active').order('points', { ascending: false }),
        supabase.from('invitations').select('inviter_id,stage'),
        supabase.from('members').select('id,name,created_at').eq('onboarding_complete', true),
        supabase.from('attendance_records').select('member_id').eq('status', 'present'),
        supabase.from('devotion_checkins').select('member_id,checkin_date,completed').gte('checkin_date', devotionFromStr),
      ]);

      const ruleRows = (rulesRes.data ?? []) as PointRule[];
      setRules(ruleRows);
      setRuleLabels(Object.fromEntries(ruleRows.map(r => [r.rule_key, r.label])));

      const invitations = (invRes.data ?? []) as { inviter_id: string; stage: string }[];

      setFunnel([
        { l: 'Sent',          v: invitations.filter(i => ['sent','delivered','queued','clicked','opened'].includes(i.stage)).length },
        { l: 'Signed Up',     v: invitations.filter(i => ['registered','first_attended','five_meetings','active'].includes(i.stage)).length },
        { l: 'First Meeting', v: invitations.filter(i => ['first_attended','five_meetings','active'].includes(i.stage)).length },
        { l: '5 Meetings',    v: invitations.filter(i => ['five_meetings','active'].includes(i.stage)).length },
      ]);

      // ── Registration funnel: all members, signup → first meeting → 5 meetings ──
      const allMembers = (membersRes.data ?? []) as { id: string; name: string; created_at: string }[];
      const attendanceCounts = new Map<string, number>();
      ((attendanceRes.data ?? []) as { member_id: string }[]).forEach(a => {
        attendanceCounts.set(a.member_id, (attendanceCounts.get(a.member_id) ?? 0) + 1);
      });
      const memberIds = new Set(allMembers.map(m => m.id));
      const withFirstMeeting = allMembers.filter(m => (attendanceCounts.get(m.id) ?? 0) >= 1).length;
      const withFiveMeetings = allMembers.filter(m => (attendanceCounts.get(m.id) ?? 0) >= 5).length;
      setRegFunnel([
        { l: 'Signed Up',     v: allMembers.length },
        { l: 'First Meeting', v: withFirstMeeting },
        { l: '5 Meetings',    v: withFiveMeetings },
      ]);
      setTotalMembers(allMembers.length);

      // ── Devotion close-outs per day (last 14 days) ─────────────────────────
      const devotionRows = ((devotionRes.data ?? []) as { member_id: string; checkin_date: string; completed: boolean }[])
        .filter(d => d.completed && memberIds.has(d.member_id));
      const perDay = new Map<string, number>();
      devotionRows.forEach(d => perDay.set(d.checkin_date, (perDay.get(d.checkin_date) ?? 0) + 1));
      const days: DevotionDay[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days.push({
          date: key,
          label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          completed: perDay.get(key) ?? 0,
        });
      }
      setDevotionTrend(days);

      const inviterMap = new Map<string, number>();
      for (const inv of invitations) {
        inviterMap.set(inv.inviter_id, (inviterMap.get(inv.inviter_id) ?? 0) + 1);
      }
      const memberLookup = new Map<string, string>();
      const members = (membersRes.data ?? []) as { id: string; name: string; created_at: string }[];
      members.forEach(m => memberLookup.set(m.id, m.name));
      const sorted = Array.from(inviterMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      setTopInviters(sorted.map(([id, count]) => ({ name: memberLookup.get(id) ?? 'Unknown', count })));

      // Calculate last 6 months growth
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const last6Months: { year: number; month: number; name: string; count: number; cumulative: number }[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
          year: d.getFullYear(),
          month: d.getMonth(),
          name: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
          count: 0,
          cumulative: 0,
        });
      }

      members.forEach(m => {
        const d = new Date(m.created_at);
        const mYear = d.getFullYear();
        const mMonth = d.getMonth();
        const bucket = last6Months.find(b => b.year === mYear && b.month === mMonth);
        if (bucket) {
          bucket.count++;
        }
      });

      const firstMonthStart = new Date(last6Months[0].year, last6Months[0].month, 1);
      let cumulativeSum = members.filter(m => new Date(m.created_at) < firstMonthStart).length;

      last6Months.forEach(b => {
        cumulativeSum += b.count;
        b.cumulative = cumulativeSum;
      });

      setGrowthTrend(last6Months.map(b => ({ month: b.name, count: b.count, cumulative: b.cumulative })));
      setLoading(false);
    };

    load();
    loadMemberPoints();

    const channel = supabase.channel('admin-growth')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_rules' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devotion_checkins' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, loadMemberPoints)
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

  const joinRate = funnel[1]?.v && funnel[0]?.v ? Math.round((funnel[1].v / funnel[0].v) * 100) : 0;
  const displayFunnel = funnel.length > 0 ? funnel : [
    { l: 'Sent', v: 0 }, { l: 'Signed Up', v: 0 }, { l: 'First Meeting', v: 0 }, { l: '5 Meetings', v: 0 },
  ];

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
            {(() => {
              const maxCount = Math.max(...displayFunnel.map(f => f.v), 1);
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', minHeight: 180, paddingBottom: 0, position: 'relative' }}>
                  {displayFunnel.map((f, i) => {
                    // Calculate conversion percentage from previous step
                    let conversionText = '';
                    if (i > 0) {
                      const prevStage = displayFunnel[i - 1];
                      const rate = prevStage.v > 0 ? Math.round((f.v / prevStage.v) * 100) : 0;
                      conversionText = `${rate}% conv`;
                    }
                    
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', flex: 1 }}>
                        {conversionText && (
                          <div style={{
                            position: 'absolute',
                            left: '0%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'var(--surface)',
                            border: '1px solid var(--line-2)',
                            borderRadius: '12px',
                            padding: '3px 8px',
                            fontSize: '9px',
                            fontWeight: 700,
                            color: 'var(--muted)',
                            zIndex: 1,
                            boxShadow: 'var(--sh-sm)'
                          }}>
                            {conversionText}
                          </div>
                        )}
                        <span style={{ fontSize: 16, fontWeight: 800, color: f.v > 0 ? '#1e2a52' : '#999' }} className="tnum">
                          {f.v}
                        </span>
                        <div style={{
                          width: '75%',
                          maxWidth: 50,
                          height: Math.max(f.v > 0 ? Math.round((f.v / maxCount) * 120) : 4, 4),
                          background: f.v > 0 ? 'linear-gradient(to top, #1e2a52, #3b82f6)' : 'var(--line-2)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.3s ease',
                          boxShadow: f.v > 0 ? '0 4px 6px -1px rgba(30, 42, 82, 0.2)' : 'none',
                        }} />
                        <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', fontWeight: 600 }}>{f.l}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              {[[`${joinRate}%`, 'Sign-up rate'], [String(funnel[2]?.v ?? 0), 'First meeting'], [String(funnel[3]?.v ?? 0), '5 meetings']].map(([v, l], i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div className="tnum" style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{v}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ── Registration funnel (all members, not just referrals) ── */}
        <div style={{ marginBottom: 16 }}>
          <Panel title="Registration funnel" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>All members · sign-up → 5 meetings</span>}>
            {(() => {
              const displayReg = regFunnel.length > 0 ? regFunnel : [
                { l: 'Signed Up', v: 0 }, { l: 'First Meeting', v: 0 }, { l: '5 Meetings', v: 0 },
              ];
              const maxCount = Math.max(...displayReg.map(f => f.v), 1);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', minHeight: 180, paddingBottom: 0, position: 'relative', maxWidth: 640, margin: '0 auto' }}>
                    {displayReg.map((f, i) => {
                      let conversionText = '';
                      if (i > 0) {
                        const prevStage = displayReg[i - 1];
                        const rate = prevStage.v > 0 ? Math.round((f.v / prevStage.v) * 100) : 0;
                        conversionText = `${rate}% conv`;
                      }
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', flex: 1 }}>
                          {conversionText && (
                            <div style={{
                              position: 'absolute',
                              left: '0%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              background: 'var(--surface)',
                              border: '1px solid var(--line-2)',
                              borderRadius: '12px',
                              padding: '3px 8px',
                              fontSize: '9px',
                              fontWeight: 700,
                              color: 'var(--muted)',
                              zIndex: 1,
                              boxShadow: 'var(--sh-sm)'
                            }}>
                              {conversionText}
                            </div>
                          )}
                          <span style={{ fontSize: 16, fontWeight: 800, color: f.v > 0 ? '#1e2a52' : '#999' }} className="tnum">
                            {f.v}
                          </span>
                          <div style={{
                            width: '75%',
                            maxWidth: 50,
                            height: Math.max(f.v > 0 ? Math.round((f.v / maxCount) * 120) : 4, 4),
                            background: f.v > 0 ? 'linear-gradient(to top, #1e2a52, #3b82f6)' : 'var(--line-2)',
                            borderRadius: '6px 6px 0 0',
                            transition: 'height 0.3s ease',
                            boxShadow: f.v > 0 ? '0 4px 6px -1px rgba(30, 42, 82, 0.2)' : 'none',
                          }} />
                          <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', fontWeight: 600 }}>{f.l}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    {[
                      [String(regFunnel[0]?.v ?? 0), 'Signed up'],
                      [regFunnel[0]?.v ? `${Math.round(((regFunnel[1]?.v ?? 0) / regFunnel[0].v) * 100)}%` : '0%', 'Attend a meeting'],
                      [regFunnel[0]?.v ? `${Math.round(((regFunnel[2]?.v ?? 0) / regFunnel[0].v) * 100)}%` : '0%', 'Reach 5 meetings'],
                    ].map(([v, l], i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <div className="tnum" style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{v}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, fontWeight: 600 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </Panel>
        </div>

        {/* ── Daily devotion close-outs vs platform members ── */}
        <div style={{ marginBottom: 16 }}>
          <Panel title="Daily devotion close-outs" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Last 14 days · vs members on the platform</span>}>
            {devotionTrend.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>No devotion data yet.</div>
            ) : (
              (() => {
                const width = 720;
                const height = 170;
                const padding = 26;
                const maxVal = Math.max(totalMembers, ...devotionTrend.map(d => d.completed), 1);
                const n = devotionTrend.length;
                const xFor = (idx: number) => padding + (idx * (width - 2 * padding)) / (n - 1);
                const yFor = (v: number) => height - padding - (v * (height - 2 * padding)) / maxVal;

                const points = devotionTrend.map((d, idx) => ({ x: xFor(idx), y: yFor(d.completed) }));
                const pathData = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                const areaData = `${pathData} L ${points[n - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
                const membersY = yFor(totalMembers);

                const today = devotionTrend[n - 1];
                const todayRate = totalMembers > 0 ? Math.round((today.completed / totalMembers) * 100) : 0;
                const avg = Math.round(devotionTrend.reduce((s, d) => s + d.completed, 0) / n);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="tnum" style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>{today.completed} / {totalMembers}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Closed out devotion today ({todayRate}%)</div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                          <span style={{ width: 18, height: 3, borderRadius: 2, background: '#1e2a52', display: 'inline-block' }} /> Devotions closed
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                          <span style={{ width: 18, height: 0, borderTop: '2px dashed #10b981', display: 'inline-block' }} /> Members on platform ({totalMembers})
                        </div>
                      </div>
                    </div>

                    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="devotion-area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e2a52" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#1e2a52" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--line-2)" strokeWidth={1} />

                      {/* Reference: total members on the platform */}
                      <line x1={padding} y1={membersY} x2={width - padding} y2={membersY} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 4" />
                      <text x={width - padding} y={membersY - 5} textAnchor="end" style={{ fontSize: 9.5, fontWeight: 800, fill: '#10b981', fontFamily: 'var(--font-mono)' }}>
                        {totalMembers} members
                      </text>

                      <path d={areaData} fill="url(#devotion-area-grad)" />
                      <path d={pathData} fill="none" stroke="#1e2a52" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke="#1e2a52" strokeWidth={2} />
                          {devotionTrend[idx].completed > 0 && (
                            <text x={p.x} y={p.y - 8} textAnchor="middle" style={{ fontSize: 9, fontWeight: 800, fill: '#1e2a52', fontFamily: 'var(--font-mono)' }}>
                              {devotionTrend[idx].completed}
                            </text>
                          )}
                        </g>
                      ))}
                    </svg>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: `0 ${padding}px`, marginTop: -4 }}>
                      {devotionTrend.map((d, idx) => (
                        <span key={idx} style={{ fontSize: 9.5, color: 'var(--muted)', fontWeight: 600, transform: 'rotate(0deg)' }}>
                          {idx % 2 === 0 ? d.label.split(' ')[0] + ' ' + d.label.split(' ')[1] : ''}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      {[
                        [`${todayRate}%`, "Today's close-out rate"],
                        [String(avg), 'Avg close-outs / day (14d)'],
                        [String(Math.max(...devotionTrend.map(d => d.completed))), 'Best day (14d)'],
                      ].map(([v, l], i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div className="tnum" style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{v}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, fontWeight: 600 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}
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

          <Panel title="Membership Growth" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Cumulative sign-ups (6m)</span>}>
            {growthTrend.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>No growth data.</div>
            ) : (
              <div style={{ position: 'relative' }}>
                {(() => {
                  const maxVal = Math.max(...growthTrend.map(g => g.cumulative), 1);
                  const height = 120;
                  const width = 360;
                  const padding = 20;
                  
                  const points = growthTrend.map((g, idx) => {
                    const x = padding + (idx * (width - 2 * padding)) / (growthTrend.length - 1);
                    const y = height - padding - (g.cumulative * (height - 2 * padding)) / maxVal;
                    return { x, y };
                  });
                  
                  const pathData = points.length > 0 
                    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
                    : '';
                    
                  const areaData = points.length > 0
                    ? `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
                    : '';
                    
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className="tnum" style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>
                            {growthTrend[growthTrend.length - 1]?.cumulative ?? 0}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total active SODE members</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="tnum" style={{ fontSize: 15, fontWeight: 700, color: 'var(--emerald)' }}>
                            +{growthTrend[growthTrend.length - 1]?.count ?? 0} this month
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>New signups</div>
                        </div>
                      </div>
                      
                      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1e2a52" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#1e2a52" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        
                        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--line-2)" strokeWidth={1} />
                        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--line-2)" strokeDasharray="3 3" strokeWidth={1} />
                        
                        {areaData && <path d={areaData} fill="url(#chart-area-grad)" />}
                        
                        {pathData && <path d={pathData} fill="none" stroke="#1e2a52" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
                        
                        {points.map((p, idx) => (
                          <g key={idx}>
                            <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#1e2a52" strokeWidth={2} />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 800, fill: '#1e2a52', fontFamily: 'var(--font-mono)' }}>
                              {growthTrend[idx].cumulative}
                            </text>
                          </g>
                        ))}
                      </svg>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: `0 ${padding}px`, marginTop: -4 }}>
                        {growthTrend.map((g, idx) => (
                          <span key={idx} style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{g.month.split(' ')[0]}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
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
