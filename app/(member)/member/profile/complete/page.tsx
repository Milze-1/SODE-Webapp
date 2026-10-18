'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Field, TextInput, OptionChips, StickyFooter } from '@/components/sode/ui';
import PageLoader from '@/components/PageLoader';
import {
  LIFE_STAGES, DEPTS, LIFE_STAGE_MAP, LIFE_STAGE_LABEL, INDUSTRIES, CAREER_STAGES, STRENGTH_AREAS,
  MOUNTAINS, LEADERSHIP_OPTIONS, BUSINESS_STATUSES, HAS_BUSINESS_STATUSES, BUSINESS_DETAIL_STATUSES,
  BUSINESS_INDUSTRIES, BUSINESS_EMPLOYEES, SUPPORT_OPTIONS, MOUNTAIN_TO_PILLAR, PROFILE_FIELDS,
} from '@/lib/profile-questions';

// "Complete your profile" task — the questions that used to be part of
// onboarding. Finishing it marks members.profile_complete, which is what the
// admin mentorship screen checks before pairing. Each step saves as you go,
// so a member can leave and pick up where they left off.

const QuestionLabel = ({ title, hint }: { title: string; hint?: string }) => (
  <>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', borderLeft: '3px solid var(--navy)', paddingLeft: 10, marginBottom: hint ? 4 : 10, lineHeight: 1.3 }}>{title}</div>
    {hint && <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 13, marginBottom: 10 }}>{hint}</div>}
  </>
);

