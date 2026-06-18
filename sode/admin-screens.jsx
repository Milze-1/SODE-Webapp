// SODE — Admin screens A2 Pillar Goals, A3 Members, A4 Attendance, A5 Forms.
const { useState: useStateAB } = React;

/* tiny table helpers */
function TRow({ cols, template, header, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: template, alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)', fontSize: 13.5, cursor: onClick ? 'pointer' : 'default', background: header ? 'var(--surface)' : 'transparent' }}>
      {cols.map((c, i) => <div key={i} style={{ minWidth: 0, fontSize: header ? 11 : 13.5, fontWeight: header ? 700 : 500, letterSpacing: header ? '.06em' : 0, textTransform: header ? 'uppercase' : 'none', color: header ? 'var(--faint)' : 'var(--ink)' }}>{c}</div>)}
    </div>
  );
}

/* ============================ A2 · PILLAR GOALS ============================ */
const PILLAR_GOALS = {
  spiritual: [
    { t: 'Daily devotion consistency', metric: '% logging devotion', cur: 74, tgt: 80, unit: '%', deadline: 'M6', owner: 'Sade A.', auto: true },
    { t: 'Members plugged into a cell', metric: 'count', cur: 210, tgt: 300, unit: '', deadline: 'M12', owner: 'Sade A.', auto: false },
  ],
  career: [
    { t: 'Certifications earned', metric: 'verified certs', cur: 41, tgt: 60, unit: '', deadline: 'M9', owner: 'Tunde B.', auto: true },
    { t: 'Role placements', metric: 'members placed', cur: 9, tgt: 25, unit: '', deadline: 'M12', owner: 'Tunde B.', auto: false },
  ],
  business: [
    { t: 'Businesses registered', metric: 'registrations', cur: 18, tgt: 24, unit: '', deadline: 'M6', owner: 'Ngozi E.', auto: true },
    { t: 'First paying customers', metric: 'businesses', cur: 11, tgt: 30, unit: '', deadline: 'M9', owner: 'Ngozi E.', auto: false },
  ],
  character: [
    { t: 'Active mentor pairings', metric: 'pairs', cur: 47, tgt: 55, unit: '', deadline: 'M6', owner: 'Joshua D.', auto: true },
    { t: 'Serving participation', metric: '% serving', cur: 58, tgt: 75, unit: '%', deadline: 'M9', owner: 'Joshua D.', auto: false },
  ],
};
function PillarGoalsScreen({ app }) {
  const [pillar, setPillar] = useStateAB('spiritual');
  const p = pillarOf(pillar);
  const goals = PILLAR_GOALS[pillar];
  return (
    <>
      <AdminTopbar title="Pillar Goals" subtitle="SMART goals by pillar · owner-scoped" actions={<><CyclePill /><button onClick={() => app.showToast('New goal form opened')} className="btn btn-primary btn-sm"><Icon name="plus" size={16} stroke={2.4} color="#fff" /> Add goal</button></>} />
      <AdminBody>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {PILLARS.map(pp => <FilterChip key={pp.key} active={pillar === pp.key} label={pp.name} icon={pp.icon} onClick={() => setPillar(pp.key)} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={22} stroke={2.1} /></div>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{p.name}</div><div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>{p.verse}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {goals.map((g, i) => {
            const pct = g.cur / g.tgt;
            return (
              <div key={i} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{g.t}</div><div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3, lineHeight: 1.3 }}>{g.metric} · deadline {g.deadline}</div></div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', padding: '3px 7px', borderRadius: 5, background: g.auto ? 'var(--navy-tint)' : 'var(--surface-2)', color: g.auto ? 'var(--navy)' : 'var(--muted)' }}>{g.auto ? 'AUTO' : 'MANUAL'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}><span className="tnum" style={{ fontSize: 24, fontWeight: 800 }}>{g.cur}{g.unit}</span><span className="tnum" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>/ {g.tgt}{g.unit} target</span></div>
                <div style={{ marginTop: 10 }}><ProgressBar value={pct} color={p.color} height={6} /></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar name={g.owner} size={22} tone="grey" /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{g.owner}</span></div>
                  {g.auto ? <span style={{ fontSize: 12, color: 'var(--faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="refresh" size={13} /> live</span>
                          : <button onClick={() => app.showToast('Value updated · note logged')} className="btn btn-ghost btn-sm">Update value</button>}
                </div>
              </div>
            );
          })}
        </div>
      </AdminBody>
    </>
  );
}

/* ============================ A3 · MEMBERS ============================ */
const SEGMENTS = ['All members', 'First-timers', 'No cert yet', 'High NPS', 'Business owners', 'Overdue check-in'];
const MEMBERS = [
  { name: 'Tofunmi Adeyemi', first: false, stage: 'Career', dept: 'Ushering', role: 'Member', seen: 'Today', mentor: true },
  { name: 'Ada Obi', first: false, stage: 'Business', dept: 'Welfare', role: 'Cell Lead', seen: '2d', mentor: true },
  { name: 'Chinaza Okafor', first: true, stage: 'Spiritual', dept: '—', role: 'Member', seen: 'Today', mentor: false },
  { name: 'Emeka Nwosu', first: false, stage: 'Career', dept: 'Media', role: 'Member', seen: '1d', mentor: false },
  { name: 'David Mensah', first: true, stage: 'Spiritual', dept: '—', role: 'Member', seen: '3d', mentor: false },
  { name: 'Zainab Bello', first: false, stage: 'Character', dept: 'Choir', role: 'Member', seen: '5d', mentor: true },
];
const FIRST_TIMERS = [
  { name: 'Chinaza Okafor', owner: 'Sade A.', due: 'Jun 16', outcome: 'pending' },
  { name: 'David Mensah', owner: 'Tunde B.', due: 'Jun 17', outcome: 'contacted' },
  { name: 'Grace Udo', owner: 'Unassigned', due: 'Jun 18', outcome: 'pending' },
];
function MembersScreen({ app }) {
  const [seg, setSeg] = useStateAB('All members');
  const [sel, setSel] = useStateAB(new Set());
  const toggle = (n) => setSel(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  return (
    <>
      <AdminTopbar title="Members" subtitle="312 total · 2 first-timers this week" actions={<><AdminSearch placeholder="Search members…" /><button onClick={() => app.showToast('Exported segment CSV')} className="btn btn-ghost btn-sm"><Icon name="download" size={16} /> Export</button></>} />
      <AdminBody>
        {/* first-timer queue */}
        <Panel title="First-timer follow-up queue" action={<span style={{ fontSize: 12, color: 'var(--muted)' }}>3 open</span>} pad={false}>
          <TRow header template="1.4fr 1fr .8fr 1fr" cols={['New face', 'Owner', 'Due', 'Quick actions']} />
          {FIRST_TIMERS.map((f, i) => (
            <TRow key={i} template="1.4fr 1fr .8fr 1fr" cols={[
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={f.name} size={28} tone="soft" /><span style={{ fontWeight: 600 }}>{f.name}</span></div>,
              f.owner === 'Unassigned' ? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Unassigned</span> : f.owner,
              <span className="tnum" style={{ color: 'var(--muted)' }}>{f.due}</span>,
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => app.showToast('Marked contacted')} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Mark contacted"><Icon name="check" size={15} /></button>
                <button onClick={() => app.showToast('Opening WhatsApp…')} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="WhatsApp"><Icon name="message" size={15} /></button>
                <button onClick={() => app.showToast('Plugged into department')} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Plug into dept"><Icon name="users" size={15} /></button>
              </div>,
            ]} />
          ))}
        </Panel>

        {/* segments */}
        <div style={{ display: 'flex', gap: 8, margin: '18px 0 14px', flexWrap: 'wrap' }}>
          {SEGMENTS.map(s => <FilterChip key={s} active={seg === s} label={s} onClick={() => setSeg(s)} />)}
        </div>

        {/* bulk bar */}
        {sel.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--navy)', color: '#fff', marginBottom: 12 }}>
            <span className="tnum" style={{ fontWeight: 700 }}>{sel.size} selected</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => app.showToast('Message sent to segment')} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}><Icon name="message" size={15} color="#fff" /> Message</button>
            <button onClick={() => app.showToast('Assigned')} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}><Icon name="flag" size={15} color="#fff" /> Assign</button>
          </div>
        )}

        {/* members table */}
        <Panel pad={false}>
          <TRow header template="1.8fr .7fr .8fr .8fr .6fr" cols={['Member', 'Pillar stage', 'Department', 'Role', 'Last seen']} />
          {MEMBERS.map((m, i) => (
            <TRow key={i} template="1.8fr .7fr .8fr .8fr .6fr" onClick={() => app.showToast(`Opening ${m.name.split(' ')[0]}'s 360…`)} cols={[
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span onClick={e => { e.stopPropagation(); toggle(m.name); }} style={{ width: 18, height: 18, borderRadius: 5, flex: 'none', border: sel.has(m.name) ? 'none' : '1.5px solid var(--line-2)', background: sel.has(m.name) ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel.has(m.name) && <Icon name="check" size={12} stroke={3} color="#fff" />}</span>
                <Avatar name={m.name} size={30} tone="grey" />
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                {m.first && <span style={{ flex: 'none', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'var(--navy)', color: '#fff', whiteSpace: 'nowrap' }}>FIRST-TIMER</span>}
              </div>,
              <PillarChip pillar={m.stage.toLowerCase()} size="sm" />,
              <span style={{ color: m.dept === '—' ? 'var(--faint)' : 'var(--ink)' }}>{m.dept}</span>,
              m.role === 'Member' ? <span style={{ color: 'var(--muted)' }}>{m.role}</span> : <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{m.role}</span>,
              <span className="tnum" style={{ color: 'var(--muted)' }}>{m.seen}</span>,
            ]} />
          ))}
        </Panel>
      </AdminBody>
    </>
  );
}

