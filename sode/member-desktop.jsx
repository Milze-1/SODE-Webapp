// SODE — Member DESKTOP prototype. Sidebar + topbar + desktop layouts. Exports MemberDesktop.
const { useState: useStateD, useRef: useRefD } = React;

const DESK_GOALS = [
  { id: 'g1', pillar: 'spiritual', title: 'Daily devotion streak', current: 18, target: 30, unit: 'days', due: 'Jun 30', status: 'ontrack' },
  { id: 'g2', pillar: 'career', title: 'Finish AWS certification', current: 2, target: 5, unit: 'modules', due: 'Aug 15', status: 'atrisk' },
  { id: 'g3', pillar: 'business', title: 'Land 3 paying customers', current: 1, target: 3, unit: 'customers', due: 'Sep 1', status: 'ontrack' },
  { id: 'g4', pillar: 'character', title: 'Mentor a younger member', current: 4, target: 6, unit: 'sessions', due: 'Jul 30', status: 'ontrack' },
];
const DESK_NAV = [
  { key: 'dashboard', icon: 'home', label: 'Dashboard' },
  { key: 'goals', icon: 'target', label: 'My Goals' },
  { key: 'forms', icon: 'list', label: 'Forms' },
  { key: 'learn', icon: 'bookopen', label: 'Learn' },
  { key: 'mentorship', icon: 'heart', label: 'Mentorship' },
  { key: 'attendance', icon: 'calendarclock', label: 'Attendance' },
  { key: 'invite', icon: 'userplus', label: 'Invite & Earn' },
  { key: 'board', icon: 'trophy', label: 'Leaderboard' },
  { key: 'share', icon: 'share', label: 'Share' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

function DeskHead({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
      <div><h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{title}</h1>{subtitle && <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{subtitle}</p>}</div>
      {right}
    </div>
  );
}
function DPanel({ title, action, children, pad = true }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {title && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid var(--line)' }}><h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>{action}</div>}
      <div style={pad ? { padding: 18 } : undefined}>{children}</div>
    </div>
  );
}

/* ---------- DASHBOARD ---------- */
function DDashboard({ app }) {
  const { points } = app;
  return (
    <>
      <DeskHead title="Good evening, Tofunmi" subtitle="Month 4 of 12 — keep going. Here's you this month." right={<PointsBadge value={points} />} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card card-pad" style={{ background: 'var(--navy)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
          <ProgressRing value={4 / 12} size={58} stroke={6} color="#fff" track="rgba(255,255,255,.22)"><span className="tnum" style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>4/12</span></ProgressRing>
          <div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.62)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>2026 Cycle</div><div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>On pace</div></div>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={24} stroke={2} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>#24 <span className="tnum" style={{ fontSize: 12, color: 'var(--navy)' }}>▲3</span></div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>30 pts to top 20</div></div>
        </div>
        <button onClick={() => app.showToast('Share a win — 60 seconds')} className="card card-pad" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, var(--navy-600), var(--navy))', color: '#fff', border: 'none' }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={24} color="#fff" stroke={2} /></div>
          <div><div style={{ fontSize: 15.5, fontWeight: 800 }}>Share a win</div><div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.74)' }}>Something good happened?</div></div>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, alignItems: 'start' }}>
        <DPanel title="My goals" action={<button onClick={() => app.setView('goals')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>View all</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {DESK_GOALS.slice(0, 4).map(g => <GoalCard key={g.id} goal={g} onClick={() => app.setView('goals')} />)}
          </div>
        </DPanel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <DPanel title="Next up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="calendarclock" size={22} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>Sunday Service</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Sun, Jun 16 · 4:00 PM</div></div>
            </div>
            <button onClick={() => app.setView('attendance')} className="btn btn-primary btn-block btn-sm" style={{ marginTop: 14 }}>Check in</button>
          </DPanel>
          <DPanel title="This month's reading">
            <PillarChip pillar="character" size="sm" />
            <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 8 }}>The Practice of the Presence of God</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>Builds daily faithfulness — Luke 16:10.</div>
          </DPanel>
        </div>
      </div>
    </>
  );
}

