// SODE — Admin screens A6 Registers, A7 Mentorship, A8 Reports, A9 Settings, A10 Growth, A11 Advocacy.
const { useState: useStateAC } = React;

/* ============================ A6 · REGISTERS ============================ */
const REG = {
  business: { cols: ['Business', 'Owner', 'Stage', 'Verify'], template: '1.3fr 1fr 1fr .7fr', rows: [
    { a: 'Ada\'s Kitchen', b: 'Ada Obi', stage: 'first-customer', v: true }, { a: 'BrightCode', b: 'Emeka Nwosu', stage: 'registered', v: false }, { a: 'Zee Fabrics', b: 'Zainab Bello', stage: 'idea', v: false },
  ] },
  cells: { cols: ['Cell', 'Lead', 'Members', 'Meets'], template: '1.2fr 1fr .7fr 1fr', rows: [
    { a: 'VI Central', b: 'Ada Obi', stage: '14', v: 'Tue 7pm' }, { a: 'Lekki Phase 1', b: 'Tunde Bakare', stage: '11', v: 'Wed 7pm' }, { a: 'Ikoyi', b: 'Grace U.', stage: '9', v: 'Thu 6pm' },
  ] },
  leadership: { cols: ['Leader', 'Role', 'Pillar', 'Since'], template: '1.3fr 1fr 1fr .7fr', rows: [
    { a: 'Sade Adeleke', b: 'Pillar Lead', stage: 'Spiritual', v: '2024' }, { a: 'Tunde Bakare', b: 'Pillar Lead', stage: 'Career', v: '2023' }, { a: 'Ada Obi', b: 'Cell Lead', stage: 'Business', v: '2025' },
  ] },
  certificates: { cols: ['Member', 'Course', 'Artifact', 'Verify'], template: '1.1fr 1.1fr .9fr .7fr', rows: [
    { a: 'Zainab Bello', b: 'Foundations of Faith', stage: 'certificate.pdf', v: true }, { a: 'Emeka Nwosu', b: 'Excellence at Work', stage: 'cert-link', v: false }, { a: 'David Mensah', b: 'Starting a Business', stage: 'photo.jpg', v: false },
  ] },
};
function RegistersScreen({ app }) {
  const [tab, setTab] = useStateAC('business');
  const [verified, setVerified] = useStateAC(new Set());
  const r = REG[tab];
  const verifyCol = tab === 'business' || tab === 'certificates';
  return (
    <>
      <AdminTopbar title="Registers" subtitle="Verified records — guard against success theater" actions={<button onClick={() => app.showToast('Exported register')} className="btn btn-ghost btn-sm"><Icon name="download" size={16} /> Export</button>} />
      <AdminBody>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {[['business', 'Business Registry'], ['cells', 'Cells'], ['leadership', 'Leadership'], ['certificates', 'Certificates']].map(([k, l]) => <FilterChip key={k} active={tab === k} label={l} onClick={() => setTab(k)} />)}
        </div>
        <Panel pad={false}>
          <TRow header template={r.template} cols={r.cols} />
          {r.rows.map((row, i) => {
            const isV = row.v === true || verified.has(tab + i);
            return (
              <TRow key={i} template={r.template} cols={[
                <span style={{ fontWeight: 600 }}>{row.a}</span>,
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={row.b} size={24} tone="grey" />{row.b}</div>,
                verifyCol ? <span style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{row.stage}</span> : <span style={{ color: 'var(--muted)' }}>{row.stage}</span>,
                verifyCol
                  ? (isV ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--navy)', fontWeight: 600, fontSize: 12.5 }}><Icon name="shieldcheck" size={16} /> Verified</span>
                         : <button onClick={() => setVerified(s => new Set(s).add(tab + i))} className="btn btn-primary btn-sm" style={{ height: 30 }}>Verify</button>)
                  : <span style={{ color: 'var(--muted)' }}>{row.v}</span>,
              ]} />
            );
          })}
        </Panel>
      </AdminBody>
    </>
  );
}

