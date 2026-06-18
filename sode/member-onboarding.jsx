// SODE — entry flows: Login / magic-link (M0), Onboarding + consent (M1).
const { useState: useStateO } = React;

/* ============================ LOGIN (M0) ============================ */
function LoginScreen() {
  const [email, setEmail] = useStateO('');
  const [sent, setSent] = useStateO(false);
  return (
    <div className="sode" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* brand band */}
      <div style={{ background: 'linear-gradient(160deg, var(--navy), var(--navy-ink))', color: '#fff', padding: '54px 26px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, bottom: -40, opacity: .12 }}><Icon name="sprout" size={200} color="#fff" stroke={1.3} /></div>
        <div style={{ position: 'relative' }}>
          <BrandMark size={56} radius={16} navy="rgba(255,255,255,.14)" on="#fff" />
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: '.24em', fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase' }}>The School Of</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>Daniels &amp; Esthers</div>
          </div>
          <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,.78)', marginTop: 12, lineHeight: 1.5, maxWidth: 280 }}>Spiritually deep. Excellent in the marketplace.</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '28px 26px', display: 'flex', flexDirection: 'column' }}>
        {!sent ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Welcome</h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>Sign in with your email — we'll send a secure magic link. No password to remember.</p>
            <div style={{ marginTop: 22 }}>
              <Field label="Email"><TextInput value={email} onChange={setEmail} placeholder="you@email.com" icon="mail" type="email" /></Field>
            </div>
            <button onClick={() => setSent(true)} disabled={!email.includes('@')} className="btn btn-primary btn-lg btn-block">Send magic link <Icon name="chevronright" size={18} stroke={2.4} color="#fff" /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} /><span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>or</span><div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <button onClick={() => setSent(true)} className="btn btn-outline btn-lg btn-block"><span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>G</span> Continue with Google</button>
            <div style={{ marginTop: 'auto', fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', paddingTop: 24, lineHeight: 1.5 }}>By continuing you agree to SODE's terms and our plain-language privacy approach (NDPA-aligned).</div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: 20, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}><Icon name="mail" size={32} stroke={1.9} /></div>
            <h1 style={{ fontSize: 21, fontWeight: 800, marginTop: 20 }}>Check your email</h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5, maxWidth: 260 }}>We sent a sign-in link to <b style={{ color: 'var(--ink)' }}>{email || 'you@email.com'}</b>. Tap it to come in.</p>
            <button onClick={() => setSent(false)} className="btn btn-ghost" style={{ marginTop: 22 }}>Use a different email</button>
            <button onClick={() => setSent(false)} style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>Resend link</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ ONBOARDING (M1) ============================ */
const LIFE_STAGES = ['Student', 'Young professional', 'Entrepreneur', 'Between roles'];
const DEPTS = ['Ushering', 'Media', 'Choir', 'Welfare', 'Tech', 'Not yet'];
/* ---------- Baseline Survey (the 4-minute starting-point survey) ---------- */
const BASELINE_Q = [
  { pillar: 'spiritual', q: 'How consistent is your devotional life right now?', type: 'choice', options: ['Daily', 'A few times a week', 'Occasionally', 'Rarely'] },
  { pillar: 'career', q: 'Where are you in your career journey?', type: 'choice', options: ['Studying', 'Employed', 'Job-seeking', 'Self-employed'] },
  { pillar: 'career', q: 'Do you hold a professional certification?', type: 'choice', options: ['Yes', 'In progress', 'Not yet'] },
  { pillar: 'business', q: 'Do you run or plan to run a business?', type: 'choice', options: ['Running one', 'Registered', 'Idea stage', 'No'] },
  { pillar: 'character', q: 'How often do you serve others or volunteer?', type: 'choice', options: ['Weekly', 'Monthly', 'Rarely', 'Not yet'] },
  { pillar: null, q: 'Rate your overall growth this past year.', type: 'nps' },
  { pillar: null, q: 'What do you most want to be “ten times better” at this year?', type: 'text' },
];
function BaselineSurvey({ onDone }) {
  const [i, setI] = useStateO(0);
  const [ans, setAns] = useStateO({});
  const q = BASELINE_Q[i];
  const set = (v) => setAns(a => ({ ...a, [i]: v }));
  const last = i === BASELINE_Q.length - 1;
  const canNext = q.type === 'text' ? true : ans[i] != null;
  const p = q.pillar ? pillarOf(q.pillar) : null;
  return (
    <div className="sode" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '18px 22px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {i > 0 && <button onClick={() => setI(i - 1)} style={{ color: 'var(--ink)', display: 'flex' }}><Icon name="arrowleft" size={22} /></button>}
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>{BASELINE_Q.map((_, j) => <div key={j} style={{ flex: 1, height: 5, borderRadius: 3, background: j <= i ? 'var(--navy)' : 'var(--surface-2)' }} />)}</div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>{i + 1}/{BASELINE_Q.length}</span>
      </div>
      <div style={{ padding: '6px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="eyebrow">Baseline Survey · ~4 min</div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={12} stroke={2.6} color="var(--navy)" /> Autosaved</span>
      </div>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 16px' }}>
        {p && <div style={{ marginBottom: 12 }}><PillarChip pillar={q.pillar} size="sm" /></div>}
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3 }}>{q.q}</div>
        <div style={{ marginTop: 18 }}>
          {q.type === 'choice' && <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{q.options.map(o => { const seld = ans[i] === o; return <button key={o} onClick={() => set(o)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px', borderRadius: 'var(--r-sm)', background: seld ? 'var(--navy-tint)' : 'var(--surface)', border: seld ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}><span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', border: seld ? '6px solid var(--navy)' : '2px solid var(--line-2)', background: '#fff' }} /><span style={{ fontSize: 14.5, fontWeight: 600 }}>{o}</span></button>; })}</div>}
          {q.type === 'nps' && <div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 7 }}>{Array.from({ length: 11 }).map((_, n) => { const seld = ans[i] === n; return <button key={n} onClick={() => set(n)} className="tnum" style={{ height: 46, borderRadius: 12, fontSize: 16, fontWeight: 700, background: seld ? 'var(--navy)' : 'var(--surface)', color: seld ? '#fff' : 'var(--ink)', border: seld ? 'none' : '1px solid var(--line-2)' }}>{n}</button>; })}</div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginTop: 8, fontWeight: 600 }}><span>Just starting</span><span>Ten times better</span></div></div>}
          {q.type === 'text' && <TextInput value={ans[i] || ''} onChange={set} multiline rows={4} placeholder="A sentence is plenty…" />}
        </div>
      </div>
      <div style={{ padding: '12px 22px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)' }}>
        <button onClick={() => last ? onDone() : setI(i + 1)} disabled={!canNext} className="btn btn-primary btn-lg btn-block">{last ? 'Finish baseline' : 'Continue'}</button>
      </div>
    </div>
  );
}