/* ============================ A4 · ATTENDANCE CONSOLE ============================ */
const SESSIONS = [
  { t: 'Sunday Service', d: 'Jun 16', when: 'upcoming', pct: null, exp: 320 },
  { t: 'Sunday Service', d: 'Jun 9', when: 'past', pct: 78, exp: 318 },
  { t: 'SODE Session', d: 'Jun 5', when: 'past', pct: 64, exp: 140 },
];
const UNMATCHED = [
  { row: 'Tope A. · 0803…', guess: 'Tope Aremu' },
  { row: 'B. Okon · b.okon@…', guess: 'Blessing Okon' },
];
function AttendanceConsole({ app }) {
  const [resolved, setResolved] = useStateAB(new Set());
  const register = [
    { name: 'Tofunmi Adeyemi', s: 'present', src: 'self' }, { name: 'Ada Obi', s: 'present', src: 'leader' },
    { name: 'Emeka Nwosu', s: 'excused', src: 'leader' }, { name: 'Zainab Bello', s: 'absent', src: 'sheet' },
  ];
  return (
    <>
      <AdminTopbar title="Attendance" subtitle="Sessions, registers & Sheets sync" actions={<button onClick={() => app.showToast('Showing check-in QR')} className="btn btn-primary btn-sm"><Icon name="grid" size={16} color="#fff" /> Show check-in code</button>} />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
          {SESSIONS.map((s, i) => (
            <div key={i} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: s.when === 'upcoming' ? 'var(--navy)' : 'var(--faint)' }}>{s.when}</span><span className="tnum" style={{ fontSize: 12, color: 'var(--faint)' }}>{s.d}</span></div>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginTop: 8 }}>{s.t}</div>
              {s.pct != null ? <><div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{s.pct}%</span><span style={{ fontSize: 12, color: 'var(--muted)' }}>of {s.exp}</span></div><div style={{ marginTop: 8 }}><ProgressBar value={s.pct / 100} height={6} /></div></>
                            : <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>{s.exp} expected · check-in opens 3:30</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
          {/* register */}
          <Panel title="Register · Sunday Service, Jun 9" action={<button onClick={() => app.showToast('All marked present')} className="btn btn-ghost btn-sm">Mark all present</button>} pad={false}>
            <TRow header template="1.6fr 1fr .7fr" cols={['Member', 'Status', 'Source']} />
            {register.map((r, i) => (
              <TRow key={i} template="1.6fr 1fr .7fr" cols={[
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={r.name} size={28} tone="grey" /><span style={{ fontWeight: 600 }}>{r.name}</span></div>,
                <StatusPill status={r.s === 'present' ? 'done' : r.s === 'excused' ? 'atrisk' : 'behind'} size="sm" />,
                <span style={{ fontSize: 11.5, color: 'var(--faint)', textTransform: 'capitalize' }}>{r.src}</span>,
              ]} />
            ))}
          </Panel>

          {/* sheets sync */}
          <Panel title="Google Sheets sync">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}><Icon name="refresh" size={17} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Attendance_2026.xlsx</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Last sync 8 min ago · 318 rows</div></div>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--navy)' }} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Unmatched rows ({UNMATCHED.length - resolved.size})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {UNMATCHED.map((u, i) => resolved.has(i) ? (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9, background: 'var(--navy-tint)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600 }}><Icon name="check" size={15} stroke={2.6} /> Matched to {u.guess}</div>
              ) : (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line-2)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{u.row}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Match to <b style={{ color: 'var(--ink)' }}>{u.guess}</b>?</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setResolved(s => new Set(s).add(i))} className="btn btn-primary btn-sm" style={{ height: 30 }}>Confirm</button>
                  </div>
                </div>
              ))}
              {resolved.size === UNMATCHED.length && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 6 }}>All rows resolved 🎉</div>}
            </div>
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}

