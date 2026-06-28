'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { Icon } from '@/components/sode/icons';
import { Field, TextInput, OptionChips, StickyFooter } from '@/components/sode/ui';

// ─── Life stage / dept options ────────────────────────────────────────────────

const LIFE_STAGES = ['Student', 'Professional', 'Entrepreneur', 'Between roles'];
const DEPTS = ['Ushering', 'Media', 'Choir', 'Welfare', 'Tech', 'Not yet'];

// Maps display labels → DB enum values (pgEnum life_stage)
const LIFE_STAGE_MAP: Record<string, string> = {
  'Student': 'student',
  'Professional': 'professional',
  'Entrepreneur': 'entrepreneur',
  'Between roles': 'between_roles',
};

const INDUSTRIES = [
  'Technology', 'Finance / banking', 'Healthcare', 'Law', 'Education',
  'Media / content', 'Creative arts', 'Business / consulting',
  'Government / public service', 'Real estate / construction',
  'Oil & gas / energy', 'Non-profit / NGO', 'Agriculture', 'Ministry / theology', 'Other',
];

const CAREER_STAGES = [
  'Just starting out (0–2 yrs)', 'Building (3–7 yrs)',
  'Established (8–15 yrs)', 'Senior / leading others', 'Transitioning / pivoting',
];

const STRENGTH_AREAS = [
  'Strategy & leadership', 'Financial analysis', 'Technology & systems',
  'Communication & storytelling', 'Teaching & training', 'Operations & execution',
  'People & relationships', 'Creative & design', 'Research & analysis',
  'Sales & business development', 'Legal & compliance', 'Healthcare & wellness', 'Other',
];

const MOUNTAINS = [
  { key: 'Business',    sub: 'Commerce, enterprise' },
  { key: 'Government',  sub: 'Policy, public service' },
  { key: 'Education',   sub: 'Schools, training' },
  { key: 'Media & arts', sub: 'Storytelling, culture' },
  { key: 'Family',      sub: 'Home, community' },
  { key: 'Religion',    sub: 'Church, ministry' },
  { key: 'Healthcare',  sub: 'Medicine, wellbeing' },
];

const LEADERSHIP_OPTIONS = [
  'Yes — leading a team or organisation',
  'Yes — leading in church / ministry',
  'Yes — community or volunteer leadership',
  'Not yet, but preparing for it',
  'No',
];

