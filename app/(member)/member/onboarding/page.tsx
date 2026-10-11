'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import Image from 'next/image';
import { Icon } from '@/components/sode/icons';
import { Field, TextInput, StickyFooter } from '@/components/sode/ui';
import PageLoader from '@/components/PageLoader';

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

  // step 2 — consent
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  // Onboarding is kept to the essentials. Everything else (life stage,
  // industry, mountains, goals…) is collected later by the "Complete your
  // profile" task at /member/profile/complete, which unlocks mentor matching.
  const total = 3;
  const canNext =
    step === 0 ? firstTimer !== null :
    step === 1 ? !!(name.trim() && wa.trim()) :
    consent1;

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await getAuthUser();
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
        consent_data: consent1,
        consent_contact: consent2,
        onboarding_complete: true,
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

      // Drop the "Complete your profile" task into their notifications (+ push)
      await fetch('/api/notify/profile-task', { method: 'POST' })
        .catch((e) => console.error('[onboarding] profile task notify error:', e));

      setDone(true);
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  // Completion / welcome screen
  if (done) {
    return (
      <div className="sode" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: 'var(--bg)' }}>
        <div style={{ animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}>
          <Image src="/images/sode-primary-logo.png" alt="SODE" width={130} height={52} className="object-contain" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 22 }}>Welcome in, {name.split(' ')[0] || 'friend'}.</h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5, maxWidth: 290 }}>
          Your space is ready. One more step: complete your profile so we can match you with a mentor. It takes about 3 minutes.
        </p>
        <button onClick={() => router.replace('/member/profile/complete')} className="btn btn-primary btn-lg" style={{ marginTop: 26, minWidth: 240 }}>
          Complete my profile
        </button>
        <button onClick={() => router.replace('/member/home')} className="btn btn-ghost" style={{ marginTop: 10, minWidth: 240 }}>
          Later — take me to SODE
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
              Just three quick steps to get you in.
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

        {/* ── Step 2: Data consent ─────────────────────────────────────────── */}
        {step === 2 && (
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

      </div>

      {/* StickyFooter — position: fixed so keyboard never covers it */}
      <StickyFooter>
        {error && (
          <p style={{ fontSize: 13, color: '#c5453b', textAlign: 'center', marginBottom: 8, marginTop: 0 }}>{error}</p>
        )}
        {step < total - 1 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canNext} className="btn btn-primary btn-lg btn-block">
            Continue
          </button>
        ) : (
          <button onClick={saveAndEnter} disabled={saving || !canNext} className="btn btn-primary btn-lg btn-block">
            {saving ? 'Saving…' : <><Icon name="arrowright" size={18} color="#fff" /> Enter SODE</>}
          </button>
        )}
      </StickyFooter>
    </div>
  );
}
