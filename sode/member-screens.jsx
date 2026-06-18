// SODE — Goals + Profile screens, Win / New-goal / Goal-detail flows.
const { useState: useStateS } = React;

/* ---------- progress stepper ---------- */
function Stepper({ value, max, unit, onChange }) {
  const set = (v) => onChange(Math.max(0, Math.min(max, v)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
      <button onClick={() => set(value - 1)} style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={20} stroke={2.4} /></button>
      <div style={{ textAlign: 'center', minWidth: 96 }}>
        <div className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{value}<span style={{ fontSize: 18, color: 'var(--faint)', fontWeight: 600 }}> / {max}</span></div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{unit}</div>
      </div>
      <button onClick={() => set(value + 1)} style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} stroke={2.4} color="#fff" /></button>
    </div>
  );
}

/* ---------- full goal card ---------- */
function GoalCard({ goal, onClick }) {
  const p = pillarOf(goal.pillar);
  const pct = goal.current / goal.target;
  return (
    <button onClick={onClick} className="card card-pad" style={{ textAlign: 'left', display: 'block', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <PillarChip pillar={goal.pillar} size="sm" />
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.25 }}>{goal.title}</div>
        </div>
        <StatusPill status={goal.status} size="sm" />
      </div>
      <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ flex: 1 }}><ProgressBar value={pct} color={p.color} /></div>
        <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{goal.current}/{goal.target}</span>
      </div>
      <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon name="calendarclock" size={13} /> Due {goal.due} · {goal.unit}
      </div>
    </button>
  );
}

/* ---------- GOALS screen ---------- */
function GoalsScreen({ app }) {
  const { goals, openSheet } = app;
  const [filter, setFilter] = useStateS('all');
  const counts = {
    ontrack: goals.filter(g => g.status === 'ontrack').length,
    atrisk: goals.filter(g => g.status === 'atrisk').length,
    done: goals.filter(g => g.status === 'done').length,
  };
  const shown = filter === 'all' ? goals : goals.filter(g => g.pillar === filter);
  return (
    <>
      <AppHeader title="My goals" subtitle="Personal · Month 4" app={app}
        right={<button onClick={() => openSheet('newGoal')} className="btn btn-primary btn-sm" style={{ paddingLeft: 12 }}><Icon name="plus" size={17} stroke={2.5} color="#fff" />New</button>} />
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* summary */}
        <div className="card card-pad" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <Stat value={counts.ontrack} label="On track" align="center" />
          <div style={{ width: 1, height: 34, background: 'var(--line)' }} />
          <Stat value={counts.atrisk} label="At risk" align="center" />
          <div style={{ width: 1, height: 34, background: 'var(--line)' }} />
          <Stat value={goals.length} label="Active" align="center" />
        </div>

        {/* roadmap highlight */}
        <button onClick={() => app.showToast({ msg: 'Opening your 12-month roadmap…' })} style={{ textAlign: 'left', borderRadius: 'var(--r-md)', padding: 16, background: 'var(--navy)', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: 'var(--sh-md)' }}>
          <div style={{ position: 'absolute', right: -10, top: -10, opacity: .12 }}><Icon name="flag" size={92} color="#fff" stroke={1.6} /></div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.62)' }}>Guided · Draft</div>
            <div style={{ fontSize: 16.5, fontWeight: 800, marginTop: 5 }}>12-Month Career & Calling Roadmap</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.74)', marginTop: 4 }}>3 of 7 prompts answered — pick up where you left off.</div>
            <div style={{ marginTop: 12 }}><ProgressBar value={3 / 7} color="#fff" track="rgba(255,255,255,.22)" /></div>
          </div>
        </button>

        {/* filter */}
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}>
          {[{ value: 'all', label: 'All' }, ...PILLARS.map(p => ({ value: p.key, label: p.short, icon: p.icon }))].map(o => {
            const active = filter === o.value;
            return (
              <button key={o.value} onClick={() => setFilter(o.value)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, background: active ? 'var(--navy)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)', border: active ? 'none' : '1px solid var(--line-2)' }}>
                {o.icon && <Icon name={o.icon} size={15} stroke={2.2} color={active ? '#fff' : 'var(--muted)'} />}{o.label}
              </button>
            );
          })}
        </div>

        {/* list */}
        {shown.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {shown.map(g => <GoalCard key={g.id} goal={g} onClick={() => openSheet('goalDetail', { goal: g })} />)}
          </div>
        ) : (
          <EmptyState icon={pillarOf(filter).icon} title="No goals here yet" body="Pick one and let's start the climb — laddered from your team's goals." cta="Set a goal" onCta={() => openSheet('newGoal')} />
        )}
      </div>
    </>
  );
}