/* ============================ A7 · MENTORSHIP CONSOLE ============================ */
function MentorshipConsole({ app }) {
  const [approved, setApproved] = useStateAC(new Set());
  const requests = [{ m: 'Chinaza Okafor', area: 'Career · Product', pillar: 'career' }, { m: 'David Mensah', area: 'Business · Retail', pillar: 'business' }];
  const pairs = [{ a: 'Tofunmi A.', b: 'Grace Adeyemi', s: 'ontrack' }, { a: 'Ada O.', b: 'Tunde Cole', s: 'ontrack' }, { a: 'Emeka N.', b: 'Bisi Lawal', s: 'done' }];
  const capacity = [{ n: 'Grace Adeyemi', used: 2, cap: 3 }, { n: 'Tunde Cole', used: 3, cap: 3 }, { n: 'Bisi Lawal', used: 1, cap: 4 }];
  return (
    <>
      <AdminTopbar title="Mentorship" subtitle="Pairings · requests · capacity" />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Panel title="Open requests" action={<span style={{ fontSize: 12, color: 'var(--muted)' }}>{requests.length - approved.size} pending</span>} pad={false}>
            {requests.map((rq, i) => approved.has(i) ? (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--line)', fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}><Icon name="check" size={16} stroke={2.6} /> Matched {rq.m}</div>
            ) : (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <Avatar name={rq.m} size={32} tone="soft" />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{rq.m}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{rq.area}</div></div>
                <button onClick={() => setApproved(s => new Set(s).add(i))} className="btn btn-primary btn-sm" style={{ height: 30 }}>Match</button>
              </div>
            ))}
          </Panel>
          <Panel title="Mentor capacity">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {capacity.map((c, i) => {
                const full = c.used >= c.cap;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Avatar name={c.n} size={32} tone="grey" />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.n}</div><div style={{ marginTop: 5 }}><ProgressBar value={c.used / c.cap} color={full ? 'var(--p-character)' : 'var(--navy)'} height={6} /></div></div>
                    <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: full ? 'var(--muted)' : 'var(--ink)' }}>{c.used}/{c.cap}{full && ' · full'}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
        <Panel title="Pairing log" pad={false}>
          <TRow header template="1fr 1fr .6fr" cols={['Mentee', 'Mentor', 'Status']} />
          {pairs.map((p, i) => <TRow key={i} template="1fr 1fr .6fr" cols={[
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={p.a} size={26} tone="grey" />{p.a}</div>,
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={p.b} size={26} tone="soft" />{p.b}</div>,
            <StatusPill status={p.s} size="sm" />,
          ]} />)}
        </Panel>
      </AdminBody>
    </>
  );
}