/* ---------- GOALS ---------- */
function DGoals({ app }) {
  const [filter, setFilter] = useStateD('all');
  const shown = filter === 'all' ? DESK_GOALS : DESK_GOALS.filter(g => g.pillar === filter);
  return (
    <>
      <DeskHead title="My Goals" subtitle="Personal goals, laddered from your team's pillars." right={<button onClick={() => app.showToast('New goal')} className="btn btn-primary"><Icon name="plus" size={18} stroke={2.4} color="#fff" /> New goal</button>} />
      <div className="card card-pad" style={{ background: 'var(--navy)', color: '#fff', border: 'none', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.62)' }}>Guided · Draft</div><div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>12-Month Career & Calling Roadmap</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.74)', marginTop: 3 }}>3 of 7 prompts answered</div></div>
        <div style={{ width: 200 }}><ProgressBar value={3 / 7} color="#fff" track="rgba(255,255,255,.22)" /></div>
        <button onClick={() => app.showToast('Opening roadmap')} className="btn btn-sm" style={{ background: '#fff', color: 'var(--navy)' }}>Continue</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <FilterChip active={filter === 'all'} label="All" onClick={() => setFilter('all')} />
        {PILLARS.map(p => <FilterChip key={p.key} active={filter === p.key} label={p.short} icon={p.icon} onClick={() => setFilter(p.key)} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {shown.map(g => <GoalCard key={g.id} goal={g} onClick={() => app.showToast('Goal detail')} />)}
      </div>
    </>
  );
}

/* ---------- LEARN ---------- */
function DLearn({ app }) {
  const [tab, setTab] = useStateD('courses');
  return (
    <>
      <DeskHead title="Learn" subtitle="Courses and readings to grow ten times better." />
      <div style={{ maxWidth: 320, marginBottom: 18 }}><Segmented options={[{ value: 'courses', label: 'Courses' }, { value: 'readings', label: 'Readings' }]} value={tab} onChange={setTab} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {tab === 'courses' ? COURSES.map(c => {
          const p = pillarOf(c.pillar);
          return (
            <div key={c.id} className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--surface-2)', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={p.icon} size={22} stroke={2.1} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.title}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{c.provider}</div></div>
                {c.status === 'completed' ? <Icon name="shieldcheck" size={22} color="var(--navy)" /> : <StatusPill status={c.status === 'inprogress' ? 'ontrack' : c.status === 'pending' ? 'atrisk' : 'behind'} size="sm" />}
              </div>
              {c.status === 'inprogress' && <div style={{ marginTop: 12 }}><ProgressBar value={c.pct} color={p.color} /></div>}
            </div>
          );
        }) : READINGS.map(r => {
          return (
            <div key={r.id} className="card card-pad">
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 42, height: 56, borderRadius: 7, background: 'var(--navy)', display: 'flex', alignItems: 'flex-end', padding: 6, flex: 'none' }}><Icon name="bookopen" size={18} color="#fff" /></div>
                <div style={{ flex: 1, minWidth: 0 }}><PillarChip pillar={r.pillar} size="sm" /><div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 7 }}>{r.title}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{r.author}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, fontStyle: 'italic' }}>{r.why}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- INVITE ---------- */
