'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAuthUser } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, PillarChip, SectionHead, Toast, EmptyState, StatusPill } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface ToastPayload { msg: string; icon?: string; }
interface CheckInRow {
  id: string; notes: string | null; follow_up_action: string | null;
  follow_up_done: boolean; created_at: string;
  leaders: { name: string } | null;
}
interface PairingRow {
  id: string; pillar: string | null; matched_at: string | null;
  mentor: { id: string; name: string; whatsapp: string | null; email: string | null } | null;
}

export default function MentorshipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState<PairingRow | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRow[]>([]);
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
      const user = await getAuthUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const [pairingRes, ciData] = await Promise.all([
        supabase
          .from('mentor_pairings')
          .select('id,pillar,matched_at,mentor:mentor_id(id,name,whatsapp,email)')
          .eq('mentee_id', memberRow.id)
          .eq('status', 'active')
          .order('matched_at', { ascending: false })
          .maybeSingle(),
        supabase
          .from('check_ins')
          .select('id,notes,follow_up_action,follow_up_done,created_at,leaders:leader_id(name)')
          .eq('member_id', memberRow.id)
          .order('created_at', { ascending: false }),
      ]);

      setPairing((pairingRes.data ?? null) as unknown as PairingRow | null);
      setCheckIns((ciData.data ?? []) as unknown as CheckInRow[]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[160, 56, 88, 88].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--navy)', fontWeight: 600, fontSize: 13 }}>
            <Icon name="arrowleft" size={18} /> Back
          </button>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Mentorship</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{pairing ? 'Active pairing' : 'Not yet matched'}</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pairing && pairing.mentor ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ background: 'var(--navy)', color: '#fff', padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={pairing.mentor.name} size={52} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 800 }}>{pairing.mentor.name}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>Your mentor</div>
                </div>
                <StatusPill status="ontrack" size="sm" />
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  {pairing.pillar && <PillarChip pillar={pairing.pillar} size="sm" />}
                  {pairing.matched_at && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Matched {new Date(pairing.matched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 9 }}>
                  {pairing.mentor.whatsapp ? (
                    <a href={`https://wa.me/${pairing.mentor.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ flex: 1, textDecoration: 'none' }}>
                      <Icon name="message" size={16} /> WhatsApp
                    </a>
                  ) : (
                    <button onClick={() => showToast({ msg: 'No WhatsApp number on file for this mentor.' })} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                      <Icon name="message" size={16} /> WhatsApp
                    </button>
                  )}
                  {pairing.mentor.email ? (
                    <a href={`mailto:${pairing.mentor.email}`} className="btn btn-outline btn-sm" style={{ flex: 1, textDecoration: 'none' }}>
                      <Icon name="mail" size={16} /> Email
                    </a>
                  ) : (
                    <button onClick={() => showToast({ msg: 'No email on file for this mentor.' })} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                      <Icon name="mail" size={16} /> Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon="users" title="Your mentor will be assigned soon" body="Once your leadership team matches you with a mentor, their details will appear here." />
          )}

          {/* check-in notes */}
          <div>
            <SectionHead title="1:1 session notes" />
            {checkIns.length === 0 ? (
              <EmptyState icon="users" title="No notes yet" body="Your leader's notes from 1:1 sessions will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {checkIns.map(ci => (
                  <div key={ci.id} className="card card-pad">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                      <Avatar name={ci.leaders?.name ?? 'Leader'} size={36} tone="soft" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{ci.leaders?.name ?? 'Your leader'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{new Date(ci.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>
                    {ci.notes && <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>{ci.notes}</div>}
                    {ci.follow_up_action && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: ci.follow_up_done ? 'var(--navy-tint)' : 'var(--surface-2)' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 7, flex: 'none', background: ci.follow_up_done ? 'var(--navy)' : '#fff', border: ci.follow_up_done ? 'none' : '1.5px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {ci.follow_up_done && <Icon name="check" size={13} stroke={3} color="#fff" />}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: ci.follow_up_done ? 'var(--faint)' : 'var(--ink)', textDecoration: ci.follow_up_done ? 'line-through' : 'none' }}>{ci.follow_up_action}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
      <Toast toast={toast} />
    </div>
  );
}
