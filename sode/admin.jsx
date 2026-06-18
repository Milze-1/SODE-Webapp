// SODE — Admin app shell + shared chrome + Team Scorecard (A1). Exports to window.
const { useState: useStateA, useRef: useRefA } = React;

const KPIS = [
  { id: 'k1', pillar: 'overall', title: 'Membership growth', cur: 312, tgt: 400, unit: 'members', status: 'ontrack', owner: 'Director', asof: 'Jun 12', source: 'Auto · registrations + referrals', trend: [248, 261, 274, 289, 298, 312], manual: false },
  { id: 'k2', pillar: 'overall', title: 'Average NPS', cur: 62, tgt: 70, unit: 'score', status: 'atrisk', owner: 'Data & Ops', asof: 'Jun 10', source: 'Quarterly pulse survey', trend: [54, 57, 59, 58, 61, 62], manual: false },
  { id: 'k3', pillar: 'spiritual', title: 'Devotion consistency', cur: 74, tgt: 80, unit: '%', status: 'ontrack', owner: 'P. Lead · Spiritual', asof: 'Jun 12', source: 'Self check-ins', trend: [60, 64, 66, 70, 72, 74], manual: false },
  { id: 'k4', pillar: 'spiritual', title: 'Cell attendance', cur: 68, tgt: 85, unit: '%', status: 'atrisk', owner: 'P. Lead · Spiritual', asof: 'Jun 09', source: 'Sheets sync', trend: [72, 70, 69, 71, 67, 68], manual: false },
  { id: 'k5', pillar: 'career', title: 'Certifications earned', cur: 41, tgt: 60, unit: 'certs', status: 'ontrack', owner: 'P. Lead · Career', asof: 'Jun 11', source: 'Verified uploads', trend: [22, 27, 31, 34, 38, 41], manual: false },
  { id: 'k6', pillar: 'career', title: 'Role placements', cur: 9, tgt: 25, unit: 'placed', status: 'behind', owner: 'P. Lead · Career', asof: 'Jun 08', source: 'Manual · self-report', trend: [4, 5, 6, 7, 8, 9], manual: true },
  { id: 'k7', pillar: 'business', title: 'Businesses registered', cur: 18, tgt: 24, unit: 'biz', status: 'ontrack', owner: 'P. Lead · Business', asof: 'Jun 12', source: 'Business registry', trend: [9, 11, 13, 15, 16, 18], manual: false },
  { id: 'k8', pillar: 'business', title: 'First paying customers', cur: null, tgt: 30, unit: 'biz', status: 'pending', owner: 'P. Lead · Business', asof: '—', source: 'Manual · awaiting update', trend: [], manual: true },
  { id: 'k9', pillar: 'character', title: 'Active mentor pairings', cur: 47, tgt: 55, unit: 'pairs', status: 'ontrack', owner: 'P. Lead · Character', asof: 'Jun 12', source: 'Mentorship console', trend: [30, 34, 38, 41, 44, 47], manual: false },
  { id: 'k10', pillar: 'character', title: 'Serving participation', cur: 58, tgt: 75, unit: '%', status: 'atrisk', owner: 'P. Lead · Character', asof: 'Jun 10', source: 'Department registers', trend: [50, 52, 55, 54, 57, 58], manual: false },
];