function DInvite({ app }) {
  const invites = [{ name: 'Chinaza Okafor', stage: 'attended' }, { name: 'David Mensah', stage: 'joined' }, { name: 'Funke Bello', stage: 'opened' }, { name: 'Samuel Eze', stage: 'sent' }];
  return (
    <>
      <DeskHead title="Invite & Earn" subtitle="Bring someone into the room — it's the mission, and it earns the most." right={<PointsBadge value={95} />} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <DPanel title="Send invitations">
          <Field label="Name (optional)"><TextInput value="" onChange={() => { }} placeholder="e.g. Ada" /></Field>
          <Field label="Email or phone"><TextInput value="" onChange={() => { }} placeholder="ada@email.com or 080…" icon="mail" /></Field>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '4px 0 7px' }}>Your message</div>
          <TextInput multiline rows={4} value={"Hi! I've been growing with The School of Daniels & Esthers — I'd love for you to come. Here's the room:"} onChange={() => { }} />
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', borderRadius: 10, background: 'var(--navy-tint)', marginTop: 12, marginBottom: 14 }}><Icon name="shieldcheck" size={17} color="var(--navy)" style={{ flex: 'none', marginTop: 1 }} /><div style={{ fontSize: 12, color: 'var(--navy-700)', lineHeight: 1.4 }}>Recipients always see “Reply STOP to opt out.” We keep it respectful.</div></div>
          <button onClick={() => app.showToast('Invitations sent · +5 each', 5)} className="btn btn-primary btn-block btn-lg"><Icon name="userplus" size={19} stroke={2.2} color="#fff" /> Send invitation</button>
        </DPanel>
        <DPanel title="My invitations" action={<span style={{ fontSize: 12, color: 'var(--muted)' }}>{invites.length} sent</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {invites.map((iv, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Avatar name={iv.name} size={36} tone="soft" />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{iv.name}</div><div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{iv.stage}</div></div>
                  <PointsBadge value={invitePoints(iv.stage)} size="sm" />
                </div>
                <LifecycleTracker stage={iv.stage} />
              </div>
            ))}
          </div>
        </DPanel>
      </div>
    </>
  );
}

/* ---------- LEADERBOARD ---------- */
function DBoard({ app }) {
  const [season, setSeason] = useStateD('month');
  return (
    <>
      <DeskHead title="Leaderboard" subtitle="Grow together — invitations earn the most." right={<div style={{ width: 320 }}><Segmented options={[{ value: 'month', label: 'This Month' }, { value: 'cycle', label: 'This Cycle' }, { value: 'all', label: 'All-time' }]} value={season} onChange={setSeason} size="sm" /></div>} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'start' }}>
        <DPanel title="Top of the room" pad>
          <Podium top={BOARD.slice(0, 3)} />
        </DPanel>
        <DPanel pad={false}>
          {BOARD.slice(3).map((m, i) => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <span className="tnum" style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', width: 22 }}>{i + 4}</span>
              <Avatar name={m.name} size={34} tone="grey" />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>{m.badge && <div style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600 }}>{m.badge}</div>}</div>
              <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>{m.pts}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--navy)', color: '#fff' }}>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 800, width: 22 }}>#24</span>
            <Avatar name="Tofunmi Ade" size={34} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>You · Tofunmi</div><div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.72)' }}>30 pts to top 20</div></div>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>{app.points}</span>
          </div>
        </DPanel>
      </div>
    </>
  );
}