/* ---------- WIN flow (60-second) ---------- */
const WIN_TYPES = [
  { value: 'milestone', label: 'Hit a milestone', icon: 'flag' },
  { value: 'progress', label: 'Made progress', icon: 'trendingup' },
  { value: 'skill', label: 'Learned a skill', icon: 'bookopen' },
  { value: 'helped', label: 'Helped someone', icon: 'heart' },
  { value: 'prayer', label: 'Answered prayer', icon: 'sprout' },
  { value: 'other', label: 'Something else', icon: 'star' },
];
function WinFlow({ app }) {
  const [step, setStep] = useStateS(0);
  const [type, setType] = useStateS(null);
  const [pillar, setPillar] = useStateS(null);
  const [desc, setDesc] = useStateS('');
  const total = 3;
  const canNext = step === 0 ? !!type : step === 1 ? !!pillar : desc.trim().length > 2;
  const submit = () => {
    app.closeSheet();
    app.addPoints(5);
    if (app.offline) { app.showToast({ msg: 'Saved on your phone. We\'ll sync when you\'re online.', kind: 'offline' }); return; }
    app.showToast({ msg: 'Logged. Well done.', points: 5 });
    setTimeout(() => app.fireCelebrate({ title: 'Logged. Well done.', sub: 'Your win is shared with the room — small seeds, real harvest.', points: 5 }), 350);
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Share a win</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} /> ~60 sec</span>
      </div>
      {/* progress dots */}
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)', transition: 'background .2s ease' }} />
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>What kind of win?</div>
          <OptionChips options={WIN_TYPES} value={type} onChange={setType} columns={2} />
        </div>
      )}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Which pillar did it grow?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PILLARS.map(p => {
              const sel = pillar === p.key;
              return (
                <button key={p.key} onClick={() => setPillar(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: 'var(--sh-sm)' }}><Icon name={p.icon} size={20} stroke={2.1} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name}</div></div>
                  {sel && <Icon name="check" size={20} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Tell us briefly</div>
          <TextInput value={desc} onChange={setDesc} multiline rows={4} placeholder="What happened? A sentence is plenty." />
          <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
            <button onClick={() => app.showToast({ msg: 'Camera ready (demo)' })} className="btn btn-outline btn-sm" style={{ flex: 1 }}><Icon name="camera" size={17} /> Photo</button>
            <button onClick={() => app.showToast({ msg: 'Add a link (demo)' })} className="btn btn-outline btn-sm" style={{ flex: 1 }}><Icon name="link" size={16} /> Link</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ flex: '0 0 auto', paddingLeft: 16, paddingRight: 16 }}><Icon name="arrowleft" size={18} /></button>}
        {step < total - 1
          ? <button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={submit} disabled={!canNext} className="btn btn-primary btn-block"><Icon name="sparkles" size={18} stroke={2.2} color="#fff" /> Share win · +5</button>}
      </div>
    </div>
  );
}