/* ============================ A8 · REPORTS ============================ */
const REPORTS = [
  { k: 'monthly', t: 'Monthly Scorecard', d: 'KPI snapshot + trends for the month', icon: 'grid' },
  { k: 'quarterly', t: 'Quarterly Review pack', d: 'Deep-dive across all four pillars', icon: 'bookopen' },
  { k: 'annual', t: 'Annual Impact Report', d: 'The full year — how far the room climbed', icon: 'trendingup' },
  { k: 'csv', t: 'Per-pillar CSVs', d: 'Raw data export by pillar', icon: 'download' },
];
function ReportsScreen({ app }) {
  const [sel, setSel] = useStateAC('monthly');
  const [phase, setPhase] = useStateAC('configure');
  const [fmt, setFmt] = useStateAC('PDF');
  const r = REPORTS.find(x => x.k === sel);
  const gen = () => { setPhase('generating'); setTimeout(() => setPhase('ready'), 1400); };
  return (
    <>
      <AdminTopbar title="Reports & Export" subtitle="Generate leadership packs" />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REPORTS.map(rp => {
              const active = sel === rp.k;
              return (
                <button key={rp.k} onClick={() => { setSel(rp.k); setPhase('configure'); }} className="card" style={{ textAlign: 'left', padding: 16, display: 'flex', alignItems: 'center', gap: 13, border: active ? '1.5px solid var(--navy)' : '1px solid var(--line)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: active ? 'var(--navy)' : 'var(--surface-2)', color: active ? '#fff' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={rp.icon} size={21} stroke={2} color={active ? '#fff' : 'var(--navy)'} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{rp.t}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{rp.d}</div></div>
                  {active && <Icon name="check" size={20} color="var(--navy)" stroke={2.4} />}
                </button>
              );
            })}
          </div>
          <Panel title={r.t}>
            {phase === 'configure' && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Period</div>
                <div style={{ marginBottom: 16 }}><Segmented options={['This month', 'This quarter', 'This year']} value={'This month'} onChange={() => { }} size="sm" /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Format</div>
                <div style={{ marginBottom: 18 }}><Segmented options={['PDF', 'CSV', 'Slides']} value={fmt} onChange={setFmt} size="sm" /></div>
                <button onClick={gen} className="btn btn-primary btn-block btn-lg"><Icon name="download" size={18} color="#fff" /> Generate {fmt}</button>
              </>
            )}
            {phase === 'generating' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: 48, height: 48, margin: '0 auto', borderRadius: '50%', border: '4px solid var(--surface-2)', borderTopColor: 'var(--navy)', animation: 'sode-spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 16 }}>Generating {r.t}…</div>
              </div>
            )}
            {phase === 'ready' && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={28} stroke={2.4} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>Your {fmt} is ready</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>SODE_{r.k}_Jun2026.{fmt.toLowerCase()}</div>
                <button onClick={() => app.showToast('Downloaded')} className="btn btn-primary" style={{ marginTop: 16 }}><Icon name="download" size={17} color="#fff" /> Download</button>
                <button onClick={() => setPhase('configure')} className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>Generate another</button>
              </div>
            )}
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}

/* ============================ A9 · SETTINGS ============================ */
function SettingsScreen({ app }) {
  const [t, setT] = useStateAC({ sheets: true, resend: true, whatsapp: false, retention: true });
  const tog = (k) => setT(s => ({ ...s, [k]: !s[k] }));
  const SettingRow = ({ icon, title, sub, on, k, action }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={18} stroke={2} /></div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>{sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}</div>
      {k ? <Toggle on={t[k]} onChange={() => tog(k)} /> : action}
    </div>
  );
  return (
    <>
      <AdminTopbar title="Settings" subtitle="Cycle · roles · integrations · data" />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Cycle & baseline" pad={false}>
              <SettingRow icon="calendarclock" title="Active cycle" sub="2026 Growth Cycle · Month 4 of 12" action={<button className="btn btn-ghost btn-sm" onClick={() => app.showToast('Editing cycle')}>Edit</button>} />
              <SettingRow icon="flag" title="Baselines captured" sub="Month 0 baselines locked" action={<StatusPill status="done" size="sm" />} />
            </Panel>
            <Panel title="Roles & invites" pad={false}>
              <SettingRow icon="users" title="Pillar Leads" sub="4 assigned · scoped to their pillar" action={<button className="btn btn-ghost btn-sm" onClick={() => app.showToast('Manage roles')}>Manage</button>} />
              <SettingRow icon="userplus" title="Invite a leader" sub="Send a back-office invite" action={<button className="btn btn-primary btn-sm" onClick={() => app.showToast('Invite sent')}>Invite</button>} />
            </Panel>
            <Panel title="Status thresholds" pad={false}>
              <SettingRow icon="trendingup" title="On track ≥" sub="90% of pace" action={<span className="tnum" style={{ fontWeight: 700 }}>90%</span>} />
              <SettingRow icon="minus" title="At risk ≥" sub="70% of pace" action={<span className="tnum" style={{ fontWeight: 700 }}>70%</span>} />
            </Panel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Integrations" pad={false}>
              <SettingRow icon="refresh" title="Google Sheets" sub="Attendance + responses sync" k="sheets" />
              <SettingRow icon="mail" title="Resend (email)" sub="Reminders & recaps" k="resend" />
              <SettingRow icon="message" title="WhatsApp Business" sub="Connect to send nudges" k="whatsapp" />
            </Panel>
            <Panel title="Notification templates" pad={false}>
              <SettingRow icon="bell" title="Win celebrate" sub="“Logged. Well done.”" action={<button className="btn btn-ghost btn-sm" onClick={() => app.showToast('Editing template')}>Edit</button>} />
              <SettingRow icon="calendarclock" title="Session reminder" sub="Sent 2h before" action={<button className="btn btn-ghost btn-sm" onClick={() => app.showToast('Editing template')}>Edit</button>} />
            </Panel>
            <Panel title="Data & retention" pad={false}>
              <SettingRow icon="shieldcheck" title="NDPA mode" sub="Honour export & delete requests" k="retention" />
              <SettingRow icon="download" title="Export all data" sub="Full org backup" action={<button className="btn btn-ghost btn-sm" onClick={() => app.showToast('Preparing backup')}>Export</button>} />
            </Panel>
          </div>
        </div>
      </AdminBody>
    </>
  );
}

