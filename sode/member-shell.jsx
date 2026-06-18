// SODE — Member app shell (state, nav, header, bottom tabs) + Home screen.
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

/* ---------- shared screen header ---------- */
function AppHeader({ title, subtitle, right, app, large, back }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px 11px' }}>
        {back && <button onClick={back} style={{ width: 36, height: 36, marginLeft: -6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}><Icon name="arrowleft" size={22} /></button>}
        <div style={{ flex: 1, minWidth: 0 }}>
          {subtitle && <div className="eyebrow" style={{ marginBottom: 2 }}>{subtitle}</div>}
          <h1 style={{ fontSize: large ? 24 : 20, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.1 }}>{title}</h1>
        </div>
        {right}
      </div>
    </div>
  );
}

/* ---------- bottom tab bar ---------- */
const SECONDARY_TABS = ['invite', 'board', 'share', 'mentorship', 'attendance'];
function BottomNav({ tab, setTab }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'goals', icon: 'target', label: 'Goals' },
    { key: 'forms', icon: 'list', label: 'Forms' },
    { key: 'learn', icon: 'bookopen', label: 'Learn' },
    { key: 'profile', icon: 'user', label: 'You' },
  ];
  return (
    <div style={{
      flex: 'none', display: 'flex', borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,.92)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '7px 6px calc(7px + env(safe-area-inset-bottom))',
    }}>
      {items.map(it => {
        const active = tab === it.key || (it.key === 'home' && SECONDARY_TABS.includes(tab));
        return (
          <button key={it.key} onClick={() => setTab(it.key)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 0',
            color: active ? 'var(--navy)' : 'var(--faint)',
          }}>
            <div style={{ position: 'relative', display: 'flex' }}>
              <Icon name={it.icon} size={23} stroke={active ? 2.4 : 2} />
              {active && <span style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--navy)' }} />}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600, letterSpacing: '.01em' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- mini goal card (Home rail) ---------- */
function GoalMini({ goal, onClick }) {
  const p = pillarOf(goal.pillar);
  const pct = goal.current / goal.target;
  return (
    <button onClick={onClick} className="card" style={{ width: 158, flex: 'none', textAlign: 'left', padding: 14, scrollSnapAlign: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <ProgressRing value={pct} size={44} stroke={5} color={p.color}>
          <span style={{ color: p.color, display: 'flex' }}><Icon name={p.icon} size={18} stroke={2.2} /></span>
        </ProgressRing>
        <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 11, lineHeight: 1.25, letterSpacing: '-.01em' }}>{goal.title}</div>
      <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 5 }}>{goal.current}/{goal.target} {goal.unit} · {goal.due}</div>
    </button>
  );
}

/* ---------- HOME ---------- */
function HomeScreen({ app }) {
  const { points, rank, goals, openSheet, setTab } = app;
  const reading = { pillar: 'character', title: 'The Practice of the Presence of God', author: 'Brother Lawrence', why: 'Builds the daily-faithfulness muscle behind Luke 16:10.' };
  const shoutouts = [
    { name: 'Ada O.', pillar: 'business', text: 'Registered her catering business' },
    { name: 'Emeka N.', pillar: 'career', text: 'Passed the PMP exam' },
    { name: 'Zainab B.', pillar: 'spiritual', text: '40-day prayer streak' },
  ];
  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px 11px' }}>
          <Avatar name="Tofunmi Ade" size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>Good evening,</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.1 }}>Tofunmi</div>
          </div>
          <PointsBadge value={points} onClick={() => setTab('board')} />
        </div>
      </div>

      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* cycle + rank */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', padding: '15px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>2026 Growth Cycle</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>Month 4 of 12 — keep going</div>
            </div>
            <ProgressRing value={4 / 12} size={46} stroke={5} color="#fff" track="rgba(255,255,255,.22)">
              <span className="tnum" style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>4/12</span>
            </ProgressRing>
          </div>
          <button onClick={() => setTab('board')} style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="trophy" size={20} stroke={2.1} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>You're #{rank} this month <span className="tnum" style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)' }}>▲3</span></div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>30 pts to the top 20</div>
            </div>
            <Icon name="chevronright" size={20} color="var(--faint)" />
          </button>
        </div>

        {/* win nudge — flagship */}
        <button onClick={() => openSheet('win')} style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-ink) 100%)', color: '#fff', padding: '17px 18px', boxShadow: 'var(--sh-md)' }}>
          <div style={{ position: 'absolute', right: -18, bottom: -22, opacity: .14 }}><Icon name="sprout" size={120} stroke={1.5} color="#fff" /></div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-.01em' }}>Something good happened?</div>
              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.72)', marginTop: 3 }}>Share it — about 60 seconds.</div>
            </div>
            <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: 'var(--navy)', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', borderRadius: 999 }}>
              <Icon name="sparkles" size={16} stroke={2.2} color="var(--navy)" /> Share a win
            </div>
          </div>
        </button>

        {/* quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { icon: 'mappin', label: 'Check in', go: () => setTab('attendance') },
            { icon: 'list', label: 'Forms', go: () => setTab('forms') },
            { icon: 'userplus', label: 'Invite', go: () => setTab('invite') },
            { icon: 'share', label: 'Share', go: () => setTab('share') },
          ].map((a, i) => (
            <button key={i} onClick={a.go} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '13px 4px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}><Icon name={a.icon} size={19} stroke={2.1} /></div>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* my goals rail */}
        <div>
          <SectionHead title="My goals" action="View all" onAction={() => setTab('goals')} />
          <div className="noscroll" style={{ display: 'flex', gap: 11, overflowX: 'auto', margin: '0 -16px', padding: '2px 16px 4px', scrollSnapType: 'x mandatory' }}>
            {goals.map(g => <GoalMini key={g.id} goal={g} onClick={() => openSheet('goalDetail', { goal: g })} />)}
            <button onClick={() => openSheet('newGoal')} style={{ width: 132, flex: 'none', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-2)', background: 'var(--surface)', color: 'var(--navy)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
              <Icon name="pluscircle" size={26} stroke={2} /> New goal
            </button>
          </div>
        </div>

        {/* next up */}
        <div>
          <SectionHead title="Next up" />
          <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="calendarclock" size={23} stroke={2} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Sunday Service</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="mappin" size={13} /> Sun, Jun 16 · 4:00 PM · Victoria Island</div>
            </div>
            <button onClick={() => setTab('attendance')} className="btn btn-primary btn-sm" style={{ flex: 'none' }}>Check in</button>
          </div>
        </div>

        {/* reading */}
        <div>
          <SectionHead title="This month's reading" action="Learn" onAction={() => setTab('learn')} />
          <button onClick={() => setTab('learn')} className="card card-pad" style={{ display: 'flex', gap: 13, textAlign: 'left', width: '100%' }}>
            <div style={{ width: 46, height: 60, borderRadius: 8, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'flex-end', padding: 7, flex: 'none' }}><Icon name="bookopen" size={20} stroke={2} color="#fff" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PillarChip pillar={reading.pillar} size="sm" />
              <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 7, lineHeight: 1.25 }}>{reading.title}</div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{reading.author}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>{reading.why}</div>
            </div>
          </button>
        </div>

        {/* mentor */}
        <div>
          <SectionHead title="Your mentor" action="Open" onAction={() => setTab('mentorship')} />
          <button onClick={() => setTab('mentorship')} className="card card-pad" style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13 }}>
            <Avatar name="Grace Adeyemi" size={44} tone="soft" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Mrs. Grace Adeyemi</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>Next session Sat, Jun 21 · 10:00 AM</div>
            </div>
            <Icon name="chevronright" size={20} color="var(--faint)" />
          </button>
        </div>

        {/* shoutouts */}
        <div>
          <SectionHead title="Wins around the room" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {shoutouts.map((s, i) => {
              const p = pillarOf(s.pillar);
              return (
                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px' }}>
                  <Avatar name={s.name} size={36} tone="soft" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.3 }}><b style={{ fontWeight: 700 }}>{s.name}</b> <span style={{ color: 'var(--muted)' }}>{s.text}</span></div>
                  </div>
                  <span style={{ color: p.color, flex: 'none' }}><Icon name={p.icon} size={17} stroke={2.2} /></span>
                  <button onClick={() => app.showToast({ msg: 'Sent encouragement 🌱', icon: 'heart' })} style={{ flex: 'none', color: 'var(--faint)' }}><Icon name="heart" size={19} /></button>
                </div>
              );
            })}
          </div>
        </div>

        {/* invite nudge */}
        <button onClick={() => setTab('invite')} className="card" style={{ textAlign: 'left', padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="userplus" size={22} stroke={2.1} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Bring someone into the room</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>Know someone who'd thrive here? Invite them.</div>
          </div>
          <Icon name="chevronright" size={20} color="var(--faint)" />
        </button>
      </div>
    </>
  );
}

