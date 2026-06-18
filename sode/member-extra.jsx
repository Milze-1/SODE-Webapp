// SODE — additional member screens: Forms (M4), Learn (M5), Mentorship (M6), Attendance (M7), Share (M11).
const { useState: useStateE } = React;

/* ============================ FORMS (M4) ============================ */
const OPEN_FORMS = [
  { id: 'f1', title: 'Monthly Pulse + NPS', secs: 60, due: 'Jun 20', pillar: null, kind: 'survey', desc: 'How are you doing this month?' },
  { id: 'f2', title: 'Business check-in', secs: 90, due: 'Jun 25', pillar: 'business', kind: 'form', desc: 'Revenue, customers & blockers' },
  { id: 'f3', title: 'Baseline Survey', secs: 240, due: 'Jun 30', pillar: null, kind: 'form', desc: 'Where you\'re starting from' },
];
function FormsScreen({ app }) {
  return (
    <>
      <AppHeader title="Forms & surveys" subtitle="Open to you" app={app} />
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* pinned wins */}
        <button onClick={() => app.openSheet('win')} style={{ textAlign: 'left', borderRadius: 'var(--r-md)', background: 'var(--navy)', color: '#fff', padding: 16, display: 'flex', alignItems: 'center', gap: 13, boxShadow: 'var(--sh-md)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="sparkles" size={22} color="#fff" stroke={2.1} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800 }}>Share a win</div><div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', marginTop: 1 }}>Always open · about 60 seconds</div></div>
          <Icon name="chevronright" size={20} color="rgba(255,255,255,.7)" />
        </button>

        <div>
          <SectionHead title="Open for you" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OPEN_FORMS.map(f => (
              <button key={f.id} onClick={() => f.kind === 'survey' ? app.openSheet('survey') : app.showToast({ msg: 'Opening form…' })} className="card card-pad" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={f.kind === 'survey' ? 'trendingup' : 'list'} size={21} stroke={2} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{f.desc}</div>
                  <div className="tnum" style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5, display: 'flex', gap: 10 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="clock" size={12} /> ~{f.secs}s</span><span>Due {f.due}</span></div>
                </div>
                <Icon name="chevronright" size={20} color="var(--faint)" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionHead title="Completed" />
          <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13, opacity: .8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="check" size={20} stroke={2.6} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>Quarterly Pulse — Q1</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Submitted Apr 2 · thank you</div></div>
            <StatusPill status="done" size="sm" />
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- NPS / Pulse survey flow ---------- */
const SURVEY_Q = [
  { id: 'nps', type: 'nps', q: 'How likely are you to recommend SODE to a friend?', sub: '0 = not likely · 10 = absolutely' },
  { id: 'growth', type: 'choice', q: 'How much have you grown this month?', options: ['A lot', 'Some', 'A little', 'Not yet'] },
  { id: 'support', type: 'choice', q: 'Where could we support you more?', options: ['Spiritual', 'Career', 'Business', 'Character'] },
  { id: 'note', type: 'text', q: 'Anything you\'d like us to know?', sub: 'Optional — a sentence is plenty.' },
];
function SurveyFlow({ app }) {
  const [i, setI] = useStateE(0);
  const [ans, setAns] = useStateE({});
  const q = SURVEY_Q[i];
  const set = (v) => setAns(a => ({ ...a, [q.id]: v }));
  const last = i === SURVEY_Q.length - 1;
  const canNext = q.type === 'text' ? true : ans[q.id] != null;
  const submit = () => { app.closeSheet(); app.showToast({ msg: 'Thanks — your pulse is in.', icon: 'heart' }); };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Monthly Pulse</h2>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={12} stroke={2.6} color="var(--navy)" /> Autosaved</span>
      </div>
      <div style={{ display: 'flex', gap: 5, margin: '12px 0 22px' }}>
        {SURVEY_Q.map((_, j) => <div key={j} style={{ flex: 1, height: 5, borderRadius: 3, background: j <= i ? 'var(--navy)' : 'var(--surface-2)' }} />)}
      </div>
      <div style={{ minHeight: 150 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3 }}>{q.q}</div>
        {q.sub && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{q.sub}</div>}
        <div style={{ marginTop: 20 }}>
          {q.type === 'nps' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7 }}>
                {Array.from({ length: 11 }).map((_, n) => {
                  const sel = ans.nps === n;
                  return <button key={n} onClick={() => set(n)} className="tnum" style={{ height: 46, borderRadius: 12, fontSize: 16, fontWeight: 700, background: sel ? 'var(--navy)' : 'var(--surface)', color: sel ? '#fff' : 'var(--ink)', border: sel ? 'none' : '1px solid var(--line-2)' }}>{n}</button>;
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginTop: 8, fontWeight: 600 }}><span>Not likely</span><span>Absolutely</span></div>
            </div>
          )}
          {q.type === 'choice' && <OptionChips options={q.options} value={ans[q.id]} onChange={set} columns={2} />}
          {q.type === 'text' && <TextInput value={ans[q.id] || ''} onChange={set} multiline rows={4} placeholder="Type here…" />}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-ghost" style={{ paddingLeft: 16, paddingRight: 16 }}><Icon name="arrowleft" size={18} /></button>}
        {last ? <button onClick={submit} disabled={!canNext} className="btn btn-primary btn-block">Submit pulse</button>
              : <button onClick={() => setI(i + 1)} disabled={!canNext} className="btn btn-primary btn-block">Continue</button>}
      </div>
    </div>
  );
}