/* ---------- NEW GOAL flow ---------- */
const GOAL_TEMPLATES = {
  spiritual: [{ t: 'Daily devotion streak', target: 30, unit: 'days' }, { t: 'Read 2 Christian books', target: 2, unit: 'books' }, { t: 'Join a prayer cell', target: 8, unit: 'sessions' }],
  career: [{ t: 'Earn a professional certification', target: 5, unit: 'modules' }, { t: 'Refresh CV & LinkedIn', target: 3, unit: 'steps' }, { t: 'Apply to target roles', target: 10, unit: 'roles' }],
  business: [{ t: 'Register the business', target: 4, unit: 'steps' }, { t: 'Land first paying customers', target: 3, unit: 'customers' }, { t: 'Reach revenue milestone', target: 12, unit: 'weeks' }],
  character: [{ t: 'Mentor a younger member', target: 6, unit: 'sessions' }, { t: 'Serve in a department', target: 12, unit: 'weeks' }, { t: '30-day integrity challenge', target: 30, unit: 'days' }],
};
function NewGoalFlow({ app }) {
  const [step, setStep] = useStateS(0);
  const [pillar, setPillar] = useStateS(null);
  const [tpl, setTpl] = useStateS(null);
  const [target, setTarget] = useStateS(10);
  const [unit, setUnit] = useStateS('days');
  const [due, setDue] = useStateS('Aug 31');
  const pickTpl = (t) => { setTpl(t); setTarget(t.target); setUnit(t.unit); };
  const submit = () => {
    const id = 'g' + Date.now();
    app.setGoals(gs => [...gs, { id, pillar, title: tpl.t, current: 0, target, unit, due, status: 'ontrack', milestones: [] }]);
    app.closeSheet();
    app.showToast({ msg: 'Goal set. Let\'s start the climb.', icon: 'flag' });
  };
  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 4 }}>New goal</h2>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />)}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Choose a pillar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PILLARS.map(p => {
              const sel = pillar === p.key;
              return (
                <button key={p.key} onClick={() => setPillar(p.key)} style={{ padding: '16px 12px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, margin: '0 auto', borderRadius: 13, background: '#fff', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}><Icon name={p.icon} size={22} stroke={2.1} /></div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 9 }}>{p.short}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Pick a template</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>Laddered from your team's pillar goals.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {GOAL_TEMPLATES[pillar].map((t, i) => {
              const sel = tpl?.t === t.t;
              return (
                <button key={i} onClick={() => pickTpl(t)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.t}</div><div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{t.target} {t.unit}</div></div>
                  {sel && <Icon name="check" size={20} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
            <button onClick={() => pickTpl({ t: 'Custom goal', target: 10, unit: 'steps' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1.5px dashed var(--line-2)', color: 'var(--navy)', fontWeight: 700, fontSize: 14 }}>
              <Icon name="pencil" size={17} /> Write my own
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Set the target</div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <Stepper value={target} max={Math.max(50, target)} unit={unit} onChange={setTarget} />
          </div>
          <Field label="Due date">
            <OptionChips options={['Jun 30', 'Aug 31', 'Sep 30', 'Dec 31']} value={due} onChange={setDue} />
          </Field>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ paddingLeft: 16, paddingRight: 16 }}><Icon name="arrowleft" size={18} /></button>}
        {step < 2
          ? <button onClick={() => setStep(s => s + 1)} disabled={step === 0 ? !pillar : !tpl} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={submit} className="btn btn-primary btn-block"><Icon name="flag" size={17} color="#fff" /> Set this goal</button>}
      </div>
    </div>
  );
}

/* ---------- GOAL detail ---------- */
function GoalDetail({ app, goal }) {
  const live = app.goals.find(g => g.id === goal.id) || goal;
  const p = pillarOf(live.pillar);
  const setCurrent = (v) => app.setGoals(gs => gs.map(g => g.id === live.id ? { ...g, current: v, status: v >= g.target ? 'done' : g.status } : g));
  const complete = () => {
    app.setGoals(gs => gs.map(g => g.id === live.id ? { ...g, current: g.target, status: 'done' } : g));
    app.closeSheet();
    app.addPoints(20);
    setTimeout(() => app.fireCelebrate({
      title: 'Goal complete!', sub: p.verse, points: 20,
      secondary: { label: 'Share it as a win', icon: 'sparkles', onClick: () => app.openSheet('win') },
    }), 350);
  };
  const toggleMs = (i) => app.setGoals(gs => gs.map(g => g.id === live.id ? { ...g, milestones: g.milestones.map((m, j) => j === i ? { ...m, done: !m.done } : m) } : g));
  const pct = live.current / live.target;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <ProgressRing value={pct} size={72} stroke={7} color={p.color}>
          <span className="tnum" style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(pct * 100)}%</span>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PillarChip pillar={live.pillar} size="sm" />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', marginTop: 7, lineHeight: 1.2 }}>{live.title}</div>
          <div style={{ marginTop: 6 }}><StatusPill status={live.status} size="sm" /></div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 14, textAlign: 'center' }}>Update your progress</div>
        <Stepper value={live.current} max={live.target} unit={live.unit} onChange={setCurrent} />
      </div>

      {live.milestones?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>Milestones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {live.milestones.map((m, i) => (
              <button key={i} onClick={() => toggleMs(i)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', textAlign: 'left' }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', border: m.done ? 'none' : '1.5px solid var(--line-2)', background: m.done ? 'var(--navy)' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.done && <Icon name="check" size={15} stroke={3} color="#fff" />}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: m.done ? 'var(--faint)' : 'var(--ink)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.t}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5, padding: '0 2px 16px' }}>{p.verse}</div>

      <button onClick={complete} disabled={live.status === 'done'} className="btn btn-primary btn-block btn-lg">
        {live.status === 'done' ? <><Icon name="check" size={19} stroke={2.6} color="#fff" /> Completed</> : <><Icon name="flag" size={18} color="#fff" /> Mark complete</>}
      </button>
    </div>
  );
}

Object.assign(window, { GoalsScreen, Stepper, GoalCard, WinFlow, NewGoalFlow, GoalDetail });