/* ---------- root app ---------- */
function MemberApp() {
  const [tab, setTab] = useStateM('home');
  const [points, setPoints] = useStateM(145);
  const [rank] = useStateM(24);
  const [offline, setOffline] = useStateM(false);
  const [sheet, setSheet] = useStateM(null);
  const [celebrate, setCelebrate] = useStateM(null);
  const [toast, setToast] = useStateM(null);
  const toastTimer = useRefM(null);
  const [goals, setGoals] = useStateM([
    { id: 'g1', pillar: 'spiritual', title: 'Daily devotion streak', current: 18, target: 30, unit: 'days', due: 'Jun 30', status: 'ontrack', milestones: [{ t: 'Week 1', done: true }, { t: 'Week 2', done: true }, { t: 'Week 3', done: false }, { t: 'Week 4', done: false }] },
    { id: 'g2', pillar: 'career', title: 'Finish AWS certification', current: 2, target: 5, unit: 'modules', due: 'Aug 15', status: 'atrisk', milestones: [{ t: 'Cloud basics', done: true }, { t: 'Compute', done: true }, { t: 'Storage', done: false }] },
    { id: 'g3', pillar: 'business', title: 'Land 3 paying customers', current: 1, target: 3, unit: 'customers', due: 'Sep 1', status: 'ontrack', milestones: [{ t: 'First customer', done: true }, { t: 'Second', done: false }, { t: 'Third', done: false }] },
  ]);
  const [invites, setInvites] = useStateM([
    { id: 'i1', name: 'Chinaza Okafor', stage: 'attended' },
    { id: 'i2', name: 'David Mensah', stage: 'joined' },
    { id: 'i3', name: 'Funke Bello', stage: 'opened' },
    { id: 'i4', name: 'Samuel Eze', stage: 'sent' },
  ]);

  const showToast = (t) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  const addPoints = (n) => setPoints(p => p + n);
  const fireCelebrate = (data) => setCelebrate(data);
  const openSheet = (type, data = {}) => setSheet({ type, ...data });
  const closeSheet = () => setSheet(null);

  const app = { tab, setTab, points, setPoints, addPoints, rank, goals, setGoals, invites, setInvites, offline, setOffline, openSheet, closeSheet, showToast, fireCelebrate };

  const screens = { home: HomeScreen, goals: GoalsScreen, forms: FormsScreen, learn: LearnScreen, mentorship: MentorshipScreen, attendance: AttendanceScreen, share: ShareScreen, invite: InviteScreen, board: BoardScreen, profile: ProfileScreen };
  const Screen = screens[tab] || HomeScreen;

  return (
    <div className="sode" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {offline && (
        <div style={{ flex: 'none', background: 'var(--ink)', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Icon name="refresh" size={14} color="#fff" /> Offline — changes save on your phone and sync later
        </div>
      )}
      <div key={tab} className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <Screen app={app} />
      </div>
      <BottomNav tab={tab} setTab={setTab} />

      {/* sheets */}
      <Sheet open={sheet?.type === 'win'} onClose={closeSheet}><WinFlow app={app} /></Sheet>
      <Sheet open={sheet?.type === 'newGoal'} onClose={closeSheet}><NewGoalFlow app={app} /></Sheet>
      <Sheet open={sheet?.type === 'goalDetail'} onClose={closeSheet} title="Goal">
        {sheet?.type === 'goalDetail' && <GoalDetail app={app} goal={sheet.goal} />}
      </Sheet>
      <Sheet open={sheet?.type === 'points'} onClose={closeSheet} title="How points work"><PointsExplainer /></Sheet>
      <Sheet open={sheet?.type === 'survey'} onClose={closeSheet}>{sheet?.type === 'survey' && <SurveyFlow app={app} />}</Sheet>

      <Toast toast={toast} />
      <Celebrate data={celebrate} onClose={() => setCelebrate(null)} />
    </div>
  );
}

Object.assign(window, { MemberApp, AppHeader, BottomNav, HomeScreen, GoalMini });
