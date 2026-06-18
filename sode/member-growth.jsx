// SODE — growth screens: Invite & Earn (M9), Leaderboard (M10), Profile (M8).
const { useState: useStateG } = React;

const STAGES = [
  { key: 'sent', label: 'Sent', pts: 5 },
  { key: 'opened', label: 'Opened', pts: 0 },
  { key: 'joined', label: 'Joined', pts: 50 },
  { key: 'attended', label: 'Attended', pts: 30 },
  { key: 'active', label: 'Active', pts: 15 },
];
const stageIdx = (k) => STAGES.findIndex(s => s.key === k);
const invitePoints = (stage) => STAGES.slice(0, stageIdx(stage) + 1).reduce((a, s) => a + s.pts, 0);

/* ---------- lifecycle tracker ---------- */
function LifecycleTracker({ stage }) {
  const cur = stageIdx(stage);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 12 }}>
      {STAGES.map((s, i) => {
        const done = i <= cur;
        const isCur = i === cur;
        return (
          <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && <div style={{ position: 'absolute', top: 11, right: '50%', width: '100%', height: 2, background: i <= cur ? 'var(--navy)' : 'var(--line-2)' }} />}
            <div style={{ position: 'relative', zIndex: 1, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--navy)' : '#fff', border: done ? 'none' : '1.5px solid var(--line-2)', boxShadow: isCur ? '0 0 0 4px var(--navy-tint)' : 'none' }}>
              {done && <Icon name="check" size={13} stroke={3} color="#fff" />}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 5, color: done ? 'var(--ink)' : 'var(--faint)', textAlign: 'center', letterSpacing: '.01em' }}>{s.label}</div>
            {s.pts > 0 && <div className="tnum" style={{ fontSize: 9, color: done ? 'var(--navy)' : 'var(--faint)', fontWeight: 700 }}>+{s.pts}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- INVITE & EARN ---------- */
function ContactRow({ c, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <Avatar name={c.name || c.contact} size={34} tone="soft" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name || 'New contact'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contact}</div>
      </div>
      <button onClick={onRemove} style={{ color: 'var(--faint)', flex: 'none' }}><Icon name="x" size={18} /></button>
    </div>
  );
}
function InviteScreen({ app }) {
  const { invites } = app;
  const [view, setView] = useStateG('send');
  const [name, setName] = useStateG('');
  const [contact, setContact] = useStateG('');
  const [batch, setBatch] = useStateG([]);
  const [consent, setConsent] = useStateG(false);
  const [msg, setMsg] = useStateG('Hi! I\'ve been growing with The School of Daniels & Esthers — a community helping young people thrive spiritually and in the marketplace. I\'d love for you to come. Here\'s the room:');
  const cap = 10;
  const earned = invites.reduce((a, i) => a + invitePoints(i.stage), 0);

  const addContact = () => {
    if (!contact.trim() || batch.length >= cap) return;
    setBatch(b => [...b, { name: name.trim(), contact: contact.trim() }]);
    setName(''); setContact('');
  };
  const send = () => {
    const newOnes = batch.map((c, i) => ({ id: 'n' + Date.now() + i, name: c.name || c.contact, stage: 'sent' }));
    app.setInvites(iv => [...newOnes, ...iv]);
    app.addPoints(batch.length * 5);
    const skipped = Math.min(1, batch.length > 2 ? 1 : 0);
    app.showToast({ msg: `${batch.length} invitation${batch.length > 1 ? 's' : ''} sent${skipped ? ` · ${skipped} already in the room` : ''}.`, icon: 'userplus', points: batch.length * 5 });
    setBatch([]); setConsent(false); setView('mine');
  };

  return (
    <>
      <AppHeader title="Invite & Earn" subtitle="Grow the room" app={app}
        right={<PointsBadge value={earned} size="sm" />} />
      <div style={{ padding: '14px 16px 28px' }}>
        {/* hero */}
        <div style={{ borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, var(--navy), var(--navy-ink))', color: '#fff', padding: 18, position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ position: 'absolute', right: -20, bottom: -24, opacity: .13 }}><Icon name="users" size={130} stroke={1.4} color="#fff" /></div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', maxWidth: 230, lineHeight: 1.25 }}>Know someone who'd thrive here? Bring them in.</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.74)', marginTop: 7, maxWidth: 250 }}>An invitation is kingdom work — it earns the most points, but really, it's +1 life.</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}><Segmented options={[{ value: 'send', label: 'Send invites' }, { value: 'mine', label: `My invitations · ${invites.length}` }]} value={view} onChange={setView} /></div>

        {view === 'send' ? (
          <div>
            {/* add contacts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add people you know</h3>
              <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{batch.length} of {cap} this week</span>
            </div>
            <div className="card card-pad" style={{ marginBottom: 12 }}>
              <Field label="Name (optional)"><TextInput value={name} onChange={setName} placeholder="e.g. Ada" /></Field>
              <Field label="Email or phone"><TextInput value={contact} onChange={setContact} placeholder="ada@email.com or 080…" icon="mail" /></Field>
              <button onClick={addContact} disabled={!contact.trim() || batch.length >= cap} className="btn btn-ghost btn-block"><Icon name="plus" size={18} stroke={2.4} /> Add to list</button>
            </div>
            {batch.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {batch.map((c, i) => <ContactRow key={i} c={c} onRemove={() => setBatch(b => b.filter((_, j) => j !== i))} />)}
              </div>
            )}

            {/* message */}
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 10px' }}>Customise your message</h3>
            <TextInput value={msg} onChange={setMsg} multiline rows={5} />
            <div style={{ display: 'flex', gap: 9, padding: '12px 13px', borderRadius: 'var(--r-sm)', background: 'var(--navy-tint)', marginTop: 10, marginBottom: 16 }}>
              <Icon name="shieldcheck" size={18} stroke={2} color="var(--navy)" style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: 'var(--navy-700)', lineHeight: 1.45 }}><b>Recipients always see an opt-out line</b> — “Reply STOP to opt out.” We keep it respectful, every time.</div>
            </div>

            {/* consent */}
            <button onClick={() => setConsent(c => !c)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: consent ? 'var(--navy-tint)' : 'var(--surface)', border: consent ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', width: '100%', marginBottom: 16 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', marginTop: 1, border: consent ? 'none' : '1.5px solid var(--line-2)', background: consent ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{consent && <Icon name="check" size={15} stroke={3} color="#fff" />}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: 'var(--ink)' }}>I personally know these people and they'll be glad to hear from me about SODE.</span>
            </button>

            <button onClick={send} disabled={!consent || batch.length === 0} className="btn btn-primary btn-block btn-lg">
              <Icon name="userplus" size={19} stroke={2.2} color="#fff" /> Send {batch.length || ''} invitation{batch.length !== 1 ? 's' : ''}
            </button>
          </div>
        ) : (
          <div>
            {/* converted banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--navy)', color: '#fff', marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="sprout" size={20} color="#fff" /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>Chinaza attended her first session</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>+50 points — but really, +1 life.</div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {invites.map(iv => (
                <div key={iv.id} className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Avatar name={iv.name} size={38} tone="soft" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{iv.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{iv.stage === 'active' ? 'Active member' : iv.stage}</div>
                    </div>
                    <PointsBadge value={invitePoints(iv.stage)} size="sm" />
                  </div>
                  <LifecycleTracker stage={iv.stage} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- LEADERBOARD ---------- */
const BOARD = [
  { name: 'Grace Adeyemi', pts: 540, badge: 'Top Inviter' },
  { name: 'Tunde Bakare', pts: 495, badge: 'Top Advocate' },
  { name: 'Ngozi Eze', pts: 470, badge: null },
  { name: 'Joshua Dada', pts: 420, badge: null },
  { name: 'Mary Okon', pts: 388, badge: 'Top Goal-getter' },
  { name: 'Ibrahim Sani', pts: 351, badge: null },
  { name: 'Peace Udo', pts: 330, badge: null },
  { name: 'Daniel Obi', pts: 318, badge: null },
];
function Podium({ top }) {
  const order = [1, 0, 2]; // 2nd, 1st, 3rd
  const heights = { 0: 92, 1: 66, 2: 52 };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, padding: '8px 4px 0' }}>
      {order.map(i => {
        const m = top[i];
        const first = i === 0;
        return (
          <div key={i} style={{ flex: 1, maxWidth: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Avatar name={m.name} size={first ? 64 : 50} tone={first ? 'navy' : 'soft'} style={first ? { boxShadow: '0 0 0 3px var(--navy), 0 6px 18px rgba(20,29,58,.22)' } : {}} />
              <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 22, height: 22, borderRadius: '50%', background: first ? 'var(--navy)' : '#fff', color: first ? '#fff' : 'var(--ink)', border: first ? 'none' : '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, marginTop: 4, maxWidth: 96, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name.split(' ')[0]}</div>
            <div className="tnum" style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>{m.pts}</div>
            <div style={{ width: '100%', height: heights[i], borderRadius: '10px 10px 0 0', marginTop: 8, background: first ? 'var(--navy)' : 'var(--surface-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
              {first && <Icon name="trophy" size={22} color="rgba(255,255,255,.85)" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function BoardScreen({ app }) {
  const [season, setSeason] = useStateG('month');
  const [cat, setCat] = useStateG('overall');
  const you = { rank: app.rank, pts: app.points };
  const rest = BOARD.slice(3);
  return (
    <>
      <AppHeader title="Leaderboard" subtitle="Grow together" app={app}
        right={<button onClick={() => app.openSheet('points')} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="info" size={20} /></button>} />
      <div style={{ padding: '14px 16px 88px' }}>
        <div style={{ marginBottom: 12 }}><Segmented options={[{ value: 'month', label: 'This Month' }, { value: 'cycle', label: 'This Cycle' }, { value: 'all', label: 'All-time' }]} value={season} onChange={setSeason} size="sm" /></div>
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px 16px', padding: '0 16px' }}>
          {[{ v: 'overall', l: 'Overall', i: 'trophy' }, { v: 'inviters', l: 'Top Inviters', i: 'userplus' }, { v: 'advocates', l: 'Top Advocates', i: 'share' }, { v: 'goals', l: 'Goal-getters', i: 'target' }].map(o => {
            const active = cat === o.v;
            return <button key={o.v} onClick={() => setCat(o.v)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: active ? 'var(--navy)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink)', border: active ? 'none' : '1px solid var(--line-2)' }}><Icon name={o.i} size={14} stroke={2.2} color={active ? '#fff' : 'var(--muted)'} />{o.l}</button>;
          })}
        </div>

        <div className="card" style={{ padding: '16px 12px 14px', marginBottom: 16 }}>
          <Podium top={BOARD.slice(0, 3)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rest.map((m, i) => (
            <div key={m.name} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
              <span className="tnum" style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', width: 22, textAlign: 'center' }}>{i + 4}</span>
              <Avatar name={m.name} size={36} tone="grey" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                {m.badge && <div style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 1 }}><Icon name="star" size={11} stroke={2.2} /> {m.badge}</div>}
              </div>
              <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>{m.pts}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Icon name="lock" size={13} /> Members choose to appear here. Only display name, points & rank are shown.
        </div>
      </div>

      {/* your rank pinned */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 10, padding: '0 14px 14px', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'var(--navy)', color: '#fff', boxShadow: 'var(--sh-pop)' }}>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 800, width: 30, textAlign: 'center' }}>#{you.rank}</span>
          <Avatar name="Tofunmi Ade" size={34} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>You · Tofunmi</div><div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.72)' }}>30 pts to the top 20</div></div>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>{you.pts}</span>
        </div>
      </div>
    </>
  );
}

/* ---------- points explainer (sheet) ---------- */
function PointsExplainer() {
  const rules = [
    { icon: 'userplus', label: 'Someone you invited joins', pts: 50, note: 'Inviting is the mission — it earns most.' },
    { icon: 'calendarclock', label: 'Your invite attends a session', pts: 30 },
    { icon: 'flag', label: 'Complete a personal goal', pts: 20 },
    { icon: 'share', label: 'Share SODE content (per share)', pts: 10 },
    { icon: 'sparkles', label: 'Log a win', pts: 5 },
  ];
  return (
    <div>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 16 }}>Points are a quiet way to celebrate growth. Invitations earn the most because growing the room is the mission — routine actions earn a little.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: 'var(--sh-sm)' }}><Icon name={r.icon} size={19} stroke={2.1} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{r.label}</div>{r.note && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{r.note}</div>}</div>
            <span className="tnum" style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>+{r.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- PROFILE ---------- */
function SettingRow({ icon, title, sub, right, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 14px', width: '100%', textAlign: 'left', background: 'transparent' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? '#fff' : 'var(--surface-2)', color: danger ? 'var(--ink)' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', border: danger ? '1px solid var(--line-2)' : 'none' }}><Icon name={icon} size={19} stroke={2} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--ink)' : 'var(--ink)' }}>{title}</div>{sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}</div>
      {right || (onClick && <Icon name="chevronright" size={18} color="var(--faint)" />)}
    </button>
  );
}
function ProfileScreen({ app }) {
  const [optIn, setOptIn] = useStateG(true);
  const [nameMode, setNameMode] = useStateG('first');
  const [whatsapp, setWhatsapp] = useStateG(true);
  const [email, setEmail] = useStateG(true);
  const badges = [{ icon: 'sparkles', label: 'First win' }, { icon: 'userplus', label: 'Inviter' }, { icon: 'flame', label: '30-day streak' }];
  return (
    <>
      <AppHeader title="You" app={app}
        right={<button onClick={() => app.showToast({ msg: 'Edit profile (demo)' })} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="pencil" size={18} /></button>} />
      <div style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* identity */}
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name="Tofunmi Adeyemi" size={62} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em' }}>Tofunmi Adeyemi</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Young professional · Lagos</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}><PillarChip pillar="career" size="sm" /><span className="chip">Ushering</span></div>
          </div>
        </div>

        {/* points + badges */}
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{app.points.toLocaleString()}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>total points</div></div>
            <div style={{ textAlign: 'right' }}><div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>#{app.rank}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>this month</div></div>
          </div>
          <hr className="divider" style={{ margin: '14px 0' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {badges.map((b, i) => <span key={i} className="chip" style={{ height: 30, background: 'var(--navy-tint)', color: 'var(--navy)' }}><Icon name={b.icon} size={14} stroke={2.2} /> {b.label}</span>)}
          </div>
        </div>

        {/* leaderboard privacy */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 4px' }}><div className="eyebrow">Leaderboard privacy</div></div>
          <SettingRow icon="trophy" title="Appear on the leaderboard" sub={optIn ? 'Members-only board' : 'Hidden — you still see your own rank'} right={<Toggle on={optIn} onChange={setOptIn} />} />
          {optIn && (
            <div style={{ padding: '4px 14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Show my name as</div>
              <Segmented options={[{ value: 'full', label: 'Full name' }, { value: 'first', label: 'First + initial' }, { value: 'alias', label: 'Alias' }]} value={nameMode} onChange={setNameMode} size="sm" />
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>Preview: <b style={{ color: 'var(--ink-2)' }}>{nameMode === 'full' ? 'Tofunmi Adeyemi' : nameMode === 'first' ? 'Tofunmi A.' : 'Daniel_24'}</b></div>
            </div>
          )}
        </div>

        {/* contact & consent */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 4px' }}><div className="eyebrow">Contact & consent</div></div>
          <SettingRow icon="message" title="WhatsApp updates" sub="Reminders & celebrate moments" right={<Toggle on={whatsapp} onChange={setWhatsapp} />} />
          <hr className="divider" />
          <SettingRow icon="mail" title="Email updates" sub="Monthly recap & readings" right={<Toggle on={email} onChange={setEmail} />} />
          <hr className="divider" />
          <SettingRow icon="info" title="How your data is used" sub="Plain-language NDPA summary" onClick={() => app.showToast({ msg: 'Opening privacy summary…' })} />
        </div>

        {/* demo + account */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <SettingRow icon="globe" title="Preview offline mode" sub="See how saving works on bad signal" right={<Toggle on={app.offline} onChange={app.setOffline} />} />
          <hr className="divider" />
          <SettingRow icon="download" title="Export my data" onClick={() => app.showToast({ msg: 'Preparing your export…' })} />
          <hr className="divider" />
          <SettingRow icon="x" title="Request account deletion" danger onClick={() => app.showToast({ msg: 'Request noted (demo)' })} />
        </div>

        <button onClick={() => app.showToast({ msg: 'Signed out (demo)' })} className="btn btn-outline btn-block">Sign out</button>
        <div style={{ textAlign: 'center', marginTop: 4 }}><Wordmark center scale={0.9} /><div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>Spiritually deep. Excellent in the marketplace.</div></div>
      </div>
    </>
  );
}

Object.assign(window, { InviteScreen, BoardScreen, ProfileScreen, PointsExplainer, LifecycleTracker });
