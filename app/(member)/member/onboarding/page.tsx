'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { Icon, pillarOf } from '@/components/sode/icons';
import { PillarChip, Field, TextInput, OptionChips, StickyFooter } from '@/components/sode/ui';

// ─── Baseline survey questions ────────────────────────────────────────────────

const BASELINE_Q = [
  { pillar: 'spiritual', q: 'How consistent is your devotional life right now?', type: 'choice', options: ['Daily', 'A few times a week', 'Occasionally', 'Rarely'] },
  { pillar: 'career', q: 'Where are you in your career journey?', type: 'choice', options: ['Studying', 'Employed', 'Job-seeking', 'Self-employed'] },
  { pillar: 'career', q: 'Do you hold a professional certification?', type: 'choice', options: ['Yes', 'In progress', 'Not yet'] },
  { pillar: 'business', q: 'Do you run or plan to run a business?', type: 'choice', options: ['Running one', 'Registered', 'Idea stage', 'No'] },
  { pillar: 'character', q: 'How often do you serve others or volunteer?', type: 'choice', options: ['Weekly', 'Monthly', 'Rarely', 'Not yet'] },
  { pillar: null, q: 'Rate your overall growth this past year.', type: 'nps' },
  { pillar: null, q: "What do you most want to be \"ten times better\" at this year?", type: 'text' },
] as const;

// ─── Baseline survey component ────────────────────────────────────────────────

function BaselineSurvey({ onDone }: { onDone: (ans: Record<number, unknown>) => void }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, unknown>>({});
  const q = BASELINE_Q[i];
  const set = (v: unknown) => setAns(a => ({ ...a, [i]: v }));
  const last = i === BASELINE_Q.length - 1;
  const canNext = q.type === 'text' ? true : ans[i] != null;
  const p = q.pillar ? pillarOf(q.pillar) : null;

  return (
    <div className="sode" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '18px 22px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {i > 0 && (
          <button onClick={() => setI(i - 1)} style={{ color: 'var(--ink)', display: 'flex' }}>
            <Icon name="arrowleft" size={22} />
          </button>
        )}
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {BASELINE_Q.map((_, j) => (
            <div key={j} style={{ flex: 1, height: 5, borderRadius: 3, background: j <= i ? 'var(--navy)' : 'var(--surface-2)' }} />
          ))}
        </div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>{i + 1}/{BASELINE_Q.length}</span>
      </div>
      <div style={{ padding: '6px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="eyebrow">Baseline Survey · ~4 min</div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="check" size={12} stroke={2.6} color="var(--navy)" /> Autosaved
        </span>
      </div>

      {/* extra bottom padding so StickyFooter never covers the last option */}
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 100px' }}>
        {p && <div style={{ marginBottom: 12 }}><PillarChip pillar={q.pillar!} size="sm" /></div>}
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3 }}>{q.q}</div>
        <div style={{ marginTop: 18 }}>
          {q.type === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(q as { options: readonly string[] }).options.map(o => {
                const seld = ans[i] === o;
                return (
                  <button key={o} onClick={() => set(o)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px', borderRadius: 'var(--r-sm)', background: seld ? 'var(--navy-tint)' : 'var(--surface)', border: seld ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', border: seld ? '6px solid var(--navy)' : '2px solid var(--line-2)', background: '#fff' }} />
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{o}</span>
                  </button>
                );
              })}
            </div>
          )}
          {q.type === 'nps' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 7 }}>
                {Array.from({ length: 11 }).map((_, n) => {
                  const seld = ans[i] === n;
                  return (
                    <button key={n} onClick={() => set(n)} className="tnum" style={{ height: 46, borderRadius: 12, fontSize: 16, fontWeight: 700, background: seld ? 'var(--navy)' : 'var(--surface)', color: seld ? '#fff' : 'var(--ink)', border: seld ? 'none' : '1px solid var(--line-2)' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginTop: 8, fontWeight: 600 }}>
                <span>Just starting</span><span>Ten times better</span>
              </div>
            </div>
          )}
          {q.type === 'text' && (
            <TextInput value={(ans[i] as string) || ''} onChange={set} multiline rows={4} placeholder="A sentence is plenty…" />
          )}
        </div>
      </div>

      <StickyFooter>
        <button onClick={() => last ? onDone(ans) : setI(i + 1)} disabled={!canNext} className="btn btn-primary btn-lg btn-block">
          {last ? 'Finish baseline' : 'Continue'}
        </button>
      </StickyFooter>
    </div>
  );
}