export default function CompleteProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // step 0 — about you
  const [stage, setStage] = useState<string | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [mountains, setMountains] = useState<string[]>([]);
  const [mountainError, setMountainError] = useState(false);

  // step 1 — work & strengths
  const [industry, setIndustry] = useState<string | null>(null);
  const [industryOtherText, setIndustryOtherText] = useState('');
  const [careerStage, setCareerStage] = useState<string | null>(null);
  const [strengthArea, setStrengthArea] = useState<string[]>([]);
  const [strengthAreaOtherText, setStrengthAreaOtherText] = useState('');
  const [leadershipRole, setLeadershipRole] = useState<string[]>([]);

  // step 2 — goal & business
  const [businessStatus, setBusinessStatus] = useState<string | null>(null);
  const [businessIndustry, setBusinessIndustry] = useState<string | null>(null);
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessEmployees, setBusinessEmployees] = useState<string | null>(null);
  const [threeYearGoal, setThreeYearGoal] = useState('');
  const [supportNeeded, setSupportNeeded] = useState<string | null>(null);

  const total = 3;
  const canNext =
    step === 0 ? !!(stage && dept && mountains.length > 0) :
    step === 1 ? !!(industry && (industry !== 'Other' || industryOtherText.trim()) && careerStage && strengthArea.length > 0 && (!strengthArea.includes('Other') || strengthAreaOtherText.trim()) && leadershipRole.length > 0) :
    !!(businessStatus && threeYearGoal.trim() && supportNeeded);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getAuthUser();
      if (!user) { router.replace('/login'); return; }

      const { data: m } = await supabase
        .from('members')
        .select(`id,onboarding_complete,profile_complete,${PROFILE_FIELDS},business_industry,business_description,business_employees`)
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!m?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMemberId(m.id);

      // Prefill anything already answered
      if (m.life_stage) setStage(LIFE_STAGE_LABEL[m.life_stage] ?? null);
      if (m.department) setDept(m.department);
      if (Array.isArray(m.mountains)) setMountains(m.mountains);
      if (m.industry) {
        if (INDUSTRIES.includes(m.industry)) setIndustry(m.industry);
        else { setIndustry('Other'); setIndustryOtherText(m.industry); }
      }
      if (m.career_stage) setCareerStage(m.career_stage);
      if (Array.isArray(m.strength_area)) {
        const known = (m.strength_area as string[]).filter(s => STRENGTH_AREAS.includes(s));
        const custom = (m.strength_area as string[]).filter(s => !STRENGTH_AREAS.includes(s));
        setStrengthArea(custom.length ? [...known, 'Other'] : known);
        if (custom.length) setStrengthAreaOtherText(custom.join(', '));
      }
      if (Array.isArray(m.leadership_role)) setLeadershipRole(m.leadership_role);
      if (m.business_status) setBusinessStatus(m.business_status);
      if (m.business_industry) setBusinessIndustry(m.business_industry);
      if (m.business_description) setBusinessDescription(m.business_description);
      if (m.business_employees) setBusinessEmployees(m.business_employees);
      if (m.three_year_goal) setThreeYearGoal(m.three_year_goal);
      if (m.support_needed) setSupportNeeded(m.support_needed);

      setLoading(false);
    })();
  }, [router]);

  const stepPayload = (s: number) => {
    if (s === 0) return {
      life_stage: stage ? (LIFE_STAGE_MAP[stage] ?? null) : null,
      department: dept,
      mountains: mountains.length > 0 ? mountains : null,
    };
    if (s === 1) return {
      industry: industry === 'Other' ? (industryOtherText.trim() || null) : (industry || null),
      career_stage: careerStage || null,
      strength_area: strengthArea.length > 0
        ? (strengthArea.includes('Other')
            ? [...strengthArea.filter(x => x !== 'Other'), strengthAreaOtherText.trim()].filter(Boolean)
            : strengthArea)
        : null,
      leadership_role: leadershipRole.length > 0 ? leadershipRole : null,
      is_leader: leadershipRole.some(r => r.toLowerCase().startsWith('yes')),
    };
    const hasDetails = BUSINESS_DETAIL_STATUSES.includes(businessStatus ?? '');
    return {
      business_status: businessStatus || null,
      has_business: HAS_BUSINESS_STATUSES.includes(businessStatus ?? ''),
      business_industry: hasDetails ? (businessIndustry || null) : null,
      business_description: hasDetails ? (businessDescription.trim() || null) : null,
      business_employees: hasDetails ? (businessEmployees || null) : null,
      three_year_goal: threeYearGoal.trim() || null,
      support_needed: supportNeeded || null,
    };
  };

  const saveStep = async (finish: boolean) => {
    if (!memberId) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      // Saved server-side (see app/api/profile/save) — the direct browser
      // update failed for some members with no useful error.
      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: stepPayload(step), finish }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: null })) as { error: string | null };
        throw new Error(msg || 'Something went wrong — please try again.');
      }

      if (!finish) { setStep(step + 1); return; }

      // Auto-create the 3-year goal (non-fatal if it fails)
      if (threeYearGoal.trim()) {
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
          console.error('[profile/complete] goal auto-create failed (non-fatal):', goalErr);
        }
      }

      // Clear the outstanding task reminders from the notification center
      await supabase.from('reminders').update({ read_at: now })
        .eq('member_id', memberId).eq('type', 'profile_incomplete').is('read_at', null);

      setDone(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Something went wrong — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  if (done) {
    return (
      <div className="sode" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: 'var(--bg)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sode-pop .35s cubic-bezier(.16,1,.3,1)' }}>
          <Icon name="check" size={30} stroke={3} color="#fff" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 22 }}>Profile complete</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5, maxWidth: 290 }}>
          Thank you. Your leadership team can now match you with a mentor — we&apos;ll notify you as soon as it happens.
        </p>
        <button onClick={() => router.replace('/member/home')} className="btn btn-primary btn-lg" style={{ marginTop: 26, minWidth: 220 }}>
          Back to home
        </button>
      </div>
    );
  }

  const sectionGap = { marginBottom: 32 };

  return (
    <div className="sode" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* progress bar */}
      <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) 22px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => (step > 0 ? setStep(step - 1) : router.back())} aria-label="Back" style={{ color: 'var(--ink)', display: 'flex' }}>
          <Icon name={step > 0 ? 'arrowleft' : 'x'} size={22} />
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 5 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />
          ))}
        </div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>{step + 1}/{total}</span>
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 180px' }}>

        {/* ── Step 0: About you ───────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>About you</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 28, lineHeight: 1.5 }}>
              Finish your profile to get matched with a mentor. Your answers save as you go.
            </p>

            <div style={sectionGap}>
              <QuestionLabel title="Life stage" />
              <OptionChips options={LIFE_STAGES} value={stage ?? ''} onChange={v => setStage(v as string)} />
            </div>

            <div style={sectionGap}>
              <QuestionLabel title="Department / serving" />
              <OptionChips options={DEPTS} value={dept ?? ''} onChange={v => setDept(v as string)} />
            </div>

            <div style={sectionGap}>
              <QuestionLabel title="Which mountains of influence do you feel most called to?" hint="Select up to 2 — this shapes your cohort and mentor matching on SODE" />
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
                        if (sel) setMountains(prev => prev.filter(x => x !== m.key));
                        else if (mountains.length >= 2) setMountainError(true);
                        else setMountains(prev => [...prev, m.key]);
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
          </div>
        )}

        {/* ── Step 1: Work & strengths ───────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Work &amp; strengths</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, marginBottom: 28 }}>Helps us find a mentor who fits.</p>

            <div style={sectionGap}>
              <QuestionLabel title="What field or industry do you work in?" />
              <OptionChips options={INDUSTRIES} value={industry ?? ''} onChange={v => { setIndustry(v as string); if (v !== 'Other') setIndustryOtherText(''); }} />
              {industry === 'Other' && (
                <div style={{ marginTop: 10 }}>
                  <TextInput value={industryOtherText} onChange={setIndustryOtherText} placeholder="Please specify..." />
                </div>
              )}
            </div>

            <div style={sectionGap}>
              <QuestionLabel title="Where are you in your career or life stage?" />
              <OptionChips options={CAREER_STAGES} value={careerStage ?? ''} onChange={v => setCareerStage(v as string)} />
            </div>

            <div style={sectionGap}>
              <QuestionLabel title="What is your primary area of strength?" hint="The thing people come to you for" />
              <OptionChips options={STRENGTH_AREAS} value={strengthArea} multi onChange={v => { const arr = v as string[]; setStrengthArea(arr); if (!arr.includes('Other')) setStrengthAreaOtherText(''); }} />
              {strengthArea.includes('Other') && (
                <div style={{ marginTop: 10 }}>
                  <TextInput value={strengthAreaOtherText} onChange={setStrengthAreaOtherText} placeholder="Please specify..." />
                </div>
              )}
            </div>

            <div style={sectionGap}>
              <QuestionLabel title="Do you currently hold any leadership role?" hint="In any sphere — workplace, church, community, or family" />
              <OptionChips options={LEADERSHIP_OPTIONS} value={leadershipRole} multi onChange={v => setLeadershipRole(v as string[])} />
            </div>
          </div>
        )}

        {/* ── Step 2: Goal & business ────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}>
                Take a moment with this section. Your answers here become your anchor on SODE — they shape your growth plan, mentor matches, and how we track your progress over the next 3 years. Be honest and specific.
              </div>
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Business &amp; Entrepreneurship</div>
            <Field label="What is your business or entrepreneurship status?">
              <OptionChips options={BUSINESS_STATUSES} value={businessStatus ?? ''} onChange={v => setBusinessStatus(v as string)} />
            </Field>

            {BUSINESS_DETAIL_STATUSES.includes(businessStatus ?? '') && (
              <div>
                <Field label="What industry is your business in?">
                  <OptionChips options={BUSINESS_INDUSTRIES} value={businessIndustry ?? ''} onChange={v => setBusinessIndustry(v as string)} />
                </Field>
                <Field label="Briefly — what does your business do?">
                  <TextInput
                    value={businessDescription} onChange={setBusinessDescription}
                    multiline rows={3} placeholder="e.g. We provide affordable digital banking tools for SMEs in Lagos…"
                  />
                </Field>
                <Field label="How many people does it employ or engage?">
                  <OptionChips options={BUSINESS_EMPLOYEES} value={businessEmployees ?? ''} onChange={v => setBusinessEmployees(v as string)} />
                </Field>
              </div>
            )}

            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14, marginTop: 24 }}>Your Goal</div>
            <Field label="Write the one goal you are hoping to achieve in the next 3 years" hint="Make it ambitious but real — career, business, ministry, or personal">
              <TextInput
                value={threeYearGoal} onChange={setThreeYearGoal}
                multiline rows={5}
                placeholder="e.g. By 2029 I will have launched a licensed fintech company serving 10,000 users with a team of 15…"
              />
            </Field>
            <Field label="What kind of support would help you most right now?">
              <OptionChips options={SUPPORT_OPTIONS} value={supportNeeded ?? ''} onChange={v => setSupportNeeded(v as string)} />
            </Field>
          </div>
        )}
      </div>

      <StickyFooter>
        {error && (
          <p style={{ fontSize: 13, color: '#c5453b', textAlign: 'center', marginBottom: 8, marginTop: 0 }}>{error}</p>
        )}
        <button onClick={() => saveStep(step === total - 1)} disabled={saving || !canNext} className="btn btn-primary btn-lg btn-block">
          {saving ? 'Saving…' : step < total - 1 ? 'Continue' : <><Icon name="check" size={18} color="#fff" /> Complete profile</>}
        </button>
      </StickyFooter>
    </div>
  );
}