const MOUNTAIN_TO_PILLAR: Record<string, string> = {
  'Business': 'business',
  'Government': 'career',
  'Education': 'career',
  'Media & arts': 'character',
  'Family': 'character',
  'Religion': 'spiritual',
  'Healthcare': 'career',
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
  const [done, setDone] = useState(false);

  // step 0 — first-timer question
  const [firstTimer, setFirstTimer] = useState<'first' | 'returning' | null>(null);

  // step 1 — basics
  const [name, setName] = useState('');
  const [wa, setWa] = useState('');

  // step 2 — about you
  const [stage, setStage] = useState<string | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [industryOtherText, setIndustryOtherText] = useState('');
  const [careerStage, setCareerStage] = useState<string | null>(null);
  const [strengthArea, setStrengthArea] = useState<string[]>([]);
  const [strengthAreaOtherText, setStrengthAreaOtherText] = useState('');
  const [mountains, setMountains] = useState<string[]>([]);
  const [mountainError, setMountainError] = useState(false);
  const [leadershipRole, setLeadershipRole] = useState<string[]>([]);

  // step 3 — consent
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  // step 4 — goals & business
  const [businessStatus, setBusinessStatus] = useState<string | null>(null);
  const [businessIndustry, setBusinessIndustry] = useState<string | null>(null);
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessEmployees, setBusinessEmployees] = useState<string | null>(null);
  const [threeYearGoal, setThreeYearGoal] = useState('');
  const [supportNeeded, setSupportNeeded] = useState<string | null>(null);

  const total = 5;
  const canNext =
    step === 0 ? firstTimer !== null :
    step === 1 ? !!(name.trim() && wa.trim()) :
    step === 2 ? !!(stage && dept && industry && (industry !== 'Other' || industryOtherText.trim()) && careerStage && strengthArea.length > 0 && (!strengthArea.includes('Other') || strengthAreaOtherText.trim()) && mountains.length > 0 && leadershipRole.length > 0) :
    step === 3 ? consent1 :
    !!(businessStatus && threeYearGoal.trim() && supportNeeded);

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

  const saveAndEnter = async () => {
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
        has_business: ['I have a registered business', 'I have an idea, not yet started', 'Actively building (unregistered)'].includes(businessStatus ?? ''),
        is_leader: leadershipRole.some(r => r.toLowerCase().startsWith('yes')),
        consent_data: consent1,
        consent_contact: consent2,
        onboarding_complete: true,
        industry: industry === 'Other' ? (industryOtherText.trim() || null) : (industry || null),
        career_stage: careerStage || null,
        strength_area: strengthArea.length > 0
          ? (strengthArea.includes('Other')
              ? [...strengthArea.filter(s => s !== 'Other'), strengthAreaOtherText.trim()].filter(Boolean)
              : strengthArea)
          : null,
        mountains: mountains.length > 0 ? mountains : null,
        leadership_role: leadershipRole.length > 0 ? leadershipRole : null,
        business_status: businessStatus || null,
        business_industry: businessIndustry || null,
        business_description: businessDescription || null,
        business_employees: businessEmployees || null,
        three_year_goal: threeYearGoal || null,
        support_needed: supportNeeded || null,
      };

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

      // Award onboarding points via API
      if (memberId) {
        await fetch('/api/points/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId,
            ruleKey: 'onboarding_complete',
            refTable: 'members',
            refId: memberId,
          }),
        }).catch((e) => console.error('[onboarding] points award error:', e));
      }

      // Auto-create 3-year goal from onboarding answer (non-fatal if it fails)
      if (threeYearGoal.trim() && memberId) {
        try {
          const { count } = await supabase
            .from('goals')
            .select('id', { count: 'exact', head: true })
            .eq('member_id', memberId)
            .eq('created_via', 'onboarding');

          if ((count ?? 0) === 0) {
            const pillar = mountains[0] ? (MOUNTAIN_TO_PILLAR[mountains[0]] ?? 'career') : 'career';
            const rawTitle = threeYearGoal.trim();
            const firstSentence = rawTitle.split(/[.!?]/)[0].trim();
            let goalTitle = firstSentence.length > 0 && firstSentence.length <= 100 ? firstSentence : rawTitle;
            if (goalTitle.length > 100) goalTitle = goalTitle.slice(0, 100).replace(/\s+\S+$/, '').trim();
            const due = new Date();
            due.setFullYear(due.getFullYear() + 3);
            await supabase.from('goals').insert({
              member_id: memberId, pillar, title: goalTitle, notes: rawTitle,
              current: 0, target: 1, unit: 'goal',
              due_date: due.toISOString().slice(0, 10),
              status: 'ontrack', created_via: 'onboarding',
            });
          }
        } catch (goalErr) {
          console.error('[onboarding] goal auto-create failed (non-fatal):', goalErr);
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
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
              Before we set up your profile, tell us about yourself.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'var(--navy-tint)', border: '1px solid var(--navy)', marginBottom: 24 }}>
              <Icon name="mappin" size={13} color="var(--navy)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', letterSpacing: '.01em' }}>Connected to Dominion City · Victoria Island, Lagos</span>
            </div>
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
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 28 }}>Helps us tailor your pillars.</p>

            {/* Life stage */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 10, lineHeight: 1.3 }}>Life stage</div>
              <OptionChips options={LIFE_STAGES} value={stage ?? ''} onChange={v => setStage(v as string)} />
            </div>

            {/* Department */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 10, lineHeight: 1.3 }}>Department / serving</div>
              <OptionChips options={DEPTS} value={dept ?? ''} onChange={v => setDept(v as string)} />
            </div>

            {/* Industry */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 10, lineHeight: 1.3 }}>What field or industry do you work in?</div>
              <OptionChips options={INDUSTRIES} value={industry ?? ''} onChange={v => { setIndustry(v as string); if (v !== 'Other') setIndustryOtherText(''); }} />
              {industry === 'Other' && (
                <div style={{ marginTop: 10 }}>
                  <TextInput value={industryOtherText} onChange={setIndustryOtherText} placeholder="Please specify..." />
                </div>
              )}
            </div>

            {/* Career stage */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 10, lineHeight: 1.3 }}>Where are you in your career or life stage?</div>
              <OptionChips options={CAREER_STAGES} value={careerStage ?? ''} onChange={v => setCareerStage(v as string)} />
            </div>

            {/* Strength area */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 4, lineHeight: 1.3 }}>What is your primary area of strength?</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 13, marginBottom: 10 }}>The thing people come to you for</div>
              <OptionChips options={STRENGTH_AREAS} value={strengthArea} multi onChange={v => { const arr = v as string[]; setStrengthArea(arr); if (!arr.includes('Other')) setStrengthAreaOtherText(''); }} />
              {strengthArea.includes('Other') && (
                <div style={{ marginTop: 10 }}>
                  <TextInput value={strengthAreaOtherText} onChange={setStrengthAreaOtherText} placeholder="Please specify..." />
                </div>
              )}
            </div>

            {/* Mountains */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 4, lineHeight: 1.3 }}>Which mountains of influence do you feel most called to?</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 13, marginBottom: 10 }}>Select up to 2 — this shapes your cohort and mentor matching on SODE</div>
              {mountainError && (
                <div style={{ fontSize: 12, color: '#c53030', marginBottom: 8, fontWeight: 600 }}>You can only select up to 2 mountains.</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MOUNTAINS.map(m => {
                  const sel = mountains.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setMountainError(false);
                        if (sel) {
                          setMountains(prev => prev.filter(x => x !== m.key));
                        } else if (mountains.length >= 2) {
                          setMountainError(true);
                        } else {
                          setMountains(prev => [...prev, m.key]);
                        }
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                        padding: '12px 12px', borderRadius: 'var(--r-sm)', textAlign: 'left', cursor: 'pointer',
                        background: sel ? 'var(--navy-tint)' : 'var(--surface)',
                        border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)',
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: sel ? 'var(--navy)' : 'var(--ink)' }}>{m.key}</span>
                      <span style={{ fontSize: 11, color: sel ? 'var(--navy)' : 'var(--muted)' }}>{m.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leadership */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: 4, lineHeight: 1.3 }}>Do you currently hold any leadership role?</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 13, marginBottom: 10 }}>In any sphere — workplace, church, community, or family</div>
              <OptionChips options={LEADERSHIP_OPTIONS} value={leadershipRole} multi onChange={v => setLeadershipRole(v as string[])} />
            </div>
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

        {/* ── Step 4: Goals & business ─────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ paddingTop: 6 }}>
            {/* Anchor nudge */}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}>
                Take a moment with this section. Your answers here become your anchor on SODE — they shape your growth plan, mentor matches, and how we track your progress over the next 3 years. Be honest and specific. The more real you are, the more we can help.
              </div>
            </div>

            {/* Business section */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Business &amp; Entrepreneurship</div>
            <Field label="What is your business or entrepreneurship status?">
              <OptionChips
                options={['I have a registered business', 'I have an idea, not yet started', 'Actively building (unregistered)', 'No business interest currently']}
                value={businessStatus ?? ''} onChange={v => setBusinessStatus(v as string)}
              />
            </Field>

            {(businessStatus === 'I have a registered business' || businessStatus === 'Actively building (unregistered)') && (
              <div>
                <Field label="What industry is your business in?">
                  <OptionChips
                    options={['Fintech', 'Healthcare', 'Edtech', 'E-commerce', 'Food & beverage', 'Real estate', 'Media / content', 'Agriculture', 'Logistics', 'Technology / SaaS', 'Consulting', 'Other']}
                    value={businessIndustry ?? ''} onChange={v => setBusinessIndustry(v as string)}
                  />
                </Field>
                <Field label="Briefly — what does your business do?">
                  <TextInput
                    value={businessDescription} onChange={setBusinessDescription}
                    multiline rows={3} placeholder="e.g. We provide affordable digital banking tools for SMEs in Lagos…"
                  />
                </Field>
                <Field label="How many people does it employ or engage?">
                  <OptionChips
                    options={['Just me', '2–5', '6–20', '21–50', '50+']}
                    value={businessEmployees ?? ''} onChange={v => setBusinessEmployees(v as string)}
                  />
                </Field>
              </div>
            )}

            {/* Goal section */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14, marginTop: 24 }}>Your Goal</div>
            <Field label="Write the one goal you are hoping to achieve in the next 3 years" hint="Make it ambitious but real — career, business, ministry, or personal">
              <TextInput
                value={threeYearGoal} onChange={setThreeYearGoal}
                multiline rows={5}
                placeholder="e.g. By 2028 I will have launched a licensed fintech company serving 10,000 users with a team of 15, and be recognised as a leading voice in faith-driven finance in Nigeria…"
              />
            </Field>
            <Field label="What kind of support would help you most right now?">
              <OptionChips
                options={['Mentorship from someone ahead of me', 'Peer accountability', 'Skill-building / learning', 'Business connections', 'Spiritual direction', 'All of the above']}
                value={supportNeeded ?? ''} onChange={v => setSupportNeeded(v as string)}
              />
            </Field>
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
            <button onClick={saveAndEnter} disabled={saving || !canNext} className="btn btn-primary btn-lg btn-block">
              <Icon name="arrowright" size={18} color="#fff" /> Complete and enter SODE
            </button>
            <button onClick={saveAndEnter} disabled={saving} className="btn btn-ghost btn-block">
              {saving ? 'Saving…' : "I'll do it later"}
            </button>
          </div>
        )}
      </StickyFooter>
    </div>
  );
}