/* ---------- generic lighter pages ---------- */
function DForms({ app }) {
  return (
    <>
      <DeskHead title="Forms & Surveys" subtitle="Open to you — short and forgiving." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {OPEN_FORMS.map(f => (
          <button key={f.id} onClick={() => app.showToast('Opening form')} className="card card-pad" style={{ textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={f.kind === 'survey' ? 'trendingup' : 'list'} size={21} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>{f.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{f.desc}</div>
            <div className="tnum" style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>~{f.secs}s · due {f.due}</div>
          </button>
        ))}
      </div>
    </>
  );
}
function DMentorship({ app }) {
  return (
    <>
      <DeskHead title="Mentorship" subtitle="Your active pairing and sign-offs." />
      <div className="card" style={{ overflow: 'hidden', maxWidth: 640 }}>
        <div style={{ background: 'var(--navy)', color: '#fff', padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name="Grace Adeyemi" size={56} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 800 }}>Mrs. Grace Adeyemi</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>Senior PM · Fintech · Career pillar</div></div>
          <StatusPill status="ontrack" size="sm" />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}><Icon name="calendarclock" size={15} /> Next session: Sat, Jun 21 · 10:00 AM</div>
          {[['Set 90-day goals', true], ['CV & LinkedIn reviewed', true], ['Mock interview', false]].map(([t, d], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0' }}><span style={{ width: 22, height: 22, borderRadius: 7, border: d ? 'none' : '1.5px solid var(--line-2)', background: d ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d && <Icon name="check" size={13} stroke={3} color="#fff" />}</span><span style={{ fontSize: 14, fontWeight: 600, color: d ? 'var(--faint)' : 'var(--ink)' }}>{t}</span></div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}><button onClick={() => app.showToast('Message')} className="btn btn-ghost"><Icon name="message" size={16} /> Message</button><button onClick={() => app.showToast('Email')} className="btn btn-outline"><Icon name="mail" size={16} /> Email</button></div>
        </div>
      </div>
    </>
  );
}
function DAttendance({ app }) {
  const [ci, setCi] = useStateD(false);
  const history = [['Sunday Service', 'Jun 9', 'done'], ['SODE Session', 'Jun 5', 'done'], ['Sunday Service', 'Jun 2', 'done'], ['SODE Session', 'May 29', 'atrisk']];
  return (
    <>
      <DeskHead title="Attendance" subtitle="Check in and review your history." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <DPanel title="Today">
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            {!ci ? <>
              <div style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="mappin" size={26} /></div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>Sunday Service is live</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>Victoria Island · open until 4:30</div>
              <button onClick={() => { setCi(true); app.showToast('Checked in'); }} className="btn btn-primary btn-lg" style={{ marginTop: 16 }}><Icon name="check" size={20} color="#fff" stroke={2.4} /> Check in</button>
            </> : <>
              <div style={{ width: 56, height: 56, margin: '0 auto', borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={28} color="#fff" stroke={2.6} /></div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 12 }}>You're checked in</div>
            </>}
          </div>
        </DPanel>
        <DPanel title="History" pad={false}>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="calendarclock" size={17} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{h[0]}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{h[1]}</div></div>
              <StatusPill status={h[2]} size="sm" />
            </div>
          ))}
        </DPanel>
      </div>
    </>
  );
}
function DShare({ app }) {
  return (
    <>
      <DeskHead title="Share" subtitle="Help the message travel — we count every click." right={<div style={{ display: 'flex', gap: 18 }}><Stat value="3" label="Shares" /><Stat value="65" label="Clicks" /><Stat value="30" label="Points" /></div>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {ADVOCACY.map(c => {
          const p = pillarOf(c.pillar);
          return (
            <div key={c.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 130, background: `linear-gradient(135deg, ${p.raw}, var(--navy-ink))`, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                <div style={{ position: 'absolute', right: -10, top: -10, opacity: .16 }}><Icon name={p.icon} size={90} color="#fff" stroke={1.5} /></div>
                <span style={{ position: 'relative', fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', padding: '4px 9px', borderRadius: 999 }}>{c.tag}</span>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{c.title}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {['message', 'camera', 'share', 'briefcase'].map(ic => <button key={ic} onClick={() => app.showToast('Shared · +10', 10)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={17} /></button>)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
function DProfile({ app }) {
  const [optIn, setOptIn] = useStateD(true);
  const [mode, setMode] = useStateD('first');
  return (
    <>
      <DeskHead title="Profile" subtitle="Your identity, points and privacy controls." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <DPanel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar name="Tofunmi Adeyemi" size={68} />
              <div><div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>Tofunmi Adeyemi</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>Professional · Lagos</div><div style={{ marginTop: 8, display: 'flex', gap: 6 }}><PillarChip pillar="career" size="sm" /><span className="chip">Ushering</span></div></div>
            </div>
          </DPanel>
          <DPanel title="Points & badges">
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 14 }}><Stat value={app.points} label="Total points" align="center" /><Stat value="#24" label="This month" align="center" /><Stat value="3" label="Badges" align="center" /></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--line)' }}>{[['sparkles', 'First win'], ['userplus', 'Inviter'], ['flame', '30-day streak']].map((b, i) => <span key={i} className="chip" style={{ height: 30, background: 'var(--navy-tint)', color: 'var(--navy)' }}><Icon name={b[0]} size={14} /> {b[1]}</span>)}</div>
          </DPanel>
        </div>
        <DPanel title="Leaderboard privacy" pad>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>Appear on the leaderboard</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{optIn ? 'Members-only board' : 'Hidden — you still see your rank'}</div></div>
            <Toggle on={optIn} onChange={setOptIn} />
          </div>
          {optIn && <><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 9 }}>Show my name as</div><Segmented options={[{ value: 'full', label: 'Full name' }, { value: 'first', label: 'First + initial' }, { value: 'alias', label: 'Alias' }]} value={mode} onChange={setMode} size="sm" /><div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>Preview: <b style={{ color: 'var(--ink-2)' }}>{mode === 'full' ? 'Tofunmi Adeyemi' : mode === 'first' ? 'Tofunmi A.' : 'Daniel_24'}</b></div></>}
          <hr className="divider" style={{ margin: '16px 0' }} />
          <div style={{ display: 'flex', gap: 10 }}><button onClick={() => app.showToast('Export prepared')} className="btn btn-ghost" style={{ flex: 1 }}><Icon name="download" size={16} /> Export data</button><button onClick={() => app.showToast('Signed out')} className="btn btn-outline" style={{ flex: 1 }}>Sign out</button></div>
        </DPanel>
      </div>
    </>
  );
}

/* ---------- shell ---------- */
function MemberDesktop() {
  const [view, setView] = useStateD('dashboard');
  const [points, setPoints] = useStateD(145);
  const [toast, setToast] = useStateD(null);
  const tref = useRefD(null);
  const showToast = (msg, pts) => { setToast({ msg, pts }); if (tref.current) clearTimeout(tref.current); tref.current = setTimeout(() => setToast(null), 2400); if (pts) setPoints(p => p + pts); };
  const app = { view, setView, points, showToast };
  const views = { dashboard: DDashboard, goals: DGoals, forms: DForms, learn: DLearn, mentorship: DMentorship, attendance: DAttendance, invite: DInvite, board: DBoard, share: DShare, profile: DProfile };
  const View = views[view] || DDashboard;
  return (
    <div className="sode" style={{ display: 'flex', height: '100%', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
      <aside style={{ width: 232, flex: 'none', background: 'var(--bg)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px' }}><BrandMark size={34} radius={10} /><Wordmark scale={0.82} /></div>
        <nav className="noscroll" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {DESK_NAV.map(n => {
            const active = n.key === view;
            return <button key={n.key} onClick={() => setView(n.key)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, cursor: 'pointer', background: active ? 'var(--navy)' : 'transparent', color: active ? '#fff' : 'var(--ink-2)', fontWeight: active ? 700 : 600, fontSize: 13.5, textAlign: 'left', width: '100%' }}><Icon name={n.icon} size={18} stroke={2} color={active ? '#fff' : 'var(--muted)'} /> {n.label}</button>;
          })}
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px 8px 0', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name="Tofunmi Adeyemi" size={34} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Tofunmi</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Member</div></div>
        </div>
      </aside>
      <div className="noscroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 32px 60px' }}>
        <View app={app} />
      </div>
      {toast && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--navy)', color: '#fff', padding: '11px 18px', borderRadius: 12, boxShadow: 'var(--sh-pop)', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, animation: 'sode-rise .25s ease' }}><Icon name="check" size={16} color="#fff" /> {toast.msg}{toast.pts && <span className="tnum" style={{ fontWeight: 800 }}>+{toast.pts}</span>}</div>
      )}
    </div>
  );
}

Object.assign(window, { MemberDesktop });