// ─── Life stage / dept options ────────────────────────────────────────────────

const LIFE_STAGES = ['Student', 'Young professional', 'Entrepreneur', 'Between roles'];
const DEPTS = ['Ushering', 'Media', 'Choir', 'Welfare', 'Tech', 'Not yet'];

// Maps display labels → DB enum values (pgEnum life_stage)
const LIFE_STAGE_MAP: Record<string, string> = {
  'Student': 'student',
  'Young professional': 'young_professional',
  'Entrepreneur': 'entrepreneur',
  'Between roles': 'between_roles',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [existingMemberId, setExistingMemberId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // flow state
  const [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState(false);
  const [done, setDone] = useState(false);

  // step 0 — first-timer question
  const [firstTimer, setFirstTimer] = useState<'first' | 'returning' | null>(null);

  // form fields (steps 1–4)
  const [name, setName] = useState('');
  const [wa, setWa] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [biz, setBiz] = useState<string | null>(null);
  const [leader, setLeader] = useState<string | null>(null);
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  const total = 5;
  const canNext =
    step === 0 ? firstTimer !== null :
    step === 1 ? !!(name.trim() && wa.trim()) :
    step === 2 ? !!(stage && dept) :
    step === 3 ? consent1 :
    true;

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      setUserId(user.id);
      setUserEmail(user.email ?? '');

      const { data: memberRow } = await supabase
        .from('members')
        .select('id, name, onboarding_complete')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (memberRow?.onboarding_complete) { router.replace('/member/home'); return; }
      if (memberRow) { setExistingMemberId(memberRow.id); setName(memberRow.name ?? ''); }
      setLoading(false);
    })();
  }, [router]);

  // Ensure user_points_balance row exists — catches members who registered before this was seeded
  useEffect(() => {
    if (!existingMemberId) return;
    (async () => {
      const supabase = createClient();
      const { data: balance } = await supabase
        .from('user_points_balance')
        .select('member_id')
        .eq('member_id', existingMemberId)
        .maybeSingle();
      if (balance) return;
      const { data: member } = await supabase
        .from('members')
        .select('points')
        .eq('id', existingMemberId)
        .single();
      await supabase.from('user_points_balance').insert({
        member_id:         existingMemberId,
        total_points:      member?.points ?? 0,
        this_month_points: member?.points ?? 0,
        updated_at:        new Date().toISOString(),
      });
    })();
  }, [existingMemberId]);

  const handleFirstTimerSelect = async (value: 'first' | 'returning') => {
    setFirstTimer(value);
    if (!userId) return;
    try {
      const supabase = createClient();
      if (value === 'first') {
        await supabase.from('members').update({
          is_first_timer: true,
          first_visit_date: new Date().toISOString().slice(0, 10),
          first_timer_source: 'self_reported',
        }).eq('auth_id', userId);
      } else {
        await supabase.from('members').update({
          is_first_timer: false,
        }).eq('auth_id', userId);
      }
    } catch { /* non-critical — saved again on onboarding_complete */ }
  };

  const saveAndEnter = async (baselineAns?: Record<number, unknown>) => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        auth_id: userId,
        name: name.trim(),
        email: userEmail || null,
        whatsapp: wa.trim() || null,
        life_stage: stage ? (LIFE_STAGE_MAP[stage] ?? null) : null,
        department: dept,
        has_business: biz === 'Yes, registered' || biz === 'Just an idea',
        is_leader: leader === 'Yes',
        consent_data: consent1,
        consent_contact: consent2,
        onboarding_complete: true,
      };

      console.log('[saveAndEnter] payload:', payload);

      let memberId = existingMemberId;

      if (existingMemberId) {
        const { error: err } = await supabase.from('members').update(payload).eq('id', existingMemberId);
        if (err) { console.error('[saveAndEnter] update error:', err); throw err; }
      } else {
        const { data: inserted, error: err } = await supabase
          .from('members')
          .insert({ ...payload, points: 10 })
          .select('id')
          .single();
        if (err) { console.error('[saveAndEnter] insert error:', err); throw err; }
        memberId = inserted?.id ?? null;
      }

      // Save baseline answers to form_responses if a "Baseline Survey" form exists in DB
      if (baselineAns && memberId) {
        const { data: baselineForm } = await supabase
          .from('forms')
          .select('id')
          .eq('title', 'Baseline Survey')
          .maybeSingle();

        if (baselineForm?.id) {
          const { error: respErr } = await supabase.from('form_responses').insert({
            form_id: baselineForm.id,
            member_id: memberId,
            data: baselineAns,
          });
          if (respErr) console.error('[saveAndEnter] form_responses error:', respErr);
        }
      }

      setDone(true);
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--navy-tint)', animation: 'sode-spin 1s linear infinite' }}>
          <Icon name="refresh" size={22} color="var(--navy)" />
        </div>
      </div>
    );
  }

  // Baseline survey step
  if (baseline) {
    return <BaselineSurvey onDone={(ans) => { setBaseline(false); saveAndEnter(ans); }} />;
  }

  // Completion / welcome screen
  if (done) {
    return (
      <div className="sode" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: 'var(--bg)' }}>
        <div style={{ animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}>
          <Image src="/images/sode-primary-logo.png" alt="SODE" width={130} height={52} className="object-contain" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 22 }}>Welcome in, {name.split(' ')[0] || 'friend'}.</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5, maxWidth: 270 }}>
          Your space is ready. Let&apos;s start the climb — ten times better.
        </p>
        <button onClick={() => router.replace('/member/home')} className="btn btn-primary btn-lg" style={{ marginTop: 26, minWidth: 200 }}>
          Enter SODE
        </button>
      </div>
    );
  }

  // ConsentRow inline component
  const ConsentRow = ({ on, set, title, body }: { on: boolean; set: (v: boolean) => void; title: string; body: string }) => (
    <button onClick={() => set(!on)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: on ? 'var(--navy-tint)' : 'var(--surface)', border: on ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', width: '100%' }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', marginTop: 1, border: on ? 'none' : '1.5px solid var(--line-2)', background: on ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Icon name="check" size={15} stroke={3} color="#fff" />}
      </span>
      <span>
        <span style={{ fontSize: 14, fontWeight: 700, display: 'block' }}>{title}</span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{body}</span>
      </span>
    </button>
  );

  return (
    <div className="sode" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* progress bar */}
      <div style={{ padding: '18px 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{ color: 'var(--ink)', display: 'flex' }}>
            <Icon name="arrowleft" size={22} />
          </button>
        )}
        <div style={{ flex: 1, display: 'flex', gap: 5 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />
          ))}
        </div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>{step + 1}/{total}</span>
      </div>

      {/* scrollable content — paddingBottom reserves space for the StickyFooter */}
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 180px' }}>

        {/* ── Step 0: First-timer question ─────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>Welcome to SODE! 👋</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
              Before we set up your profile, tell us about yourself.
            </p>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Have you attended a SODE session or event before?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => handleFirstTimerSelect('first')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 'var(--r-sm)', textAlign: 'left', width: '100%',
                  background: firstTimer === 'first' ? 'var(--navy-tint)' : 'var(--surface)',
                  border: firstTimer === 'first' ? '1.5px solid var(--navy)' : '1px solid var(--line-2)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 28, flex: 'none' }}>🌱</span>
                <span>
                  <span style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 2 }}>No, this is my first time</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>I am new to SODE</span>
                </span>
              </button>
              <button
                onClick={() => handleFirstTimerSelect('returning')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 'var(--r-sm)', textAlign: 'left', width: '100%',
                  background: firstTimer === 'returning' ? 'var(--navy-tint)' : 'var(--surface)',
                  border: firstTimer === 'returning' ? '1.5px solid var(--navy)' : '1px solid var(--line-2)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 28, flex: 'none' }}>👋</span>
                <span>
                  <span style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 2 }}>Yes, I have been before</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>I am a returning member</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: The basics ───────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>The basics</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 22 }}>So we know who&apos;s in the room.</p>
            <Field label="Full name">
              <TextInput value={name} onChange={setName} placeholder="e.g. Tofunmi Adeyemi" />
            </Field>
            <Field label="WhatsApp number" hint="We use this for gentle reminders only.">
              <TextInput value={wa} onChange={setWa} placeholder="080…" icon="message" />
            </Field>
          </div>
        )}

        {/* ── Step 2: About you ────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>About you</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 20 }}>Helps us tailor your pillars.</p>
            <Field label="Life stage">
              <OptionChips options={LIFE_STAGES} value={stage ?? ''} onChange={v => setStage(v as string)} />
            </Field>
            <Field label="Department / serving">
              <OptionChips options={DEPTS} value={dept ?? ''} onChange={v => setDept(v as string)} />
            </Field>
            <Field label="Running a business?">
              <OptionChips options={['Yes, registered', 'Just an idea', 'Not yet']} value={biz ?? ''} onChange={v => setBiz(v as string)} />
            </Field>
            <Field label="A leadership role?">
              <OptionChips options={['Yes', 'No']} value={leader ?? ''} onChange={v => setLeader(v as string)} />
            </Field>
          </div>
        )}

        {/* ── Step 3: Data consent ─────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>How we use your data</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
              Plain and simple — you&apos;re always in control. You can export or delete your data anytime.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <ConsentRow on={consent1} set={setConsent1} title="Store my growth data" body="Goals, wins, attendance — to show your progress. Required to use SODE." />
              <ConsentRow on={consent2} set={setConsent2} title="Contact me on WhatsApp & email" body="Reminders, readings and celebrate moments. Optional — you can opt out anytime." />
            </div>
          </div>
        )}

        {/* ── Step 4: Baseline survey intro ────────────────────────────────── */}
        {step === 4 && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, margin: '0 auto', borderRadius: 17, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trendingup" size={28} stroke={2} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 14 }}>Your Baseline Survey</h1>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 7, lineHeight: 1.5 }}>
                About 4 minutes · 7 questions. It captures where you&apos;re starting so we can measure how far you climb.
              </p>
            </div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['spiritual', 'Your devotional rhythm'],
                ['career', 'Where you are in your career'],
                ['business', 'Your business stage'],
                ['character', 'How you serve others'],
                [null, 'Overall growth & the year ahead'],
              ] as [string | null, string][]).map(([pk, label], idx) => {
                const pp = pk ? pillarOf(pk) : null;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', color: pp ? pp.color : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: 'var(--sh-sm)' }}>
                      <Icon name={pp ? pp.icon : 'sparkles'} size={17} stroke={2.1} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* StickyFooter — position: fixed so keyboard never covers it */}
      <StickyFooter>
        {error && (
          <p style={{ fontSize: 13, color: '#c5453b', textAlign: 'center', marginBottom: 8, marginTop: 0 }}>{error}</p>
        )}
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canNext} className="btn btn-primary btn-lg btn-block">
            Continue
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setBaseline(true)} disabled={saving} className="btn btn-primary btn-lg btn-block">
              <Icon name="trendingup" size={18} color="#fff" /> Take the baseline now
            </button>
            <button onClick={() => saveAndEnter()} disabled={saving} className="btn btn-ghost btn-block">
              {saving ? 'Saving…' : "I'll do it later"}
            </button>
          </div>
        )}
      </StickyFooter>
    </div>
  );
}
