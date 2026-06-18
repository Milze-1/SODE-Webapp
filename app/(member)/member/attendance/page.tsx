'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import Image from 'next/image';
import { Icon } from '@/components/sode/icons';
import { SectionHead, Toast, EmptyState, StatusPill } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface ToastPayload { msg: string; icon?: string; points?: number; }
interface SessionRow { id: string; title: string; location: string | null; scheduled_at: string; is_live: boolean; }
interface RecordRow { id: string; session_id: string; status: string; checked_in_at: string | null; sessions: { title: string; scheduled_at: string; location: string | null } | null; }

const statusMeta: Record<string, { label: string; s: 'done' | 'atrisk' | 'behind' }> = {
  present: { label: 'Present', s: 'done' },
  excused: { label: 'Excused', s: 'atrisk' },
  absent:  { label: 'Missed',  s: 'behind' },
};

function deviceHint(): 'mobile' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function LoadingSkeleton() {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[140, 56, 68, 68, 68].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');

  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<SessionRow | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [history, setHistory] = useState<RecordRow[]>([]);
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
      const { data: memberRow } = await supabase.from('members').select('id, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMemberId(memberRow.id);

      let sessionQuery = supabase.from('sessions').select('id,title,location,scheduled_at,is_live');
      sessionQuery = sessionParam ? sessionQuery.eq('id', sessionParam) : sessionQuery.eq('is_live', true);
      const { data: sessionRow } = await sessionQuery.maybeSingle();

      const session = sessionRow as SessionRow | null;

      if (sessionParam && !session) {
        setSessionError('Session not found — the link may be out of date.');
      } else if (sessionParam && session && !session.is_live) {
        setSessionError(`${session.title} is not currently active.`);
      } else if (session) {
        setLiveSession(session);
        const { data: rec } = await supabase
          .from('attendance_records')
          .select('checked_in_at')
          .eq('session_id', session.id)
          .eq('member_id', memberRow.id)
          .maybeSingle();
        setCheckedInAt(rec?.checked_in_at ?? null);
      }

      const { data: historyRes } = await supabase
        .from('attendance_records')
        .select('id,session_id,status,checked_in_at,sessions(title,scheduled_at,location)')
        .eq('member_id', memberRow.id)
        .order('checked_in_at', { ascending: false })
        .limit(20);
      setHistory((historyRes ?? []) as unknown as RecordRow[]);

      setLoading(false);
    })();
  }, [router, sessionParam]);

  const doCheckIn = async () => {
    if (!memberId || !liveSession || checkingIn) return;
    setCheckingIn(true);
    try {
      const supabase = createClient();
      const { data: inserted, error } = await supabase.from('attendance_records').insert({
        session_id: liveSession.id,
        member_id: memberId,
        status: 'present',
        source: sessionParam ? 'qr' : 'self',
        device_hint: deviceHint(),
      }).select('checked_in_at,id').single();
      if (!error && inserted) {
        setCheckedInAt(inserted.checked_in_at);
        const awarded = await awardPoints(memberId, 'attendance_present', 'attendance_records', inserted.id);
        showToast({ msg: 'Checked in. Good to see you.', icon: 'check', points: awarded || undefined });
        // Check if this member was referred and award inviter their first-attendance points
        fetch('/api/referral/on-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        }).catch(() => {});
      } else {
        showToast({ msg: 'Could not check in — try again.' });
      }
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Attendance</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Your sessions</div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* live check-in card */}
          {sessionError ? (
            <div className="card card-pad" style={{ textAlign: 'center', padding: '20px 18px' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto', borderRadius: 15, background: 'var(--surface-2)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="info" size={24} stroke={2} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>{sessionError}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Ask your leader for the current check-in link.</div>
            </div>
          ) : liveSession ? (
            <div className="card" style={{ overflow: 'hidden', textAlign: 'center', padding: '26px 18px' }}>
              {!checkedInAt ? (
                <>
                  <Image src="/images/sode-primary-logo.png" alt="SODE" width={80} height={56} className="object-contain" />
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '5px 11px', borderRadius: 999, background: 'var(--navy-tint)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--navy)', animation: 'sode-pulse 1.4s ease-in-out infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--navy)' }}>Live now</span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10 }}>{liveSession.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{liveSession.location ?? ''}</div>
                  <button onClick={doCheckIn} disabled={checkingIn} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }}>
                    <Icon name="check" size={20} stroke={2.4} color="#fff" /> {checkingIn ? 'Checking in…' : 'Check in now'}
                  </button>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10 }}>One tap — we confirm by time.</div>
                </>
              ) : (
                <>
                  <div style={{ width: 60, height: 60, margin: '0 auto', borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}>
                    <Icon name="check" size={32} stroke={2.6} color="#fff" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 14 }}>You&apos;re checked in</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {liveSession.title} · {fmtTime(checkedInAt)}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card card-pad" style={{ textAlign: 'center', padding: '20px 18px' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto', borderRadius: 15, background: 'var(--surface-2)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="calendarclock" size={24} stroke={2} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>No session open right now</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Check-in opens when a session goes live.</div>
            </div>
          )}

          {/* history */}
          <div>
            <SectionHead title="History" />
            {history.length === 0 ? (
              <EmptyState icon="calendarclock" title="No sessions yet" body="Your attendance history will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {history.map(r => {
                  const m = statusMeta[r.status] ?? statusMeta.absent;
                  const s = r.sessions;
                  return (
                    <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name="calendarclock" size={18} stroke={2} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{s?.title ?? 'Session'}</div>
                        <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                          {s?.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                        </div>
                      </div>
                      <StatusPill status={m.s} size="sm" />
                    </div>
                  );
                })}
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
