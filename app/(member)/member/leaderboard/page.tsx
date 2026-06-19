'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

type Tab = 'month' | 'cycle' | 'alltime';

type LeaderEntry = {
  rank: number;
  id: string;
  auth_id: string;
  name: string;
  points: number;
};

// Podium display order: 2nd (left), 1st (centre), 3rd (right)
const PODIUM_ORDER = [1, 0, 2] as const;
const BAR_HEIGHTS  = [120, 90, 70] as const; // #1, #2, #3
const BAR_COLORS   = ['#1e2a52', '#64748b', '#78716c'] as const;
const MEDALS       = ['🥇', '🥈', '🥉'] as const;

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

type SB = ReturnType<typeof createClient>;

async function fetchAllTime(sb: SB): Promise<LeaderEntry[]> {
  const { data } = await sb
    .from('members')
    .select('id, name, auth_id, points')
    .gt('points', 0)
    .order('points', { ascending: false })
    .limit(100);

  return (data ?? []).map((m, i) => ({
    rank: i + 1,
    id: m.id,
    auth_id: m.auth_id,
    name: m.name ?? 'Member',
    points: m.points ?? 0,
  }));
}

async function fetchByEvents(sb: SB, sinceIso: string): Promise<LeaderEntry[]> {
  const { data: events } = await sb
    .from('point_events')
    .select('member_id, points')
    .gte('created_at', sinceIso);

  if (!events?.length) return [];

  const totals: Record<string, number> = {};
  events.forEach(e => { totals[e.member_id] = (totals[e.member_id] ?? 0) + e.points; });

  const memberIds = Object.keys(totals);
  const { data: members } = await sb
    .from('members')
    .select('id, name, auth_id')
    .in('id', memberIds);

  return (members ?? [])
    .map(m => ({ id: m.id, auth_id: m.auth_id, name: m.name ?? 'Member', points: totals[m.id] ?? 0 }))
    .filter(m => m.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

async function fetchThisMonth(sb: SB): Promise<LeaderEntry[]> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return fetchByEvents(sb, since);
}

async function fetchThisCycle(sb: SB): Promise<LeaderEntry[]> {
  const now = new Date();
  const m = now.getMonth();
  const qm = m >= 9 ? 9 : m >= 6 ? 6 : m >= 3 ? 3 : 0;
  const since = new Date(now.getFullYear(), qm, 1).toISOString();
  return fetchByEvents(sb, since);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const router = useRouter();
  const [tab, setTab]                     = useState<Tab>('month');
  const [entries, setEntries]             = useState<LeaderEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [authUser, setAuthUser]           = useState<{ id: string } | null>(null);
  const [currentMember, setCurrentMember] = useState<LeaderEntry | null>(null);

  // ── One-time auth + onboarding guard ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: meRow } = await sb
        .from('members')
        .select('onboarding_complete')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (!meRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      setAuthUser(user);
    })();
  }, [router]);

  // ── Fetch leaderboard — re-runs whenever tab or authUser changes ──────────────
  useEffect(() => {
    if (!authUser) return;

    const sb = createClient();
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      let data: LeaderEntry[] = [];
      if (tab === 'month')      data = await fetchThisMonth(sb);
      else if (tab === 'cycle') data = await fetchThisCycle(sb);
      else                      data = await fetchAllTime(sb);

      if (cancelled) return;
      setEntries(data);

      // Always fetch real member row so the bar never shows stale or 0 points
      const { data: realMember } = await sb
        .from('members')
        .select('id, name, auth_id, points')
        .eq('auth_id', authUser.id)
        .single();

      if (!realMember || cancelled) return;

      const found = data.find(e => e.auth_id === authUser.id);

      setCurrentMember({
        rank: found?.rank ?? data.length + 1,
        id: realMember.id,
        auth_id: authUser.id,
        name: realMember.name ?? '',
        // Period pts when in this period's list; real total otherwise
        points: found ? found.points : (realMember.points ?? 0),
      });

      if (!cancelled) setLoading(false);
    };

    load();

    // Real-time: re-fetch when any member's points update
    const channel = sb
      .channel('leaderboard')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members' },
          () => { if (!cancelled) load(); })
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [tab, authUser]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const top3      = entries.slice(0, 3);
  const rest      = entries.slice(3);
  const isEmpty   = entries.length === 0;
  const meInList    = rest.some(e => e.auth_id === authUser?.id);
  const showBar     = !meInList;
  const periodLabel = tab === 'month' ? 'month' : tab === 'cycle' ? 'cycle' : '';
  // True when user has points in the current period (bar shows period pts + label)
  const meInPeriod  = entries.some(e => e.auth_id === authUser?.id);
  const barSuffix   = (tab !== 'alltime' && meInPeriod) ? ` this ${periodLabel}` : '';

  // ── Tab strip (shared between skeleton and main render) ───────────────────────
  const TabStrip = () => (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 24 }}>
      {(['month', 'cycle', 'alltime'] as const).map(p => (
        <button
          key={p}
          onClick={() => setTab(p)}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 9,
            fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: tab === p ? 'var(--navy)' : 'transparent',
            color: tab === p ? '#fff' : 'var(--muted)',
            transition: 'background .15s, color .15s',
          }}
        >
          {p === 'month' ? 'This Month' : p === 'cycle' ? 'This Cycle' : 'All-time'}
        </button>
      ))}
    </div>
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="member-page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Leaderboard</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Grow together</div>
        </div>
        <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <TabStrip />
            {/* Podium skeleton */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 24 }}>
              {[90, 120, 70].map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', marginBottom: -20 }} />
                  <div style={{ width: '100%', height: h, borderRadius: '8px 8px 0 0', background: 'var(--surface-2)' }} />
                </div>
              ))}
            </div>
            {/* List skeleton */}
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 12, background: 'var(--surface-2)', marginBottom: 6 }} />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="member-page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Sticky header */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Leaderboard</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Grow together</div>
      </div>

      {/* Scrollable body */}
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px 32px' }}>

          <TabStrip />

          {isEmpty ? (
            /* ── Empty state ── */
            <div style={{ textAlign: 'center', padding: '52px 24px 36px' }}>
              <div style={{ fontSize: 52, marginBottom: 14, opacity: .45 }}>🏆</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                No points earned yet{periodLabel ? ` this ${periodLabel}` : ''}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 22 }}>
                Start completing goals and attending sessions to appear here!
              </div>
              <button
                onClick={() => router.push('/member/goals')}
                style={{ padding: '11px 26px', borderRadius: 10, background: 'var(--navy)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                + Set a goal
              </button>
            </div>
          ) : (
            <>
              {/* ── PODIUM ── */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
                {PODIUM_ORDER.map((rankIdx, col) => {
                  const m     = top3[rankIdx];
                  const color = BAR_COLORS[rankIdx];
                  const barH  = BAR_HEIGHTS[rankIdx];
                  const isYou = m?.auth_id === authUser?.id;

                  if (!m) return <div key={`gap-${col}`} style={{ flex: 1 }} />;

                  return (
                    <div key={m.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {/* Medal */}
                      <div style={{ fontSize: 22, marginBottom: 5, lineHeight: 1 }}>{MEDALS[rankIdx]}</div>
                      {/* Avatar (overlaps bar top via -20px margin) */}
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                        background: color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 16, letterSpacing: '.01em',
                        marginBottom: -20, position: 'relative', zIndex: 1,
                        boxShadow: rankIdx === 0 ? '0 4px 16px rgba(30,42,82,.4)' : '0 2px 8px rgba(0,0,0,.16)',
                        outline: isYou ? '2.5px solid #fff' : 'none',
                        outlineOffset: isYou ? '2px' : '0',
                      }}>
                        {getInitials(m.name)}
                      </div>
                      {/* Bar */}
                      <div style={{ width: '100%', height: barH, background: color, opacity: rankIdx === 0 ? 1 : 0.82, borderRadius: '8px 8px 0 0' }} />
                      {/* Name */}
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 7, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingInline: 4 }}>
                        {m.name.split(' ')[0]}{isYou && <span style={{ color: 'var(--navy)' }}> ★</span>}
                      </div>
                      {/* Points */}
                      <div className="tnum" style={{ fontSize: 12, fontWeight: 800, color, marginTop: 2 }}>
                        {m.points.toLocaleString()} pts
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── RANKED LIST (#4 onwards) ── */}
              {rest.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {rest.map(m => {
                    const isYou = m.auth_id === authUser?.id;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', borderRadius: 12,
                          background: isYou ? 'rgba(30,42,82,.06)' : 'var(--surface)',
                          border: `1px solid ${isYou ? 'rgba(30,42,82,.22)' : 'var(--line)'}`,
                          borderLeft: isYou ? '3px solid #1e2a52' : undefined,
                        }}
                      >
                        <span className="tnum" style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', width: 26, textAlign: 'right', flexShrink: 0 }}>
                          #{m.rank}
                        </span>
                        <Avatar name={m.name} size={36} tone={isYou ? 'navy' : 'grey'} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: isYou ? 800 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.name}
                          </span>
                          {isYou && (
                            <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--navy)', color: '#fff', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
                              You
                            </span>
                          )}
                        </div>
                        <span className="tnum" style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}>
                          {m.points.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Privacy note */}
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Icon name="lock" size={12} color="var(--faint)" />
                <span>Members choose to appear here. Only name and points are shown.</span>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Pinned "You" bar (when not visible in #4+ list) ── */}
      {currentMember && showBar && (
        <div style={{ flexShrink: 0, padding: '6px 14px 8px', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, background: 'var(--navy)', color: '#fff', boxShadow: '0 -2px 16px rgba(30,42,82,.15)' }}>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 800, width: 30, textAlign: 'center', flexShrink: 0 }}>
              #{currentMember.rank}
            </span>
            <Avatar name={currentMember.name} size={34} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>You · {currentMember.name.split(' ')[0]}</div>
            </div>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>
              {currentMember.points.toLocaleString()} pts{barSuffix}
            </span>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