function OnboardingFlow() {
  const [step, setStep] = useStateO(0);
  const [name, setName] = useStateO('');
  const [wa, setWa] = useStateO('');
  const [stage, setStage] = useStateO(null);
  const [dept, setDept] = useStateO(null);
  const [biz, setBiz] = useStateO(null);
  const [leader, setLeader] = useStateO(null);
  const [consent1, setConsent1] = useStateO(false);
  const [consent2, setConsent2] = useStateO(false);
  const [baseline, setBaseline] = useStateO(false);
  const total = 4;
  const canNext = step === 0 ? name.trim() && wa.trim() : step === 1 ? stage && dept : step === 2 ? consent1 : true;

  const ConsentRow = ({ on, set, title, body }) => (
    <button onClick={() => set(!on)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: on ? 'var(--navy-tint)' : 'var(--surface)', border: on ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', width: '100%' }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', marginTop: 1, border: on ? 'none' : '1.5px solid var(--line-2)', background: on ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="check" size={15} stroke={3} color="#fff" />}</span>
      <span><span style={{ fontSize: 14, fontWeight: 700, display: 'block' }}>{title}</span><span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{body}</span></span>
    </button>
  );

  if (baseline) return <BaselineSurvey onDone={() => { setBaseline(false); setStep(total); }} />;

  if (step === total) {
    return (
      <div className="sode" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: 'var(--bg)' }}>
        <div style={{ animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}><BrandMark size={84} radius={24} /></div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 22 }}>Welcome in, {name.split(' ')[0] || 'friend'}.</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5, maxWidth: 270 }}>Your space is ready. Let's start the climb — ten times better.</p>
        <button onClick={() => setStep(0)} className="btn btn-primary btn-lg" style={{ marginTop: 26, minWidth: 200 }}>Enter SODE</button>
      </div>
    );
  }

  return (
    <div className="sode" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '18px 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} style={{ color: 'var(--ink)', display: 'flex' }}><Icon name="arrowleft" size={22} /></button>}
        <div style={{ flex: 1, display: 'flex', gap: 5 }}>
          {Array.from({ length: total }).map((_, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />)}
        </div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>{step + 1}/{total}</span>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 16px' }}>
        {step === 0 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>The basics</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 22 }}>So we know who's in the room.</p>
            <Field label="Full name"><TextInput value={name} onChange={setName} placeholder="e.g. Tofunmi Adeyemi" /></Field>
            <Field label="WhatsApp number" hint="We use this for gentle reminders only."><TextInput value={wa} onChange={setWa} placeholder="080…" icon="message" /></Field>
          </div>
        )}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>About you</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 20 }}>Helps us tailor your pillars.</p>
            <Field label="Life stage"><OptionChips options={LIFE_STAGES} value={stage} onChange={setStage} /></Field>
            <Field label="Department / serving"><OptionChips options={DEPTS} value={dept} onChange={setDept} /></Field>
            <Field label="Running a business?"><OptionChips options={['Yes, registered', 'Just an idea', 'Not yet']} value={biz} onChange={setBiz} /></Field>
            <Field label="A leadership role?"><OptionChips options={['Yes', 'No']} value={leader} onChange={setLeader} /></Field>
          </div>
        )}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>How we use your data</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>Plain and simple — you're always in control. You can export or delete your data anytime.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <ConsentRow on={consent1} set={setConsent1} title="Store my growth data" body="Goals, wins, attendance — to show your progress. Required to use SODE." />
              <ConsentRow on={consent2} set={setConsent2} title="Contact me on WhatsApp & email" body="Reminders, readings and celebrate moments. Optional — you can opt out anytime." />
            </div>
          </div>
        )}
        {step === 3 && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, margin: '0 auto', borderRadius: 17, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trendingup" size={28} stroke={2} /></div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 14 }}>Your Baseline Survey</h1>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 7, lineHeight: 1.5 }}>About 4 minutes · 7 questions. It captures where you're starting so we can measure how far you climb.</p>
            </div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['spiritual', 'Your devotional rhythm'], ['career', 'Where you are in your career'], ['business', 'Your business stage'], ['character', 'How you serve others'], [null, 'Overall growth & the year ahead']].map(([pk, label], idx) => {
                const pp = pk ? pillarOf(pk) : null;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', color: pp ? pp.color : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: 'var(--sh-sm)' }}><Icon name={pp ? pp.icon : 'sparkles'} size={17} stroke={2.1} /></div>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setBaseline(true)} className="btn btn-primary btn-lg btn-block"><Icon name="trendingup" size={18} color="#fff" /> Take the baseline now</button>
              <button onClick={() => setStep(total)} className="btn btn-ghost btn-block">I'll do it later</button>
            </div>
          </div>
        )}
      </div>

      {step < 3 && (
        <div style={{ padding: '12px 22px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)' }}>
          <button onClick={() => setStep(step + 1)} disabled={!canNext} className="btn btn-primary btn-lg btn-block">Continue</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { LoginScreen, OnboardingFlow });
