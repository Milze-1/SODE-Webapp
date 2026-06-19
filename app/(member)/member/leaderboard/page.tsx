'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface Member {
  id: string;
  name: string;
  points: number;
  auth_id: string;
}

// Podium display order: 2nd (left), 1st (centre), 3rd (right)
const PODIUM_ORDER = [1, 0, 2] as const;
const BAR_HEIGHTS  = [120, 90, 70] as const; // #1, #2, #3
const BAR_COLORS   = ['#1e2a52', '#64748b', '#78716c'] as const; // navy, slate, stone
const MEDALS       = ['🥇', '🥈', '🥉'] as const;

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [members, setMembers]   = useState<Member[]>([]);
  const [me, setMe]             = useState<Member | null>(null);
  const [myRank, setMyRank]     = useState(0);
  const [period, setPeriod]     = useState<'month' | 'cycle' | 'all'>('month');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: meRow } = await supabase
        .from('members')
        .select('id, name, points, onboarding_complete, auth_id')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (!meRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const { data: list } = await supabase
        .from('members')
        .select('id, name, points, auth_id')
        .gt('points', 0)
        .order('points', { ascending: false })
        .limit(100);

      const entries = (list ?? []) as Member[];
      setMembers(entries);

      const idx = entries.findIndex(m => m.auth_id === user.id);
      if (idx >= 0) {
        setMe(entries[idx]);
        setMyRank(idx + 1);
      } else {
        setMe({ id: meRow.id, name: meRow.name ?? '', points: meRow.points ?? 0, auth_id: user.id });
        setMyRank(entries.length + 1);
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[200, 52, 52, 52, 52].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 12, background: 'var(--surface-2)' }} />
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  const top3 = members.slice(0, 3);
  const rest  = members.slice(3);
  const isEmpty = members.length === 0;

  // Pin the "You" bar when user is NOT highlighted in the #4+ list
  const meInList = rest.some(m => m.auth_id === me?.auth_id);
  const showPinnedBar = !meInList;

  return (
    <div className="member-page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Sticky header ───────────────────────────────────── */}
      <div style={{
        flexShrink: 0, background: 'rgba(255,255,255,.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)', padding: '13px 16px 12px',
      }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Leaderboard</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Grow together</div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────── */}
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px 32px' }}>

          {/* Period selector */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 24 }}>
            {(['month', 'cycle', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 9,
                  fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: period === p ? 'var(--navy)' : 'transparent',
                  color: period === p ? '#fff' : 'var(--muted)',
                  transition: 'background .15s, color .15s',
                }}
              >
                {p === 'month' ? 'This Month' : p === 'cycle' ? 'This Cycle' : 'All-time'}
              </button>
            ))}
          </div>

          {isEmpty ? (
            /* ── Empty state ──────────────────────────────── */
            <div style={{ textAlign: 'center', padding: '52px 24px 36px' }}>
              <div style={{ fontSize: 56, marginBottom: 14, opacity: .55 }}>🏆</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                No one on the board yet
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 22 }}>
                Start earning points to be first!
              </div>
              <button
                onClick={() => router.push('/member/goals')}
                style={{
                  padding: '11px 26px', borderRadius: 10,
                  background: 'var(--navy)', color: '#fff',
                  fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              >
                + Set a goal
              </button>
            </div>
          ) : (
            <>
              {/* ── PODIUM ──────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
                {PODIUM_ORDER.map((rankIdx, col) => {
                  const m     = top3[rankIdx];
                  const color = BAR_COLORS[rankIdx];
                  const barH  = BAR_HEIGHTS[rankIdx];
                  const isYou = m?.auth_id === me?.auth_id;

                  if (!m) {
                    // Fewer than 3 members — keep spacing
                    return <div key={`gap-${col}`} style={{ flex: 1 }} />;
                  }

                  return (
                    <div key={m.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                      {/* Medal emoji */}
                      <div style={{ fontSize: 22, marginBottom: 5, lineHeight: 1 }}>
                        {MEDALS[rankIdx]}
                      </div>

                      {/* Avatar — overlaps top of bar */}
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                        background: color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 16, letterSpacing: '.01em',
                        marginBottom: -20, // sits on top of bar
                        position: 'relative', zIndex: 1,
                        boxShadow: rankIdx === 0
                          ? '0 4px 16px rgba(30,42,82,.4)'
                          : '0 2px 8px rgba(0,0,0,.16)',
                        outline: isYou ? '2.5px solid #fff' : 'none',
                        outlineOffset: isYou ? '2px' : '0',
                      }}>
                        {initials(m.name)}
                      </div>

                      {/* Bar */}
                      <div style={{
                        width: '100%', height: barH,
                        background: color, opacity: rankIdx === 0 ? 1 : 0.82,
                        borderRadius: '8px 8px 0 0',
                      }} />

                      {/* Name */}
                      <div style={{
                        fontSize: 12.5, fontWeight: 700, marginTop: 7,
                        textAlign: 'center', maxWidth: '100%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        paddingInline: 4,
                      }}>
                        {m.name.split(' ')[0]}
                        {isYou && (
                          <span style={{ color: 'var(--navy)', fontStyle: 'normal' }}> ★</span>
                        )}
                      </div>

                      {/* Points */}
                      <div className="tnum" style={{ fontSize: 12, fontWeight: 800, color, marginTop: 2 }}>
                        {m.points.toLocaleString()} pts
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── RANKED LIST (#4 onwards) ────────────────── */}
              {rest.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {rest.map((m, i) => {
                    const rank  = i + 4;
                    const isYou = m.auth_id === me?.auth_id;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', borderRadius: 12,
                          background: isYou ? 'rgba(30,42,82,.07)' : 'var(--surface)',
                          border: `1px solid ${isYou ? 'rgba(30,42,82,.22)' : 'var(--line)'}`,
                        }}
                      >
                        <span
                          className="tnum"
                          style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', width: 26, textAlign: 'right', flexShrink: 0 }}
                        >
                          #{rank}
                        </span>
                        <Avatar name={m.name} size={36} tone={isYou ? 'navy' : 'grey'} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.name}
                          </span>
                          {isYou && (
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              background: 'var(--navy)', color: '#fff',
                              padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                            }}>
                              You
                            </span>
                          )}
                        </div>
                        <span
                          className="tnum"
                          style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}
                        >
                          {m.points.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Privacy note */}
              <div style={{
                textAlign: 'center', fontSize: 12, color: 'var(--faint)',
                marginTop: 18, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 5,
              }}>
                <Icon name="lock" size={12} color="var(--faint)" />
                <span>Members choose to appear here. Only name and points are shown.</span>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Pinned "You" bar ────────────────────────────────── */}
      {me && showPinnedBar && (
        <div style={{ flexShrink: 0, padding: '6px 14px 8px', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px', borderRadius: 12,
            background: 'var(--navy)', color: '#fff',
            boxShadow: '0 -2px 16px rgba(30,42,82,.15)',
          }}>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 800, width: 30, textAlign: 'center', flexShrink: 0 }}>
              #{myRank}
            </span>
            <Avatar name={me.name} size={34} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                You · {me.name.split(' ')[0]}
              </div>
            </div>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>
              {me.points.toLocaleString()} pts
            </span>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