/* ============================ A10 · GROWTH & REWARDS ============================ */
const POINT_RULES = [
  { key: 'invite_joined', label: 'Invited member joins', val: 50, cap: '—', verify: true },
  { key: 'invite_attended', label: 'Invited attends a session', val: 30, cap: '—', verify: true },
  { key: 'goal_complete', label: 'Complete a personal goal', val: 20, cap: '5/mo', verify: false },
  { key: 'share', label: 'Share SODE content', val: 10, cap: '10/wk', verify: false },
  { key: 'win', label: 'Log a win', val: 5, cap: '3/day', verify: false },
];
const FUNNEL = [{ l: 'Sent', v: 142 }, { l: 'Clicked', v: 96 }, { l: 'Joined', v: 38 }, { l: 'Attended', v: 24 }, { l: 'Active', v: 17 }];
function GrowthConsole({ app }) {
  const [vis, setVis] = useStateAC('members');
  return (
    <>
      <AdminTopbar title="Growth & Rewards" subtitle="Points · referrals · leaderboard" actions={<button onClick={() => app.showToast('Rules saved')} className="btn btn-primary btn-sm"><Icon name="check" size={16} color="#fff" /> Save rules</button>} />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Panel title="Points rules" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Invitations stay highest</span>} pad={false}>
            <TRow header template="1.4fr .6fr .6fr .6fr" cols={['Action', 'Points', 'Cap', 'Verify']} />
            {POINT_RULES.map((r, i) => (
              <TRow key={i} template="1.4fr .6fr .6fr .6fr" cols={[
                <span style={{ fontWeight: 600 }}>{r.label}</span>,
                <span className="tnum" style={{ fontWeight: 800, color: 'var(--navy)' }}>+{r.val}</span>,
                <span className="tnum" style={{ color: 'var(--muted)' }}>{r.cap}</span>,
                r.verify ? <Icon name="shieldcheck" size={17} color="var(--navy)" /> : <span style={{ color: 'var(--faint)' }}>—</span>,
              ]} />
            ))}
          </Panel>
          <Panel title="Referral funnel">
            <Bars data={FUNNEL.map(f => f.v)} labels={FUNNEL.map(f => f.l)} w={400} h={160} />
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <Stat value="27%" label="Join rate" align="center" /><Stat value="17" label="Now active" align="center" /><Stat value="38" label="Reg. via referral" align="center" />
            </div>
          </Panel>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Panel title="Top inviters" pad={false}>
            {[['Grace Adeyemi', 9], ['Tunde Bakare', 7], ['Ngozi Eze', 5]].map((r, i) => (
              <TRow key={i} template="auto 1fr auto" cols={[<span className="tnum" style={{ fontWeight: 800, color: 'var(--muted)', width: 18 }}>{i + 1}</span>, <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={r[0]} size={28} tone="soft" /><span style={{ fontWeight: 600 }}>{r[0]}</span></div>, <span className="tnum" style={{ fontWeight: 700 }}>{r[1]} joined</span>]} />
            ))}
          </Panel>
          <Panel title="Leaderboard visibility">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[['members', 'Members only', 'Default — signed-in members'], ['public', 'Public link', 'Anyone with the link'], ['indexed', 'Public & indexed', 'Doubles as a growth surface']].map(([k, t, d]) => {
                const active = vis === k;
                return (
                  <button key={k} onClick={() => setVis(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, background: active ? 'var(--navy-tint)' : 'var(--surface)', border: active ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', border: active ? '6px solid var(--navy)' : '2px solid var(--line-2)', background: '#fff' }} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d}</div></div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}

/* ============================ A11 · ADVOCACY MANAGER ============================ */
const POSTS = [
  { t: '“Ten times better” testimony reel', pillar: 'spiritual', status: 'published', shares: 34, clicks: 612 },
  { t: 'Free masterclass: Excellence at Work', pillar: 'career', status: 'scheduled', shares: 0, clicks: 0 },
  { t: 'Meet the Daniels & Esthers of VI', pillar: 'character', status: 'published', shares: 21, clicks: 388 },
  { t: 'How Ada built her business', pillar: 'business', status: 'draft', shares: 0, clicks: 0 },
];
function AdvocacyManager({ app }) {
  const [sel, setSel] = useStateAC(0);
  const post = POSTS[sel];
  const p = pillarOf(post.pillar);
  const stMeta = { published: 'done', scheduled: 'ontrack', draft: 'behind' };
  return (
    <>
      <AdminTopbar title="Advocacy content" subtitle="Curate what members amplify" actions={<button onClick={() => app.showToast('New post draft created')} className="btn btn-primary btn-sm"><Icon name="plus" size={16} stroke={2.4} color="#fff" /> New post</button>} />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, alignItems: 'start' }}>
          <Panel pad={false}>
            {POSTS.map((po, i) => {
              const pp = pillarOf(po.pillar); const active = sel === i;
              return (
                <div key={i} onClick={() => setSel(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: active ? 'var(--navy-tint)' : 'transparent' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `linear-gradient(135deg, ${pp.raw}, var(--navy-ink))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={pp.icon} size={20} color="#fff" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{po.t}</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{po.shares} shares · {po.clicks} clicks</div></div>
                  <StatusPill status={stMeta[po.status]} size="sm" />
                </div>
              );
            })}
          </Panel>
          <Panel title="Post editor">
            <div style={{ height: 120, borderRadius: 12, background: `linear-gradient(135deg, ${p.raw}, var(--navy-ink))`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -8, top: -8, opacity: .18 }}><Icon name={p.icon} size={90} color="#fff" stroke={1.5} /></div>
              <button onClick={() => app.showToast('Upload media')} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', position: 'relative' }}><Icon name="camera" size={16} color="#fff" /> Replace media</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Title</div>
            <div style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{post.t}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>Caption</div>
            <div style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>Real stories from real members. Share and we'll count every click. #SODE #TenTimesBetter</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <PillarChip pillar={post.pillar} size="sm" />
              {['Instagram', 'X', 'LinkedIn', 'WhatsApp'].map(pl => <span key={pl} className="chip">{pl}</span>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
              <Stat value={post.shares} label="Shares" align="center" /><Stat value={post.clicks} label="Clicks" align="center" /><Stat value={post.status === 'published' ? 'Live' : post.status} label="Status" align="center" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => app.showToast('Saved draft')} className="btn btn-ghost" style={{ flex: 1 }}>Save draft</button>
              <button onClick={() => app.showToast('Published')} className="btn btn-primary" style={{ flex: 1 }}>Publish</button>
            </div>
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}

Object.assign(window, { RegistersScreen, MentorshipConsole, ReportsScreen, SettingsScreen, GrowthConsole, AdvocacyManager });
