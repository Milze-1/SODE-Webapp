'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, TRow, THead, Skeleton, Bars } from '@/components/admin/chrome';

interface RuleRow { id: string; rule_key: string; label: string; points: number; description: string | null; is_active: boolean; cap_period?: string | null; cap?: number | null; requires_verification?: boolean; }
interface LogRow { id: string; delta: number; reason: string | null; created_at: string; members: { name: string } | null; }
interface MemberOption { id: string; name: string; }
interface FunnelRow { state: string; count: number; }
interface InviterRow { name: string; count: number; }

const FUNNEL_LABELS: Record<string, string> = { sent: 'Sent', clicked: 'Clicked', joined: 'Joined', attended: 'Attended', active: 'Active' };
const VIS_OPTIONS = [
  { k: 'members', t: 'Members only', d: 'Default — signed-in members' },
  { k: 'public', t: 'Public link', d: 'Anyone with the link' },
  { k: 'indexed', t: 'Public & indexed', d: 'Doubles as a growth surface' },
];

export default function PointsPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [topInviters, setTopInviters] = useState<InviterRow[]>([]);
  const [leaderVis, setLeaderVis] = useState('members');
  const [showAward, setShowAward] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [tab, setTab] = useState<'log' | 'rules' | 'referrals'>('log');
  const [editRule, setEditRule] = useState<RuleRow | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const memberRef = useRef<HTMLSelectElement>(null);
  const pointsRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const rulePointsRef = useRef<HTMLInputElement>(null);
  const ruleDescRef = useRef<HTMLInputElement>(null);
  const ruleCapPeriodRef = useRef<HTMLSelectElement>(null);
  const ruleCapRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const [rulesRes, logRes, membersRes, leaderRes, settingsRes] = await Promise.all([
          supabase.from('point_rules').select('id,rule_key,label,points,description,is_active,cap_period,cap,requires_verification').order('points', { ascending: false }),
          supabase.from('points_log').select('id,delta,reason,created_at,members:member_id(name)').order('created_at', { ascending: false }).limit(100),
          supabase.from('members').select('id,name').eq('onboarding_complete', true).order('name'),
          user ? supabase.from('members').select('id').eq('auth_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from('leaderboard_settings').select('visibility').maybeSingle(),
        ]);
        setRules((rulesRes.data ?? []) as RuleRow[]);
        setLog((logRes.data ?? []) as unknown as LogRow[]);
        setMemberOptions((membersRes.data ?? []) as MemberOption[]);
        const ld = (leaderRes as { data: { id: string } | null }).data;
        if (ld?.id) setLeaderId(ld.id);
        const settings = (settingsRes as { data: { visibility: string } | null }).data;
        if (settings?.visibility) setLeaderVis(settings.visibility);

        // Referral funnel from invitations table
        try {
          const { data: funnelData } = await supabase.from('invitations').select('state');
          if (funnelData) {
            const counts: Record<string, number> = {};
            (funnelData as { state: string }[]).forEach(r => { counts[r.state] = (counts[r.state] ?? 0) + 1; });
            setFunnel(Object.entries(counts).map(([state, count]) => ({ state, count })));
          }
        } catch { /* invitations table may not exist */ }

        // Top inviters
        try {
          const { data: invData } = await supabase.from('invitations').select('inviter_id,members:inviter_id(name)').eq('state', 'joined');
          if (invData) {
            const nameCounts: Record<string, number> = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (invData as any[]).forEach((r: any) => {
              const name = (r.members?.name as string | null) ?? (r.inviter_id as string);
              nameCounts[name] = (nameCounts[name] ?? 0) + 1;
            });
            setTopInviters(Object.entries(nameCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count })));
          }
        } catch { /* invitations table may not exist */ }
      } catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  const awardPoints = async () => {
    const memberId = memberRef.current?.value;
    const pts = parseInt(pointsRef.current?.value ?? '0', 10);
    const reason = reasonRef.current?.value;
    if (!memberId || !pts || !reason) return;
    setAwarding(true);
    try {
      const supabase = createClient();
      await supabase.from('points_log').insert({ member_id: memberId, delta: pts, reason, created_by: leaderId });
      const { data: memberRow } = await supabase.from('members').select('points').eq('id', memberId).single();
      if (memberRow) await supabase.from('members').update({ points: ((memberRow as { points?: number }).points ?? 0) + pts }).eq('id', memberId);
      const memberName = memberOptions.find(m => m.id === memberId)?.name ?? '?';
      setLog(ls => [{ id: Date.now().toString(), delta: pts, reason, created_at: new Date().toISOString(), members: { name: memberName } }, ...ls]);
      setShowAward(false);
    } catch { /* silent */ }
    finally { setAwarding(false); }
  };

  const saveRule = async () => {
    if (!editRule) return;
    setSavingRule(true);
    try {
      const supabase = createClient();
      const updates: Partial<RuleRow> = {
        points: parseInt(rulePointsRef.current?.value ?? String(editRule.points), 10),
        description: ruleDescRef.current?.value || editRule.description,
        cap_period: ruleCapPeriodRef.current?.value || null,
        cap: parseInt(ruleCapRef.current?.value ?? '0', 10) || null,
        is_active: editRule.is_active,
        requires_verification: editRule.requires_verification,
      };
      if (editRule.id === 'new') {
        await supabase.from('point_rules').insert({ ...updates, rule_key: editRule.rule_key, label: editRule.label });
        const { data } = await supabase.from('point_rules').select('id,rule_key,label,points,description,is_active,cap_period,cap,requires_verification').order('points', { ascending: false });
        if (data) setRules(data as RuleRow[]);
      } else {
        await supabase.from('point_rules').update(updates).eq('id', editRule.id);
        setRules(rs => rs.map(r => r.id === editRule.id ? { ...r, ...updates } : r));
      }
      setEditRule(null);
    } catch { /* silent */ }
    finally { setSavingRule(false); }
  };

  const toggleRule = async (ruleId: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from('point_rules').update({ is_active: !current }).eq('id', ruleId);
    setRules(rs => rs.map(r => r.id === ruleId ? { ...r, is_active: !current } : r));
  };

  const saveLeaderVis = async (vis: string) => {
    setLeaderVis(vis);
    try {
      const supabase = createClient();
      await supabase.from('leaderboard_settings').upsert({ id: 1, visibility: vis });
    } catch { /* table may not exist */ }
  };

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    return log.filter(l => new Date(l.created_at).toDateString() === ds).reduce((s, l) => s + (l.delta ?? 0), 0);
  });
  const last7Labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
  });

  const FUNNEL_ORDER = ['sent', 'clicked', 'joined', 'attended', 'active'];
  const funnelSorted = FUNNEL_ORDER.map(k => funnel.find(f => f.state === k) ?? { state: k, count: 0 });

  const LOG_COL = '1.5fr 2fr 80px 100px';
  const RULE_COL = '2fr 1.5fr 80px 80px 60px 60px';

  return (
    <>
      <AdminTopbar
        title="Growth & Rewards"
        subtitle="Points · referrals · leaderboard"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditRule({ id: 'new', rule_key: '', label: 'New rule', points: 10, description: null, is_active: true, cap_period: null, cap: null, requires_verification: false })} className="btn btn-ghost btn-sm">
              <Icon name="plus" size={15} /> Add rule
            </button>
            <button onClick={() => setShowAward(true)} className="btn btn-primary btn-sm">
              <Icon name="zap" size={16} color="#fff" /> Award points
            </button>
          </div>
        }
      />
      <AdminBody>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--r-sm)', background: '#fff3f3', border: '1px solid #ffc5c5', color: '#c0392b', fontSize: 13, marginBottom: 16 }}>
            <Icon name="info" size={16} /> Could not load growth data
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[120, 48, 48, 48].map((h, i) => <Skeleton key={i} h={h} />)}
          </div>
        ) : (
          <>
            <Panel title="Points awarded — last 7 days" action={<span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{last7.reduce((a, b) => a + b, 0)} pts total</span>}>
              <div style={{ overflowX: 'auto' }}>
                <Bars data={last7} labels={last7Labels} w={420} h={120} />
              </div>
            </Panel>

            <div style={{ display: 'flex', gap: 8, margin: '18px 0 14px' }}>
              {(['log', 'rules', 'referrals'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ textTransform: 'capitalize' }}>{t}</button>
              ))}
            </div>

            {/* Activity log */}
            {tab === 'log' && (
              <Panel title={`${log.length} transactions`} pad={false}>
                <THead cols={['Member', 'Reason', 'Points', 'Date']} template={LOG_COL} />
                {log.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No point transactions yet</div>
                ) : log.map(l => (
                  <TRow key={l.id} template={LOG_COL}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={(l.members as { name: string } | null)?.name ?? '?'} size={26} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{(l.members as { name: string } | null)?.name ?? '—'}</span>
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{l.reason ?? '—'}</span>
                    <span className="tnum" style={{ fontWeight: 700, color: (l.delta ?? 0) >= 0 ? 'var(--navy)' : '#e74c3c' }}>
                      {(l.delta ?? 0) >= 0 ? '+' : ''}{l.delta}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(l.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </TRow>
                ))}
              </Panel>
            )}

            {/* Point rules */}
            {tab === 'rules' && (
              <Panel title="Point rules" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Invitations stay highest</span>} pad={false}>
                <THead cols={['Action', 'Description', 'Points', 'Cap', 'Verify', 'Active']} template={RULE_COL} />
                {rules.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No rules yet — add one above</div>
                ) : rules.map(r => (
                  <TRow key={r.id} template={RULE_COL} onClick={() => setEditRule(r)}>
                    <span style={{ fontWeight: 600 }}>{r.label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.description ?? r.rule_key}</span>
                    <span className="tnum" style={{ fontWeight: 800, color: 'var(--navy)' }}>+{r.points}</span>
                    <span className="tnum" style={{ color: 'var(--muted)', fontSize: 12 }}>{r.cap ? `${r.cap}/${r.cap_period ?? '—'}` : '—'}</span>
                    {r.requires_verification ? <Icon name="shieldcheck" size={17} color="var(--navy)" /> : <span style={{ color: 'var(--faint)' }}>—</span>}
                    <button onClick={e => { e.stopPropagation(); toggleRule(r.id, r.is_active); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: r.is_active ? 'var(--navy-tint)' : 'var(--surface-2)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: r.is_active ? 'var(--navy)' : 'var(--faint)' }}>
                      <Icon name={r.is_active ? 'check' : 'x'} size={13} />{r.is_active ? 'On' : 'Off'}
                    </button>
                  </TRow>
                ))}
              </Panel>
            )}

            {/* Referrals */}
            {tab === 'referrals' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Panel title="Referral funnel">
                  <Bars data={funnelSorted.map(f => f.count)} labels={funnelSorted.map(f => FUNNEL_LABELS[f.state] ?? f.state)} w={400} h={160} />
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    {[['Join rate', funnelSorted[0].count > 0 ? `${Math.round((funnelSorted[2].count / funnelSorted[0].count) * 100)}%` : '—'],
                      ['Now active', funnelSorted[4].count],
                      ['Reg. via ref.', funnelSorted[2].count]].map(([l, v]) => (
                      <div key={String(l)} style={{ textAlign: 'center' }}>
                        <div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Panel title="Top inviters" pad={false}>
                    {topInviters.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No referral data yet</div>
                    ) : topInviters.map((inv, i) => (
                      <TRow key={inv.name} template="auto 1fr auto">
                        <span className="tnum" style={{ fontWeight: 800, color: 'var(--muted)', width: 18 }}>{i + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar name={inv.name} size={28} tone="soft" />
                          <span style={{ fontWeight: 600 }}>{inv.name}</span>
                        </div>
                        <span className="tnum" style={{ fontWeight: 700 }}>{inv.count} joined</span>
                      </TRow>
                    ))}
                  </Panel>

                  <Panel title="Leaderboard visibility">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {VIS_OPTIONS.map(({ k, t, d }) => {
                        const active = leaderVis === k;
                        return (
                          <button key={k} onClick={() => saveLeaderVis(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, background: active ? 'var(--navy-tint)' : 'var(--surface)', border: active ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', cursor: 'pointer' }}>
                            <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', border: active ? '6px solid var(--navy)' : '2px solid var(--line-2)', background: '#fff', display: 'block' }} />
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
              </div>
            )}
          </>
        )}
      </AdminBody>

      {/* Edit rule modal */}
      {editRule && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setEditRule(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 16, padding: 24, width: 400, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>{editRule.id === 'new' ? 'Add rule' : `Edit: ${editRule.label}`}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editRule.id === 'new' && (
                <>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Rule name *</div>
                    <input defaultValue={editRule.label} onChange={e => setEditRule(r => r ? { ...r, label: e.target.value } : r)} className="input" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Rule key * <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(unique, lowercase_underscores)</span></div>
                    <input defaultValue={editRule.rule_key} onChange={e => setEditRule(r => r ? { ...r, rule_key: e.target.value.toLowerCase().replace(/\s+/g, '_') } : r)} placeholder="e.g. win_logged" className="input" style={{ width: '100%', fontFamily: 'monospace' }} />
                  </div>
                </>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Points</div>
                <input ref={rulePointsRef} type="number" defaultValue={editRule.points} className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Description</div>
                <input ref={ruleDescRef} defaultValue={editRule.description ?? ''} placeholder="Brief description…" className="input" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Cap period</div>
                  <select ref={ruleCapPeriodRef} defaultValue={editRule.cap_period ?? ''} className="input" style={{ width: '100%' }}>
                    <option value="">None</option>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="cycle">Cycle</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Cap count</div>
                  <input ref={ruleCapRef} type="number" defaultValue={editRule.cap ?? ''} placeholder="e.g. 5" className="input" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={!!editRule.requires_verification} onChange={e => setEditRule(r => r ? { ...r, requires_verification: e.target.checked } : r)} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Requires verification</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={editRule.is_active} onChange={e => setEditRule(r => r ? { ...r, is_active: e.target.checked } : r)} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Active</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditRule(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={saveRule} disabled={savingRule} className="btn btn-primary" style={{ flex: 1 }}>
                {savingRule ? 'Saving…' : 'Save rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award points modal */}
      {showAward && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowAward(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 16, padding: 24, width: 360, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Award points</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Member *</div>
                <select ref={memberRef} className="input" style={{ width: '100%' }}>
                  <option value="">Select member…</option>
                  {memberOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Points *</div>
                <input ref={pointsRef} type="number" placeholder="e.g. 10" className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Reason *</div>
                <input ref={reasonRef} placeholder="e.g. Completed mentorship session" className="input" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAward(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={awardPoints} disabled={awarding} className="btn btn-primary" style={{ flex: 1 }}>
                {awarding ? 'Awarding…' : 'Award points'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
