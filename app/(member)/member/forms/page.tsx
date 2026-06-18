'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Icon, PILLARS } from '@/components/sode/icons';
import {
  SectionHead, Sheet, Toast, OptionChips, TextInput, EmptyState, StatusPill, PillarChip,
} from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';
import { type FormAudience } from '@/lib/forms-audience';

interface ToastPayload { msg: string; icon?: string; points?: number; }

interface FormRow {
  id: string; title: string; description: string | null;
  estimated_seconds: number | null; is_pulse: boolean; is_wins_form: boolean;
  form_audience?: FormAudience | null;
  open_at: string | null; close_at: string | null;
}
interface CompletedForm { id: string; title: string; submitted_at: string | null; }

const WIN_TYPES = [
  { value: 'milestone', label: 'Hit a milestone', icon: 'flag' },
  { value: 'progress', label: 'Made progress', icon: 'trendingup' },
  { value: 'skill', label: 'Learned a skill', icon: 'bookopen' },
  { value: 'helped', label: 'Helped someone', icon: 'heart' },
  { value: 'prayer', label: 'Answered prayer', icon: 'sprout' },
  { value: 'other', label: 'Something else', icon: 'star' },
];

function WinFlow({ memberId, onClose, onToast }: { memberId: string; onClose: () => void; onToast: (t: ToastPayload) => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<string | null>(null);
  const [winPillar, setWinPillar] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const total = 3;
  const canNext = step === 0 ? !!type : step === 1 ? !!winPillar : desc.trim().length > 2;

  const submit = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: newWin } = await supabase
        .from('wins')
        .insert({ member_id: memberId, pillar: winPillar, win_type: type, description: desc, points_earned: 5 })
        .select('id').single();
      const awarded = newWin ? await awardPoints(memberId, 'win', 'wins', newWin.id) : 0;
      onClose();
      onToast({ msg: 'Logged. Well done.', points: awarded || 5 });
    } catch {
      onToast({ msg: 'Could not save — try again.' });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Share a win</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} /> ~60 sec</span>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {Array.from({ length: total }).map((_, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)', transition: 'background .2s ease' }} />)}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>What kind of win?</div>
          <OptionChips options={WIN_TYPES} value={type ?? ''} onChange={v => setType(v as string)} columns={2} />
        </div>
      )}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Which pillar did it grow?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PILLARS.map(p => {
              const sel = winPillar === p.key;
              return (
                <button key={p.key} onClick={() => setWinPillar(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
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
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ flex: '0 0 auto', paddingLeft: 16, paddingRight: 16 }}><Icon name="arrowleft" size={18} /></button>}
        {step < total - 1
          ? <button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={submit} disabled={!canNext || busy} className="btn btn-primary btn-block"><Icon name="sparkles" size={18} stroke={2.2} color="#fff" /> Share win · +5</button>}
      </div>
    </div>
  );
}

export default function FormsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<{ id: string; points: number } | null>(null);
  const [openForms, setOpenForms] = useState<FormRow[]>([]);
  const [completedForms, setCompletedForms] = useState<CompletedForm[]>([]);
  const [winSheet, setWinSheet] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, points, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMember({ id: memberRow.id, points: memberRow.points ?? 0 });

      const [forMemberRes, responsesRes] = await Promise.all([
        fetch('/api/forms/for-member').then(r => r.ok ? r.json() : { forms: [] }).catch(() => ({ forms: [] })),
        supabase.from('form_responses').select('form_id,submitted_at,forms(id,title)').eq('member_id', memberRow.id).order('submitted_at', { ascending: false }),
      ]);

      setOpenForms((forMemberRes.forms ?? []) as FormRow[]);

      interface SubmittedRow { form_id: string; submitted_at: string | null; forms: { id: string; title: string }[] | { id: string; title: string } | null; }
      const submitted = (responsesRes.data ?? []) as SubmittedRow[];
      const done: CompletedForm[] = submitted
        .map(r => {
          const f = Array.isArray(r.forms) ? r.forms[0] : r.forms;
          return f ? { id: f.id, title: f.title, submitted_at: r.submitted_at } : null;
        })
        .filter((f): f is CompletedForm => f !== null);

      setCompletedForms(done);
      setLoading(false);
    })();
  }, [router]);

  const fmtEstimate = (s: number | null) => {
    if (!s) return null;
    if (s < 60) return `~${s} seconds`;
    const m = Math.round(s / 60);
    return `~${m} minute${m === 1 ? '' : 's'}`;
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[72, 100, 100].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Forms &amp; surveys</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Open to you</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* share a win — always pinned */}
          <button onClick={() => setWinSheet(true)} style={{ textAlign: 'left', borderRadius: 'var(--r-md)', background: 'var(--navy)', color: '#fff', padding: 16, display: 'flex', alignItems: 'center', gap: 13, boxShadow: 'var(--sh-md)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="sparkles" size={22} color="#fff" stroke={2.1} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Share a win</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', marginTop: 1 }}>Always open · about 60 seconds</div>
            </div>
            <Icon name="chevronright" size={20} color="rgba(255,255,255,.7)" />
          </button>

          {/* to complete */}
          <div>
            <SectionHead title="To complete" />
            {openForms.length > 0 ? (
              <div className="member-forms-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {openForms.map(f => {
                  const icon = f.is_pulse ? 'trendingup' : 'list';
                  const pillarTag = f.form_audience?.type === 'pillar' ? f.form_audience.pillars[0] : null;
                  return (
                    <Link key={f.id} href={`/member/forms/${f.id}`} className="card card-pad" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={21} stroke={2} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</div>
                          {pillarTag && <PillarChip pillar={pillarTag} size="sm" />}
                        </div>
                        {f.description && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{f.description}</div>}
                        <div className="tnum" style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5, display: 'flex', gap: 10 }}>
                          {fmtEstimate(f.estimated_seconds) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="clock" size={12} /> {fmtEstimate(f.estimated_seconds)}</span>}
                          {f.close_at && <span>Due {new Date(f.close_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                      </div>
                      <span className="btn btn-primary btn-sm" style={{ flex: 'none', padding: '0 14px' }}>Start →</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="check" title="All clear" body="No forms waiting for you right now — check back soon." />
            )}
          </div>

          {/* completed */}
          {completedForms.length > 0 && (
            <div>
              <SectionHead title="Completed" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {completedForms.map(f => (
                  <div key={f.id} className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13, opacity: .8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="check" size={20} stroke={2.6} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {f.submitted_at ? `Submitted ${new Date(f.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Submitted'}
                      </div>
                    </div>
                    <StatusPill status="done" size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      <Sheet open={winSheet} onClose={() => setWinSheet(false)}>
        {member && <WinFlow memberId={member.id} onClose={() => setWinSheet(false)} onToast={showToast} />}
      </Sheet>
      <Toast toast={toast} />
    </div>
  );
}