/* ============================ A5 · FORMS BUILDER & RESPONSES ============================ */
const FIELD_PALETTE = [
  { k: 'text', label: 'Short text', icon: 'pencil' }, { k: 'long', label: 'Long text', icon: 'list' },
  { k: 'number', label: 'Number', icon: 'zap' }, { k: 'single', label: 'Single select', icon: 'check' },
  { k: 'multi', label: 'Multi select', icon: 'grid' }, { k: 'nps', label: 'NPS 0–10', icon: 'trendingup' },
  { k: 'date', label: 'Date', icon: 'calendarclock' }, { k: 'file', label: 'File upload', icon: 'download' },
  { k: 'pillar', label: 'Pillar picker', icon: 'target' }, { k: 'member', label: 'Member picker', icon: 'users' },
];
const NPS_DIST = [2, 1, 1, 2, 3, 5, 8, 12, 18, 22, 16];
function FormsBuilder({ app }) {
  const [view, setView] = useStateAB('builder');
  const [fields, setFields] = useStateAB([{ k: 'text', label: 'Short text' }, { k: 'nps', label: 'NPS 0–10' }, { k: 'single', label: 'Single select' }]);
  const add = (f) => setFields(fs => [...fs, { ...f }]);
  return (
    <>
      <AdminTopbar title="Forms" subtitle="Build · preview · responses" actions={<button onClick={() => app.showToast('Form published')} className="btn btn-primary btn-sm"><Icon name="check" size={16} color="#fff" /> Publish</button>} />
      <AdminBody>
        <div style={{ maxWidth: 340, marginBottom: 18 }}><Segmented options={[{ value: 'builder', label: 'Builder' }, { value: 'responses', label: 'Responses' }, { value: 'import', label: 'Import' }]} value={view} onChange={setView} size="sm" /></div>

        {view === 'builder' && (
          <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr 300px', gap: 16, alignItems: 'start' }}>
            <Panel title="Fields">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {FIELD_PALETTE.map(f => <button key={f.k} onClick={() => add(f)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 600, textAlign: 'left' }}><Icon name={f.icon} size={15} color="var(--navy)" stroke={2.1} /> {f.label}<Icon name="plus" size={14} color="var(--faint)" style={{ marginLeft: 'auto' }} /></button>)}
              </div>
            </Panel>
            <Panel title="Wins Form · canvas" action={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>est. 60s</span>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fields.map((f, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="menu" size={16} color="var(--faint)" />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.label}</div><div style={{ fontSize: 11, color: 'var(--faint)', textTransform: 'capitalize' }}>{f.k} field</div></div>
                    <button onClick={() => setFields(fs => fs.filter((_, j) => j !== i))} style={{ color: 'var(--faint)' }}><Icon name="x" size={16} /></button>
                  </div>
                ))}
                <div style={{ padding: 12, borderRadius: 10, border: '1.5px dashed var(--line-2)', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>Click a field on the left to add it</div>
              </div>
            </Panel>
            <Panel title="Live preview">
              <div style={{ borderRadius: 18, border: '6px solid var(--ink)', overflow: 'hidden', background: 'var(--bg)' }}>
                <div style={{ padding: 16, minHeight: 280 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Wins Form</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>~60 seconds</div>
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {fields.slice(0, 4).map((f, i) => (
                      <div key={i}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
                        {f.k === 'nps' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>{[0, 1, 2, 3, 4, 5].map(n => <div key={n} style={{ height: 26, borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>)}</div>
                          : <div style={{ height: f.k === 'long' ? 56 : 38, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line-2)' }} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {view === 'responses' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Panel title="NPS distribution" action={<span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>NPS 62</span>}>
              <Bars data={NPS_DIST} w={420} h={170} labels={NPS_DIST.map((_, i) => i)} />
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <Stat value="248" label="Responses" align="center" /><Stat value="78%" label="Promoters" align="center" /><Stat value="6%" label="Detractors" align="center" />
              </div>
            </Panel>
            <Panel title="Recent responses" action={<button onClick={() => app.showToast('Exported CSV')} className="btn btn-ghost btn-sm"><Icon name="download" size={15} /> Export</button>} pad={false}>
              <TRow header template="1.4fr .6fr 1fr" cols={['Member', 'NPS', 'Submitted']} />
              {[['Ada Obi', 10, 'Jun 12'], ['Emeka Nwosu', 8, 'Jun 12'], ['Zainab Bello', 9, 'Jun 11'], ['David Mensah', 7, 'Jun 11']].map((r, i) => (
                <TRow key={i} template="1.4fr .6fr 1fr" cols={[<div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={r[0]} size={26} tone="grey" /><span style={{ fontWeight: 600 }}>{r[0]}</span></div>, <span className="tnum" style={{ fontWeight: 700 }}>{r[1]}</span>, <span className="tnum" style={{ color: 'var(--muted)' }}>{r[2]}</span>]} />
              ))}
            </Panel>
          </div>
        )}

        {view === 'import' && (
          <Panel title="Import from Google Forms / Sheet">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', marginBottom: 16 }}>
              <Icon name="link" size={18} color="var(--navy)" /><span style={{ fontSize: 13, color: 'var(--muted)' }}>docs.google.com/forms/d/SODE-pulse-2026</span><span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--navy)' }}>Connected</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>Map columns → fields</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['Timestamp', 'Submitted at'], ['How likely…', 'NPS 0–10'], ['Email Address', 'Member (match)'], ['Comments', 'Long text']].map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, background: 'var(--surface)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m[0]}</span><Icon name="arrowupright" size={16} color="var(--faint)" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{m[1]}</span>
                </div>
              ))}
            </div>
            <button onClick={() => app.showToast('Imported 248 responses')} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>Import 248 responses</button>
          </Panel>
        )}
      </AdminBody>
    </>
  );
}

Object.assign(window, { PillarGoalsScreen, MembersScreen, AttendanceConsole, FormsBuilder });