/* ============================ LEARN (M5) ============================ */
const COURSES = [
  { id: 'c1', title: 'Excellence at Work', pillar: 'career', provider: 'SODE Academy', status: 'inprogress', pct: 0.6 },
  { id: 'c2', title: 'Foundations of Faith', pillar: 'spiritual', provider: 'SODE Academy', status: 'completed', pct: 1 },
  { id: 'c3', title: 'Starting a Business in Nigeria', pillar: 'business', provider: 'Partner · Lagos SBDC', status: 'pending', pct: 1 },
  { id: 'c4', title: 'Leading Yourself', pillar: 'character', provider: 'SODE Academy', status: 'enrolled', pct: 0 },
];
const READINGS = [
  { id: 'r1', title: 'The Practice of the Presence of God', author: 'Brother Lawrence', type: 'Book', pillar: 'character', why: 'Builds daily faithfulness — Luke 16:10.', status: 'reading' },
  { id: 'r2', title: 'Esther: For Such a Time', author: 'Devotional plan', type: 'Scripture plan', pillar: 'career', why: 'Courage and calling in the marketplace.', status: 'new' },
  { id: 'r3', title: 'Deep Work', author: 'Cal Newport', type: 'Book', pillar: 'career', why: 'Excellence demands focus.', status: 'finished' },
];
function LearnScreen({ app }) {
  const [tab, setTab] = useStateE('courses');
  const statusMeta = { inprogress: { label: 'In progress', s: 'ontrack' }, completed: { label: 'Completed', s: 'done' }, pending: { label: 'Verify pending', s: 'atrisk' }, enrolled: { label: 'Not started', s: 'behind' } };
  return (
    <>
      <AppHeader title="Learn" subtitle="Grow ten times better" app={app} />
      <div style={{ padding: '14px 16px 24px' }}>
        <div style={{ marginBottom: 16 }}><Segmented options={[{ value: 'courses', label: 'Courses' }, { value: 'readings', label: 'Readings' }]} value={tab} onChange={setTab} /></div>
        {tab === 'courses' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {COURSES.map(c => {
              const m = statusMeta[c.status]; const p = pillarOf(c.pillar);
              return (
                <div key={c.id} className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={p.icon} size={21} stroke={2.1} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{c.provider}</div>
                    </div>
                    {c.status === 'completed' ? <span style={{ color: 'var(--navy)', flex: 'none' }}><Icon name="shieldcheck" size={22} /></span> : <StatusPill status={m.s} size="sm" />}
                  </div>
                  {c.status === 'inprogress' && <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ flex: 1 }}><ProgressBar value={c.pct} color={p.color} /></div><span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{Math.round(c.pct * 100)}%</span></div>}
                  {(c.status === 'inprogress' || c.status === 'enrolled') && <button onClick={() => app.showToast({ msg: 'Marked + upload certificate', icon: 'check' })} className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }}><Icon name="check" size={16} /> Mark complete + upload certificate</button>}
                  {c.status === 'pending' && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="clock" size={14} /> Certificate awaiting leader verification</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: -2 }}>Recommended this month</div>
            {READINGS.map(r => {
              const p = pillarOf(r.pillar);
              return (
                <div key={r.id} className="card card-pad">
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 42, height: 56, borderRadius: 7, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'flex-end', padding: 6, flex: 'none' }}><Icon name="bookopen" size={18} color="#fff" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><PillarChip pillar={r.pillar} size="sm" /><span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>{r.type}</span></div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 6, lineHeight: 1.25 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--faint)' }}>{r.author}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, fontStyle: 'italic', lineHeight: 1.4 }}>{r.why}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                    {r.status === 'finished'
                      ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}><Icon name="check" size={16} stroke={2.6} /> Finished · add a reflection</div>
                      : <><button onClick={() => app.showToast({ msg: r.status === 'reading' ? 'Marked finished 🌱' : 'Added to your shelf' })} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>{r.status === 'reading' ? 'Mark finished' : 'Start reading'}</button></>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ============================ MENTORSHIP (M6) ============================ */
function MentorshipScreen({ app }) {
  const milestones = [{ t: 'Set 90-day goals', done: true }, { t: 'CV & LinkedIn reviewed', done: true }, { t: 'Mock interview', done: false }, { t: 'Final sign-off', done: false }];
  const others = [{ name: 'Bisi Lawal', exp: 'Product · Fintech', pillar: 'career' }, { name: 'Tunde Cole', exp: 'Founder · Retail', pillar: 'business' }];
  return (
    <>
      <AppHeader title="Mentorship" subtitle="Active pairing" app={app} back={() => app.setTab('home')} />
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
            <Avatar name="Grace Mentor" size={52} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16.5, fontWeight: 800 }}>Mrs. Grace Adeyemi</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>Senior PM · Fintech · Career pillar</div>
            </div>
            <StatusPill status="ontrack" size="sm" />
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}><Icon name="calendarclock" size={15} /> Next session: Sat, Jun 21 · 10:00 AM</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>Milestones & sign-offs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, flex: 'none', border: m.done ? 'none' : '1.5px solid var(--line-2)', background: m.done ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.done && <Icon name="check" size={13} stroke={3} color="#fff" />}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: m.done ? 'var(--faint)' : 'var(--ink)' }}>{m.t}</span>
                  {m.done && <span style={{ fontSize: 11, color: 'var(--navy)', marginLeft: 'auto', fontWeight: 600 }}>Signed</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
              <button onClick={() => app.showToast({ msg: 'Opening WhatsApp…' })} className="btn btn-ghost btn-sm" style={{ flex: 1 }}><Icon name="message" size={16} /> Message</button>
              <button onClick={() => app.showToast({ msg: 'Opening email…' })} className="btn btn-outline btn-sm" style={{ flex: 1 }}><Icon name="mail" size={16} /> Email</button>
            </div>
          </div>
        </div>

        <div>
          <SectionHead title="Explore more mentors" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {others.map((o, i) => (
              <div key={i} className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={o.name} size={42} tone="soft" />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{o.name}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{o.exp}</div><div style={{ marginTop: 6 }}><PillarChip pillar={o.pillar} size="sm" /></div></div>
                <button onClick={() => app.showToast({ msg: 'Request sent', icon: 'check' })} className="btn btn-ghost btn-sm" style={{ flex: 'none' }}>Request</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================ ATTENDANCE (M7) ============================ */
function AttendanceScreen({ app }) {
  const [checkedIn, setCheckedIn] = useStateE(false);
  const history = [
    { t: 'Sunday Service', d: 'Jun 9', s: 'present' }, { t: 'SODE Session', d: 'Jun 5', s: 'present' },
    { t: 'Sunday Service', d: 'Jun 2', s: 'present' }, { t: 'SODE Session', d: 'May 29', s: 'excused' },
    { t: 'Sunday Service', d: 'May 26', s: 'absent' },
  ];
  const sMeta = { present: { l: 'Present', s: 'done' }, excused: { l: 'Excused', s: 'atrisk' }, absent: { l: 'Missed', s: 'behind' } };
  const doCheckIn = () => {
    setCheckedIn(true);
    if (app.offline) app.showToast({ msg: 'Saved on your phone. We\'ll sync your check-in.', kind: 'offline' });
    else app.showToast({ msg: 'Checked in. Good to see you.', icon: 'check' });
  };
  return (
    <>
      <AppHeader title="Attendance" subtitle="Your sessions" app={app} back={() => app.setTab('home')} />
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* check-in */}
        <div className="card" style={{ overflow: 'hidden', textAlign: 'center', padding: '22px 18px' }}>
          {!checkedIn ? (
            <>
              <div style={{ width: 60, height: 60, margin: '0 auto', borderRadius: 18, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="mappin" size={28} stroke={2} /></div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 14 }}>Sunday Service is live</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Victoria Island · check-in open until 4:30 PM</div>
              <button onClick={doCheckIn} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }}><Icon name="check" size={20} stroke={2.4} color="#fff" /> Check in now</button>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10 }}>One tap — we confirm by time + location.</div>
            </>
          ) : (
            <>
              <div style={{ width: 60, height: 60, margin: '0 auto', borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}><Icon name="check" size={32} stroke={2.6} color="#fff" /></div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 14 }}>{app.offline ? 'Saved — will sync' : 'You\'re checked in'}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Sunday Service · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
            </>
          )}
        </div>

        <div>
          <SectionHead title="History" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {history.map((h, i) => {
              const m = sMeta[h.s];
              return (
                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="calendarclock" size={18} stroke={2} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{h.t}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{h.d}</div></div>
                  <StatusPill status={m.s} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================ SHARE / ADVOCACY (M11) ============================ */
const ADVOCACY = [
  { id: 'a1', title: '“Ten times better” — this week at SODE', tag: 'Testimony reel', pillar: 'spiritual', pts: 10, shares: 2, clicks: 47 },
  { id: 'a2', title: 'Free masterclass: Excellence at Work', tag: 'Event', pillar: 'career', pts: 10, shares: 0, clicks: 0 },
  { id: 'a3', title: 'Meet the Daniels & Esthers of Victoria Island', tag: 'Story', pillar: 'character', pts: 10, shares: 1, clicks: 18 },
];
function ShareScreen({ app }) {
  const platforms = ['whatsapp', 'instagram', 'x', 'linkedin'];
  const picon = { whatsapp: 'message', instagram: 'camera', x: 'share', linkedin: 'briefcase' };
  return (
    <>
      <AppHeader title="Share" subtitle="Help the message travel" app={app} back={() => app.setTab('home')} />
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* impact strip */}
        <div className="card card-pad" style={{ display: 'flex', justifyContent: 'space-around' }}>
          <Stat value="3" label="Shares" align="center" />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <Stat value="65" label="Clicks earned" align="center" />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <Stat value="30" label="Points" align="center" />
        </div>

        <SectionHead title="Share & we'll count every click" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ADVOCACY.map(c => {
            const p = pillarOf(c.pillar);
            return (
              <div key={c.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ height: 130, background: `linear-gradient(135deg, ${p.raw}, var(--navy-ink))`, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                  <div style={{ position: 'absolute', right: -10, top: -10, opacity: .16 }}><Icon name={p.icon} size={96} color="#fff" stroke={1.5} /></div>
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', padding: '4px 9px', borderRadius: 999 }}><Icon name="sparkles" size={12} color="#fff" /> {c.tag}</span>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{c.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {platforms.map(pl => <button key={pl} onClick={() => app.addPoints(10) || app.showToast({ msg: `Shared to ${pl} 🌱`, points: 10 })} style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={picon[pl]} size={18} stroke={2} /></button>)}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--navy)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="zap" size={13} /> +{c.pts}</span>
                  </div>
                  {(c.shares > 0) && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10, display: 'flex', gap: 12 }}><span>{c.shares} share{c.shares > 1 ? 's' : ''}</span><span className="tnum" style={{ color: 'var(--navy)', fontWeight: 600 }}>{c.clicks} clicks ▲</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { FormsScreen, SurveyFlow, LearnScreen, MentorshipScreen, AttendanceScreen, ShareScreen });
