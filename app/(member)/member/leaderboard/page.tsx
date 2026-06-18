'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, Segmented } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

interface BoardEntry { id: string; name: string; points: number; isYou: boolean; }

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [you, setYou] = useState<{ rank: number; pts: number; name: string } | null>(null);
  const [season, setSeason] = useState('month');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, name, points, onboarding_complete, leaderboard_opt_in').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const { data: members } = await supabase
        .from('members')
        .select('id, name, points, leaderboard_opt_in')
        .eq('leaderboard_opt_in', true)
        .eq('onboarding_complete', true)
        .order('points', { ascending: false })
        .limit(50);

      const entries = ((members ?? []) as { id: string; name: string; points: number }[]).map((m, i) => ({
        id: m.id, name: m.name ?? 'Member', points: m.points ?? 0, isYou: m.id === memberRow.id, rank: i + 1,
      }));

      const youRank = entries.findIndex(e => e.isYou) + 1;

      setBoard(entries.map(e => ({ id: e.id, name: e.name, points: e.points, isYou: e.isYou })));
      setYou({
        rank: youRank > 0 ? youRank : entries.length + 1,
        pts: memberRow.points ?? 0,
        name: (memberRow.name ?? '').split(' ')[0],
      });

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[140, 56, 64, 64, 64].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  const order = [1, 0, 2]; // podium: 2nd, 1st, 3rd
  const heights: Record<number, number> = { 0: 92, 1: 66, 2: 52 };

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: you ? 80 : 0 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Leaderboard</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Grow together</div>
        </div>

        <div style={{ padding: '14px 16px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <Segmented
              options={[{ value: 'month', label: 'This Month' }, { value: 'cycle', label: 'This Cycle' }, { value: 'all', label: 'All-time' }]}
              value={season} onChange={setSeason} size="sm"
            />
          </div>

          {board.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>No one on the board yet</div>
              <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 6 }}>Start earning points to appear here.</div>
            </div>
          ) : (
            <>
              {top3.length >= 3 && (
                <div className="card" style={{ padding: '16px 12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, padding: '8px 4px 0' }}>
                    {order.map(i => {
                      const m = top3[i];
                      if (!m) return null;
                      const first = i === 0;
                      return (
                        <div key={i} style={{ flex: 1, maxWidth: 110, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Avatar name={m.name} size={first ? 64 : 50} tone={first ? 'navy' : 'soft'} style={first ? { boxShadow: '0 0 0 3px var(--navy), 0 6px 18px rgba(20,29,58,.22)' } : {}} />
                            <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 22, height: 22, borderRadius: '50%', background: first ? 'var(--navy)' : '#fff', color: first ? '#fff' : 'var(--ink)', border: first ? 'none' : '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, marginTop: 4, maxWidth: 96, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name.split(' ')[0]}</div>
                          <div className="tnum" style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>{m.points}</div>
                          <div style={{ width: '100%', height: heights[i], borderRadius: '10px 10px 0 0', marginTop: 8, background: first ? 'var(--navy)' : 'var(--surface-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
                            {first && <Icon name="trophy" size={22} color="rgba(255,255,255,.85)" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rest.map((m, i) => (
                  <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: m.isYou ? 'var(--navy-tint)' : undefined, border: m.isYou ? '1px solid var(--navy)' : undefined }}>
                    <span className="tnum" style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', width: 22, textAlign: 'center' }}>{i + 4}</span>
                    <Avatar name={m.name} size={36} tone={m.isYou ? 'navy' : 'grey'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}{m.isYou ? ' (you)' : ''}</div>
                    </div>
                    <span className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>{m.points}</span>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Icon name="lock" size={13} /> Members choose to appear here. Only name and points are shown.
              </div>
            </>
          )}
        </div>
      </div>

      {you && (
        <div className="member-leaderboard-bar" style={{ position: 'absolute', bottom: 56, left: 0, right: 0, zIndex: 10, padding: '0 14px 8px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'var(--navy)', color: '#fff', boxShadow: 'var(--sh-pop)' }}>
            <span className="tnum" style={{ fontSize: 15, fontWeight: 800, width: 30, textAlign: 'center' }}>#{you.rank}</span>
            <Avatar name={you.name} size={34} style={{ boxShadow: '0 0 0 2px rgba(255,255,255,.3)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>You · {you.name}</div>
            </div>
            <span className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>{you.pts}</span>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
