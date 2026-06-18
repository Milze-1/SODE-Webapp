'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, PointsBadge, Segmented, Field, TextInput, Toast } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface ToastPayload { msg: string; icon?: string; points?: number; }

interface Invitation {
  id: string; name: string | null; email: string | null; phone: string | null;
  stage: string; created_at: string;
}

const STAGES = [
  { key: 'sent', label: 'Sent', pts: 5 },
  { key: 'opened', label: 'Opened', pts: 0 },
  { key: 'joined', label: 'Joined', pts: 50 },
  { key: 'attended', label: 'Attended', pts: 30 },
  { key: 'active', label: 'Active', pts: 15 },
];

const stageIdx = (k: string) => STAGES.findIndex(s => s.key === k);
const invitePoints = (stage: string) => STAGES.slice(0, stageIdx(stage) + 1).reduce((a, s) => a + s.pts, 0);

function LifecycleTracker({ stage }: { stage: string }) {
  const cur = stageIdx(stage);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 12 }}>
      {STAGES.map((s, i) => {
        const done = i <= cur; const isCur = i === cur;
        return (
          <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && <div style={{ position: 'absolute', top: 11, right: '50%', width: '100%', height: 2, background: i <= cur ? 'var(--navy)' : 'var(--line-2)' }} />}
            <div style={{ position: 'relative', zIndex: 1, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--navy)' : '#fff', border: done ? 'none' : '1.5px solid var(--line-2)', boxShadow: isCur ? '0 0 0 4px var(--navy-tint)' : 'none' }}>
              {done && <Icon name="check" size={13} stroke={3} color="#fff" />}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 5, color: done ? 'var(--ink)' : 'var(--faint)', textAlign: 'center' }}>{s.label}</div>
            {s.pts > 0 && <div className="tnum" style={{ fontSize: 9, color: done ? 'var(--navy)' : 'var(--faint)', fontWeight: 700 }}>+{s.pts}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function InvitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [totalPoints, setTotalPoints] = useState(0);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [view, setView] = useState('send');
  const [refCode, setRefCode] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [batch, setBatch] = useState<{ name: string; contact: string }[]>([]);
  const [msg, setMsg] = useState("Hi! I've been growing with The School of Daniels & Esthers — a community helping young people thrive spiritually and in the marketplace. I'd love for you to come.");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cap = 10;

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
      const { data: memberRow } = await supabase.from('members').select('id, name, points, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMemberId(memberRow.id);
      setMemberName(memberRow.name ?? '');

      const { data: invRes } = await supabase.from('invitations').select('id,name,email,phone,stage,created_at').eq('inviter_id', memberRow.id).order('created_at', { ascending: false });
      const invs = (invRes ?? []) as Invitation[];
      setInvitations(invs);
      setTotalPoints(invs.reduce((a, i) => a + invitePoints(i.stage), 0));

      // Load or create referral code
      fetch('/api/referral/my-code')
        .then(r => r.json())
        .then((j: { code?: string }) => { if (j.code) setRefCode(j.code); })
        .catch(() => {});

      setLoading(false);
    })();
  }, [router]);

  const addContact = () => {
    if (!contact.trim() || batch.length >= cap) return;
    setBatch(b => [...b, { name: name.trim(), contact: contact.trim() }]);
    setName(''); setContact('');
  };

  const send = async () => {
    if (!memberId || batch.length === 0 || !consent) return;
    setSending(true);
    try {
      const supabase = createClient();
      const rows = batch.map(c => ({
        inviter_id: memberId,
        name: c.name || null,
        email: c.contact.includes('@') ? c.contact : null,
        phone: !c.contact.includes('@') ? c.contact : null,
        stage: 'sent',
      }));
      const { data, error } = await supabase.from('invitations').insert(rows).select('id,name,email,phone,stage,created_at');
      if (error) throw error;
      const newInvs = (data ?? []) as Invitation[];
      setInvitations(iv => [...newInvs, ...iv]);
      setTotalPoints(p => p + batch.length * 5);
      showToast({ msg: `${batch.length} invitation${batch.length > 1 ? 's' : ''} sent.`, icon: 'userplus', points: batch.length * 5 });
      // Fire-and-forget invitation emails to those with email addresses
      const emailRecipients = batch.filter(c => c.contact.includes('@'));
      if (emailRecipients.length > 0) {
        emailRecipients.forEach(c => {
          fetch('/api/notify/invitation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviterName: memberName, inviteeName: c.name || null, inviteeEmail: c.contact, message: msg }),
          }).catch(e => console.warn('[invite] email notify failed (non-fatal):', e));
        });
      }
      setBatch([]); setConsent(false); setView('mine');
    } catch {
      showToast({ msg: 'Could not send — try again.' });
    } finally { setSending(false); }
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[120, 48, 88, 88].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 12px' }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Invite &amp; Earn</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Grow the room</div>
            </div>
            <PointsBadge value={totalPoints} size="sm" />
          </div>
        </div>

        <div style={{ padding: '14px 16px 100px' }}>
          {/* personal referral link */}
          {refCode && (() => {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thesode.org';
            const link = `${appUrl}/register?ref=${refCode}`;
            const copyLink = () => {
              navigator.clipboard.writeText(link).then(() => {
                setCopyToast(true);
                setTimeout(() => setCopyToast(false), 2000);
              }).catch(() => {});
            };
            const waText = encodeURIComponent(`Hi! I've been growing with The School of Daniels & Esthers — a community helping young people thrive spiritually and in the marketplace. Join me here: ${link}`);
            return (
              <div className="card card-pad" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>Your invite link</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', marginBottom: 10, overflow: 'hidden' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</span>
                  {copyToast ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>Copied ✓</span>
                  ) : (
                    <button onClick={copyLink} style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', whiteSpace: 'nowrap' }}>Copy</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyLink} className="btn btn-ghost btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="copy" size={14} /> Copy link
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${waText}`, '_blank')}
                    className="btn btn-sm"
                    style={{ flex: 1, background: '#25d366', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Icon name="message" size={14} color="#fff" /> Share on WhatsApp
                  </button>
                </div>
              </div>
            );
          })()}

          {/* hero */}
          <div style={{ borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, var(--navy), var(--navy-ink))', color: '#fff', padding: 18, position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ position: 'absolute', right: -20, bottom: -24, opacity: .13 }}><Icon name="users" size={130} stroke={1.4} color="#fff" /></div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', maxWidth: 230, lineHeight: 1.25 }}>Know someone who&apos;d thrive here? Bring them in.</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.74)', marginTop: 7, maxWidth: 250 }}>An invitation is kingdom work — it earns the most points, but really, it&apos;s +1 life.</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Segmented
              options={[{ value: 'send', label: 'Send invites' }, { value: 'mine', label: `My invitations · ${invitations.length}` }]}
              value={view} onChange={setView}
            />
          </div>

          {view === 'send' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add people you know</h3>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{batch.length} of {cap}</span>
              </div>
              <div className="card card-pad" style={{ marginBottom: 12 }}>
                <Field label="Name (optional)"><TextInput value={name} onChange={setName} placeholder="e.g. Ada" /></Field>
                <Field label="Email or phone"><TextInput value={contact} onChange={setContact} placeholder="ada@email.com or 080…" icon="mail" /></Field>
                <button onClick={addContact} disabled={!contact.trim() || batch.length >= cap} className="btn btn-ghost btn-block">
                  <Icon name="plus" size={18} stroke={2.4} /> Add to list
                </button>
              </div>

              {batch.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {batch.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <Avatar name={c.name || c.contact} size={34} tone="soft" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name || 'New contact'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contact}</div>
                      </div>
                      <button onClick={() => setBatch(b => b.filter((_, j) => j !== i))} style={{ color: 'var(--faint)' }}><Icon name="x" size={18} /></button>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 10px' }}>Your message</h3>
              <TextInput value={msg} onChange={setMsg} multiline rows={5} />

              <button onClick={() => setConsent(c => !c)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: consent ? 'var(--navy-tint)' : 'var(--surface)', border: consent ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', width: '100%', marginTop: 12, marginBottom: 16 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', marginTop: 1, background: consent ? 'var(--navy)' : '#fff', border: consent ? 'none' : '1.5px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {consent && <Icon name="check" size={15} stroke={3} color="#fff" />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>I personally know these people and they&apos;ll be glad to hear from me about SODE.</span>
              </button>

              <button onClick={send} disabled={!consent || batch.length === 0 || sending} className="btn btn-primary btn-block btn-lg">
                <Icon name="userplus" size={19} stroke={2.2} color="#fff" /> Send {batch.length || ''} invitation{batch.length !== 1 ? 's' : ''}
              </button>
            </div>
          ) : (
            <div>
              {invitations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>No invitations yet</div>
                  <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 6 }}>Send your first invite above.</div>
                  <button onClick={() => setView('send')} className="btn btn-primary" style={{ marginTop: 16 }}>Send an invite</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {invitations.map(iv => (
                    <div key={iv.id} className="card card-pad">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <Avatar name={iv.name ?? iv.email ?? iv.phone ?? '?'} size={38} tone="soft" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{iv.name ?? iv.email ?? iv.phone ?? 'Contact'}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{iv.stage === 'active' ? 'Active member' : iv.stage}</div>
                        </div>
                        <PointsBadge value={invitePoints(iv.stage)} size="sm" />
                      </div>
                      <LifecycleTracker stage={iv.stage} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
      <Toast toast={toast} />
    </div>
  );
}
