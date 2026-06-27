'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Icon } from '@/components/sode/icons';
import BottomNav from '@/components/member/bottom-nav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyDevotional {
  id: string;
  devotional_date: string;
  title: string;
  scripture_ref: string;
  scripture_text: string;
  body: string;
  prayer_focus: string;
  key_declaration: string;
}

interface ChecklistState {
  prayed_30: boolean;
  made_declarations: boolean;
  studied_bible: boolean;
  read_devotional: boolean;
  made_key_declaration: boolean;
}

interface DevotionCheckin {
  id: string;
  member_id: string;
  entry_date: string;
  checklist: ChecklistState | null;
  journal_entry: string | null;
  completed: boolean;
  points_awarded: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatTodayLong() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function calcStreak(checkins: { entry_date: string; completed: boolean }[]): number {
  const completedDates = new Set(checkins.filter(c => c.completed).map(c => c.entry_date));
  const sorted = Array.from(completedDates).sort().reverse();
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  for (const d of sorted) {
    const day = new Date(d + 'T00:00:00');
    const diff = Math.round((cursor.getTime() - day.getTime()) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = day; } else break;
  }
  return streak;
}

const EMPTY_CHECKLIST: ChecklistState = {
  prayed_30: false,
  made_declarations: false,
  studied_bible: false,
  read_devotional: false,
  made_key_declaration: false,
};

// ─── Mon–Sun week calendar ────────────────────────────────────────────────────

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function StreakCalendar({ checkins }: { checkins: { entry_date: string; completed: boolean }[] }) {
  const completedSet = new Set(checkins.filter(c => c.completed).map(c => c.entry_date));

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const today = todayDate.toISOString().slice(0, 10);

  // Monday of current week (ISO: Mon=1 … Sun=0 wraps to −6)
  const dow = todayDate.getDay();
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - (dow === 0 ? 6 : dow - 1));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday  = dateStr === today;
    const isPast   = dateStr < today;
    const done     = completedSet.has(dateStr);
    return { dateStr, letter: DAY_LETTERS[i], done, isToday, isPast };
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {days.map((d, i) => {
          const isUpcoming = !d.isToday && !d.isPast;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? 'var(--navy)' : 'var(--muted)' }}>
                {d.letter}
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: d.done
                  ? 'var(--navy)'
                  : d.isToday
                    ? 'var(--navy-tint)'
                    : d.isPast
                      ? 'var(--surface-2)'
                      : 'transparent',
                border: d.done
                  ? 'none'
                  : d.isToday
                    ? '2px solid var(--navy)'
                    : isUpcoming
                      ? '1.5px dashed var(--line-2)'
                      : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: d.done ? '#fff' : d.isToday ? 'var(--navy)' : 'var(--faint)',
              }}>
                {d.done ? '✓' : d.isToday ? '•' : d.letter}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {([
          { bg: 'var(--navy)',      border: 'none',                        content: '✓', contentColor: '#fff',          label: 'Done' },
          { bg: 'var(--navy-tint)', border: '2px solid var(--navy)',        content: '•', contentColor: 'var(--navy)',   label: 'Today' },
          { bg: 'var(--surface-2)', border: 'none',                        content: 'M', contentColor: 'var(--faint)',  label: 'Missed' },
          { bg: 'transparent',      border: '1.5px dashed var(--line-2)',   content: 'M', contentColor: 'var(--faint)',  label: 'Upcoming' },
        ] as const).map((x, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: x.bg, border: x.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: x.contentColor, flex: 'none' }}>
              {x.content}
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{x.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DevotionPage() {
  const router = useRouter();

  const [loading, setLoading]             = useState(true);
  const [memberId, setMemberId]           = useState<string | null>(null);
  const [devotional, setDevotional]       = useState<DailyDevotional | null>(null);
  const [checkin, setCheckin]             = useState<DevotionCheckin | null>(null);
  const [checklist, setChecklist]         = useState<ChecklistState>(EMPTY_CHECKLIST);
  const [journal, setJournal]             = useState('');
  const [completing, setCompleting]       = useState(false);
  const [recentCheckins, setRecentCheckins] = useState<{ entry_date: string; completed: boolean }[]>([]);
  const [toast, setToast]                 = useState<{ msg: string } | null>(null);
  const toastTimer                        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today  = todayStr();
  const streak = calcStreak(recentCheckins);

  // Checklist items — read_devotional + made_key_declaration only when a devotional exists
  const baseItems = [
    { key: 'prayed_30'          as const, label: 'Prayed for 30 minutes' },
    { key: 'made_declarations'  as const, label: 'Made my declarations'   },
    { key: 'studied_bible'      as const, label: 'Studied the Bible'       },
  ];
  const extraItems = devotional ? [
    { key: 'read_devotional'      as const, label: "Read today's devotional"  },
    { key: 'made_key_declaration' as const, label: 'Made the key declaration'  },
  ] : [];
  const allItems    = [...baseItems, ...extraItems];
  const checkedCount = allItems.filter(it => checklist[it.key]).length;
  const allChecked  = checkedCount === allItems.length;
  const canComplete = checkedCount >= 3;
  const alreadyDone = checkin?.completed ?? false;

  const showToast = (msg: string) => {
    setToast({ msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Auth + data load ───────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: memberRow } = await supabase
        .from('members')
        .select('id, onboarding_complete')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMemberId(memberRow.id);

      const todayDate = new Date().toISOString().split('T')[0];
      const [devotionalRes, checkinRes, recentRes] = await Promise.all([
        supabase
          .from('daily_devotionals')
          .select('id, devotional_date, title, scripture_ref, scripture_text, body, prayer_focus, key_declaration')
          .eq('devotional_date', todayDate)
          .eq('is_published', true)
          .maybeSingle(),
        supabase
          .from('devotion_checkins')
          .select('id, member_id, entry_date, checklist, journal_entry, completed, points_awarded')
          .eq('member_id', memberRow.id)
          .eq('entry_date', today)
          .maybeSingle(),
        supabase
          .from('devotion_checkins')
          .select('entry_date, completed')
          .eq('member_id', memberRow.id)
          .not('entry_date', 'is', null)
          .order('entry_date', { ascending: false })
          .limit(35),
      ]);

      console.log('[Devotion] Today devotional:', devotionalRes.data, 'for date:', todayDate);
      setDevotional((devotionalRes.data ?? null) as DailyDevotional | null);

      if (checkinRes.data) {
        const ci = checkinRes.data as DevotionCheckin;
        setCheckin(ci);
        setChecklist((ci.checklist ?? EMPTY_CHECKLIST) as ChecklistState);
        setJournal(ci.journal_entry ?? '');
      }

      setRecentCheckins((recentRes.data ?? []) as { entry_date: string; completed: boolean }[]);
      setLoading(false);
    })();
  }, [router, today]);

  // ── Toggle checklist item ─────────────────────────────────────────────────

  const toggleItem = async (key: keyof ChecklistState) => {
    if (alreadyDone || !memberId) return;
    const newChecklist = { ...checklist, [key]: !checklist[key] };
    setChecklist(newChecklist);

    const supabase = createClient();
    if (checkin) {
      await supabase.from('devotion_checkins')
        .update({ checklist: newChecklist })
        .eq('id', checkin.id);
    } else {
      const { data: newCi } = await supabase.from('devotion_checkins')
        .insert({
          member_id: memberId,
          entry_date: today,
          checklist: newChecklist,
          completed: false,
          points_awarded: false,
        })
        .select()
        .single();
      if (newCi) setCheckin(newCi as DevotionCheckin);
    }
  };

  // ── Complete devotion ─────────────────────────────────────────────────────

  const completeDevotion = async () => {
    if (!memberId || !canComplete || completing || alreadyDone) return;
    setCompleting(true);
    try {
      const supabase = createClient();
      let checkinId = checkin?.id;

      if (checkinId) {
        await supabase.from('devotion_checkins')
          .update({ checklist, journal_entry: journal || null, completed: true, points_awarded: true })
          .eq('id', checkinId);
      } else {
        const { data: newCi } = await supabase.from('devotion_checkins')
          .insert({
            member_id: memberId,
            entry_date: today,
            checklist,
            journal_entry: journal || null,
            completed: true,
            points_awarded: true,
          })
          .select('id')
          .single();
        checkinId = (newCi as { id: string } | null)?.id;
      }

      setCheckin(c => c ? { ...c, completed: true, points_awarded: true } : {
        id: checkinId ?? '',
        member_id: memberId,
        entry_date: today,
        checklist,
        journal_entry: journal || null,
        completed: true,
        points_awarded: true,
      });

      // Award base check-in points
      let totalPts = 0;
      const base = await awardPoints(memberId, 'devotion_checkin', 'devotion_checkins', checkinId);
      totalPts += base;

      // Full-day bonus if all items checked
      if (allChecked) {
        const full = await awardPoints(memberId, 'devotion_full_day', 'devotion_checkins', checkinId);
        totalPts += full;
      }

      // Update recents for streak calc
      const updatedRecents = [
        { entry_date: today, completed: true },
        ...recentCheckins.filter(c => c.entry_date !== today),
      ];
      setRecentCheckins(updatedRecents);
      const newStreak = calcStreak(updatedRecents);

      // Streak bonuses
      if (newStreak === 7) {
        const s7 = await awardPoints(memberId, 'devotion_streak_7', 'devotion_checkins', checkinId);
        totalPts += s7;
      }
      if (newStreak === 30) {
        const s30 = await awardPoints(memberId, 'devotion_streak_30', 'devotion_checkins', checkinId);
        totalPts += s30;
      }

      const streakMsg = newStreak === 7 ? ' 🎉 7-day streak!' : newStreak === 30 ? ' 🏆 30-day streak!' : '';
      showToast(`Devotion complete! +${totalPts} pts${streakMsg}`);
    } finally {
      setCompleting(false);
    }
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[80, 220, 180, 130, 110].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)',
        padding: '14px 16px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.01em' }}>Daily Devotion</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{formatTodayLong()}</div>
          </div>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef9c3', borderRadius: 20, padding: '4px 12px', flex: 'none' }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>{streak} day streak</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Today's devotional ── */}
        {devotional ? (
          <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderRadius: 16, padding: 20, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
              📖 Today&apos;s Devotional
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e2a52', margin: '0 0 12px' }}>
              {devotional.title}
            </h2>
            {devotional.scripture_ref && (
              <p style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, margin: '0 0 4px' }}>
                {devotional.scripture_ref}
              </p>
            )}
            {devotional.scripture_text && (
              <p style={{ fontSize: 14, fontStyle: 'italic', color: '#444', background: '#fff', borderLeft: '3px solid #6366f1', padding: '8px 12px', borderRadius: '0 8px 8px 0', margin: '0 0 16px' }}>
                &ldquo;{devotional.scripture_text}&rdquo;
              </p>
            )}
            <p style={{ fontSize: 15, color: '#333', lineHeight: 1.6, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>
              {devotional.body}
            </p>
            {devotional.prayer_focus && (
              <div style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', margin: '0 0 4px' }}>🙏 PRAYER FOCUS</p>
                <p style={{ fontSize: 14, color: '#444', margin: 0 }}>{devotional.prayer_focus}</p>
              </div>
            )}
            {devotional.key_declaration && (
              <div style={{ background: '#1e2a52', borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', margin: '0 0 4px' }}>📢 TODAY&apos;S DECLARATION</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0, fontStyle: 'italic' }}>
                  &ldquo;{devotional.key_declaration}&rdquo;
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#f5f5f7', borderRadius: 16, padding: 20, marginBottom: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: '#666', margin: 0 }}>
              📖 No devotional posted for today yet. Use this time for personal Bible study and prayer.
            </p>
          </div>
        )}

        {/* ── Checklist ── */}
        <div className="card card-pad">
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Today&apos;s Checklist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {allItems.map(item => {
              const checked = checklist[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => toggleItem(item.key)}
                  disabled={alreadyDone}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10,
                    background: checked ? 'var(--navy-tint)' : 'var(--surface-2)',
                    border: `1.5px solid ${checked ? 'var(--navy)' : 'transparent'}`,
                    textAlign: 'left', cursor: alreadyDone ? 'default' : 'pointer',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flex: 'none',
                    background: checked ? 'var(--navy)' : '#fff',
                    border: checked ? 'none' : '2px solid var(--line-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <Icon name="check" size={13} stroke={2.8} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: checked ? 700 : 500, color: checked ? 'var(--navy)' : 'var(--ink)' }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
            {checkedCount} / {allItems.length} completed
          </div>
        </div>

        {/* ── Journal ── */}
        <div className="card card-pad">
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Journal Entry</div>
          <textarea
            value={journal}
            onChange={e => setJournal(e.target.value.slice(0, 500))}
            disabled={alreadyDone}
            placeholder="What did God speak to you today? What are you grateful for?"
            rows={4}
            style={{
              width: '100%', borderRadius: 10, border: '1.5px solid var(--line-2)',
              background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px',
              outline: 'none', resize: 'none', boxSizing: 'border-box', color: 'var(--ink)', lineHeight: 1.65,
            }}
          />
          <div style={{ fontSize: 11, color: journal.length > 450 ? '#ef4444' : 'var(--faint)', textAlign: 'right', marginTop: 4 }}>
            {journal.length} / 500
          </div>
        </div>

        {/* ── Complete button ── */}
        {alreadyDone ? (
          <div style={{
            background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
            borderRadius: 'var(--r-md)', padding: '18px 18px',
            display: 'flex', alignItems: 'center', gap: 12, color: '#fff',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name="check" size={22} stroke={2.5} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Devotion complete!</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>You&apos;ve finished today&apos;s devotion. See you tomorrow.</div>
            </div>
          </div>
        ) : (
          <button
            onClick={completeDevotion}
            disabled={!canComplete || completing}
            className="btn btn-primary btn-block"
            style={{ opacity: canComplete ? 1 : 0.4, fontSize: 15, fontWeight: 700, padding: '14px 0', borderRadius: 'var(--r-md)' }}
          >
            {completing
              ? 'Completing…'
              : canComplete
                ? `Complete devotion · +${allChecked ? 15 : 5} pts`
                : 'Complete devotion (3 items required)'
            }
          </button>
        )}

        {/* ── 7-day calendar ── */}
        <div className="card card-pad">
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>This Week</div>
          <StreakCalendar checkins={recentCheckins} />
        </div>

      </div>

      <BottomNav />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--navy)', color: '#fff', borderRadius: 30, padding: '10px 22px',
          fontSize: 14, fontWeight: 700, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