/* ---------- charts ---------- */
function Spark({ data, color = 'var(--navy)', w = 96, h = 30 }) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / rng) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
}
function LineChart({ data, color = 'var(--navy)', w = 360, h = 150, labels }) {
  const min = Math.min(...data) * 0.92, max = Math.max(...data) * 1.04, rng = max - min || 1;
  const x = (i) => 8 + (i / (data.length - 1)) * (w - 16);
  const y = (v) => h - 24 - ((v - min) / rng) * (h - 40);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${h - 24} L${x(0)} ${h - 24} Z`;
  const months = labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((t, i) => <line key={i} x1="8" x2={w - 8} y1={24 + t * (h - 48)} y2={24 + t * (h - 48)} stroke="var(--line)" strokeWidth="1" />)}
      <path d={area} fill={color} opacity="0.08" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
      {data.map((v, i) => <text key={'t' + i} x={x(i)} y={h - 7} fontSize="10" fill="var(--faint)" textAnchor="middle" fontFamily="var(--font)">{months[i]}</text>)}
    </svg>
  );
}
function Bars({ data, color = 'var(--navy)', w = 360, h = 150, labels }) {
  const max = Math.max(...data) || 1; const bw = (w - 16) / data.length;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 34); return <g key={i}><rect x={8 + i * bw + bw * 0.18} y={h - 22 - bh} width={bw * 0.64} height={bh} rx="4" fill={color} opacity={0.85} /><text x={8 + i * bw + bw / 2} y={h - 7} fontSize="10" fill="var(--faint)" textAnchor="middle" fontFamily="var(--font)">{labels[i]}</text></g>;
      })}
    </svg>
  );
}

/* ---------- shared admin chrome ---------- */
function AdminTopbar({ title, subtitle, actions }) {
  return (
    <div style={{ minHeight: 60, flex: 'none', borderBottom: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px' }}>
      <div style={{ flex: 'none' }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {actions}
    </div>
  );
}
function AdminBody({ children }) {
  return <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>;
}
function FilterChip({ active, label, icon, onClick }) {
  return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: active ? 'var(--navy)' : 'var(--bg)', color: active ? '#fff' : 'var(--ink)', border: active ? 'none' : '1px solid var(--line-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>{icon && <Icon name={icon} size={15} stroke={2.2} color={active ? '#fff' : 'var(--muted)'} />}{label}</button>;
}
function AdminSearch({ placeholder = 'Search…' }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 13px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)', width: 200, color: 'var(--faint)', fontSize: 13, whiteSpace: 'nowrap', flex: 'none' }}><Icon name="search" size={16} /> {placeholder}</div>;
}
function CyclePill() {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 13px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}><Icon name="calendarclock" size={16} color="var(--muted)" /> Month 4 of 12 <Icon name="chevrondown" size={15} color="var(--muted)" /></div>;
}
// section card title
function Panel({ title, action, children, pad = true }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {title && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3 style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</h3>{action}</div>}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </div>
  );
}

/* ---------- KPI card + drawer (A1) ---------- */
function KpiCard({ k, onClick }) {
  const p = pillarOf(k.pillar);
  const color = k.pillar === 'overall' ? 'var(--navy)' : p.color;
  if (k.status === 'pending') {
    return (
      <button onClick={onClick} style={{ textAlign: 'left', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-2)', background: 'var(--surface)', padding: 16, minHeight: 150 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{k.pillar !== 'overall' && <span style={{ color }}><Icon name={p.icon} size={15} stroke={2.2} /></span>}<span style={{ fontSize: 13.5, fontWeight: 700 }}>{k.title}</span></div>
        <div style={{ marginTop: 22, textAlign: 'center', color: 'var(--muted)' }}><Icon name="clock" size={22} /><div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>Awaiting update</div><div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>Manual KPI · owner notified</div></div>
      </button>
    );
  }
  const pct = k.cur / k.tgt;
  return (
    <button onClick={onClick} className="card" style={{ textAlign: 'left', padding: 16, minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'box-shadow .15s, transform .15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--sh-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--sh-sm)'; e.currentTarget.style.transform = 'none'; }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>{k.pillar !== 'overall' && <span style={{ color, flex: 'none' }}><Icon name={p.icon} size={15} stroke={2.2} /></span>}<span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em' }}>{k.title}</span></div>
          <StatusPill status={k.status} size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
          <span className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{k.cur}{k.unit === '%' ? '%' : ''}</span>
          <span className="tnum" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>/ {k.tgt}{k.unit === '%' ? '%' : ` ${k.unit}`}</span>
        </div>
        <div style={{ marginTop: 10 }}><ProgressBar value={pct} color={color} height={6} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar name={k.owner} size={20} tone="grey" /><span style={{ fontSize: 11, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 4 }}>{k.asof}{k.manual && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', padding: '1px 5px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--muted)' }}>MANUAL</span>}</span></div>
        <Spark data={k.trend} color={color} w={60} h={24} />
      </div>
    </button>
  );
}
function KpiDrawer({ k, onClose }) {
  if (!k) return null;
  const p = pillarOf(k.pillar);
  const color = k.pillar === 'overall' ? 'var(--navy)' : p.color;
  const contributors = [
    { name: 'Ada Obi', detail: 'Registered business · Jun 11', status: 'done' },
    { name: 'Emeka Nwosu', detail: 'In progress · 2 of 3', status: 'ontrack' },
    { name: 'Zara Bello', detail: 'No update in 3 weeks', status: 'atrisk' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.32)', animation: 'sode-fade .18s ease' }} />
      <div style={{ position: 'relative', width: 400, maxWidth: '90%', background: 'var(--bg)', height: '100%', boxShadow: '-12px 0 40px rgba(20,29,58,.16)', display: 'flex', flexDirection: 'column', animation: 'sode-drawer .26s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {k.pillar !== 'overall' && <div style={{ marginBottom: 8 }}><PillarChip pillar={k.pillar} size="sm" /></div>}
            <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{k.title}</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}><span className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{k.cur}{k.unit === '%' ? '%' : ''}</span><span className="tnum" style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>/ {k.tgt} target</span><StatusPill status={k.status} size="sm" /></div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flex: 'none' }}><Icon name="x" size={18} /></button>
        </div>
        <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>6-month trend</div>
          <div className="card card-pad" style={{ marginBottom: 18 }}><LineChart data={k.trend} color={color} w={356} h={150} /></div>
          <div style={{ display: 'flex', gap: 9, padding: '12px 13px', borderRadius: 'var(--r-sm)', background: 'var(--navy-tint)', marginBottom: 18 }}><Icon name="info" size={17} stroke={2} color="var(--navy)" style={{ flex: 'none', marginTop: 1 }} /><div style={{ fontSize: 12.5, color: 'var(--navy-700)', lineHeight: 1.45 }}><b>Source:</b> {k.source}. As of {k.asof}. Owned by {k.owner}.</div></div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Contributing members</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contributors.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}><Avatar name={c.name} size={32} tone="grey" /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.detail}</div></div><StatusPill status={c.status} size="sm" /></div>
            ))}
          </div>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}><Icon name="message" size={17} /> Message segment</button>
          <button className="btn btn-primary" style={{ flex: 1 }}><Icon name="flag" size={16} color="#fff" /> Assign follow-up</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- A1 Scorecard ---------- */
function ScorecardScreen({ app }) {
  const [filter, setFilter] = useStateA('all');
  const [sel, setSel] = useStateA(null);
  const shown = filter === 'all' ? KPIS : KPIS.filter(k => k.pillar === filter);
  const counts = { on: KPIS.filter(k => k.status === 'ontrack').length, at: KPIS.filter(k => k.status === 'atrisk').length, be: KPIS.filter(k => k.status === 'behind').length };
  return (
    <>
      <AdminTopbar title="Team Scorecard" subtitle="2026 Growth Cycle" actions={<><CyclePill /><AdminSearch placeholder="Search members…" /><button onClick={() => app.showToast('Exporting monthly pack…')} className="btn btn-primary btn-sm"><Icon name="download" size={16} color="#fff" /> Export</button></>} />
      <AdminBody>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div className="card card-pad" style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--navy)', color: '#fff', border: 'none' }}>
            <ProgressRing value={4 / 12} size={56} stroke={6} color="#fff" track="rgba(255,255,255,.22)"><span className="tnum" style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>33%</span></ProgressRing>
            <div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Cycle health</div><div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>On pace for the year</div></div>
          </div>
          {[{ n: counts.on, l: 'On track', s: 'ontrack' }, { n: counts.at, l: 'At risk', s: 'atrisk' }, { n: counts.be, l: 'Behind', s: 'behind' }].map((c, i) => (
            <div key={i} className="card card-pad" style={{ width: 124, flex: 'none' }}><div style={{ marginBottom: 8 }}><StatusPill status={c.s} size="sm" /></div><div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{c.n}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>KPIs {c.l.toLowerCase()}</div></div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterChip active={filter === 'all'} label="All pillars" onClick={() => setFilter('all')} />
          {PILLARS.map(p => <FilterChip key={p.key} active={filter === p.key} label={p.name} icon={p.icon} onClick={() => setFilter(p.key)} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
          {shown.map(k => <KpiCard key={k.id} k={k} onClick={() => k.status !== 'pending' && setSel(k)} />)}
        </div>
      </AdminBody>
      <KpiDrawer k={sel} onClose={() => setSel(null)} />
    </>
  );
}

/* ---------- Admin shell ---------- */
const ADMIN_NAV = [
  { key: 'scorecard', icon: 'grid', label: 'Scorecard' },
  { key: 'goals', icon: 'target', label: 'Pillar Goals' },
  { key: 'members', icon: 'users', label: 'Members' },
  { key: 'attendance', icon: 'calendarclock', label: 'Attendance' },
  { key: 'forms', icon: 'list', label: 'Forms' },
  { key: 'registers', icon: 'bookopen', label: 'Registers' },
  { key: 'mentorship', icon: 'heart', label: 'Mentorship' },
  { key: 'growth', icon: 'trendingup', label: 'Growth' },
  { key: 'reports', icon: 'download', label: 'Reports' },
  { key: 'advocacy', icon: 'share', label: 'Advocacy' },
  { key: 'settings', icon: 'settings', label: 'Settings' },
];
function AdminApp() {
  const [view, setView] = useStateA('scorecard');
  const [toast, setToast] = useStateA(null);
  const tref = useRefA(null);
  const showToast = (msg) => { setToast(msg); if (tref.current) clearTimeout(tref.current); tref.current = setTimeout(() => setToast(null), 2400); };
  const app = { view, setView, showToast };
  const screens = {
    scorecard: ScorecardScreen, goals: PillarGoalsScreen, members: MembersScreen, attendance: AttendanceConsole,
    forms: FormsBuilder, registers: RegistersScreen, mentorship: MentorshipConsole, growth: GrowthConsole,
    reports: ReportsScreen, advocacy: AdvocacyManager, settings: SettingsScreen,
  };
  const Screen = screens[view] || ScorecardScreen;
  return (
    <div className="sode" style={{ display: 'flex', height: '100%', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
      <aside style={{ width: 230, flex: 'none', background: 'var(--bg)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px' }}><BrandMark size={34} radius={10} /><Wordmark scale={0.82} /></div>
        <nav className="noscroll" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {ADMIN_NAV.map(n => {
            const active = n.key === view;
            return <button key={n.key} onClick={() => setView(n.key)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, cursor: 'pointer', background: active ? 'var(--navy)' : 'transparent', color: active ? '#fff' : 'var(--ink-2)', fontWeight: active ? 700 : 600, fontSize: 13.5, textAlign: 'left', width: '100%' }}><Icon name={n.icon} size={18} stroke={2} color={active ? '#fff' : 'var(--muted)'} /> {n.label}</button>;
          })}
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px 8px 0', borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name="Pastor Dare" size={34} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Pastor Dare</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Director</div></div></div>
          <button onClick={() => app.showToast('Switching to member view…')} className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }}><Icon name="user" size={15} /> Switch to Member</button>
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Screen app={app} />
      </div>
      {toast && (
        <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--navy)', color: '#fff', padding: '11px 18px', borderRadius: 12, boxShadow: 'var(--sh-pop)', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, animation: 'sode-rise .25s ease' }}><Icon name="check" size={16} color="#fff" /> {toast}</div>
      )}
    </div>
  );
}

Object.assign(window, { KPIS, Spark, LineChart, Bars, AdminTopbar, AdminBody, FilterChip, AdminSearch, CyclePill, Panel, KpiCard, KpiDrawer, ScorecardScreen, AdminApp, AdminScorecard: AdminApp });
