'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Icon } from '@/components/sode/icons';
import { Toast, EmptyState, ProgressBar } from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';
import {
  type BibleReadingPlanRow,
  getDayPassage,
  getDayNumber,
  getTotalDays,
  getPlanProgress,
  OLD_TESTAMENT,
  NEW_TESTAMENT,
  ALL_BOOKS,
} from '@/lib/bible-structure';
import { generatePrayerPrompt, generateReflectionQuestions } from '@/lib/devotion-prompts';
import { bibleGatewayUrl } from '@/lib/bible-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  member_id: string;
  entry_date: string;
  reading_ref: string | null;
  reflection: string | null;
  prayer_notes: string | null;
  key_insight: string | null;
  checklist: { read: boolean; prayed: boolean; reflected: boolean };
  mood: string | null;
  created_at: string;
}

interface ToastPayload { msg: string; icon?: string; points?: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function calcStreakFromDates(dates: string[]): number {
  const sorted = Array.from(new Set(dates)).sort().reverse();
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  for (const d of sorted) {
    const day = new Date(d + 'T00:00:00');
    const diff = Math.round((cursor.getTime() - day.getTime()) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = day; } else break;
  }
  return streak;
}

// ─── Reading plan setup ───────────────────────────────────────────────────────

function PlanSetup({ memberId, onCreated, onToast }: {
  memberId: string;
  onCreated: (plan: BibleReadingPlanRow) => void;
  onToast: (t: ToastPayload) => void;
}) {
  const [step, setStep]           = useState(0);
  const [testament, setTestament] = useState<'new' | 'old' | 'both'>('new');
  const [startBook, setStartBook] = useState('Matthew');
  const [cpd, setCpd]             = useState(1);
  const [saving, setSaving]       = useState(false);

  const pool = testament === 'new' ? NEW_TESTAMENT : testament === 'old' ? OLD_TESTAMENT : ALL_BOOKS;

  const handleTestament = (t: 'new' | 'old' | 'both') => {
    setTestament(t);
    setStartBook(t === 'new' ? 'Matthew' : t === 'old' ? 'Genesis' : 'Genesis');
  };

  const create = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const lastBook = pool[pool.length - 1].name;
      const startIdx = pool.findIndex(b => b.name === startBook);
      const endBook = pool.slice(startIdx).at(-1)?.name ?? lastBook;
      const { data, error } = await supabase
        .from('bible_reading_plans')
        .insert({
          member_id: memberId,
          testament,
          start_book: startBook,
          end_book: endBook,
          chapters_per_day: cpd,
          start_date: todayStr(),
        })
        .select()
        .single();
      if (error) throw error;
      onCreated(data as BibleReadingPlanRow);
      onToast({ msg: 'Reading plan started!', icon: 'bookopen', points: 5 });
    } catch {
      onToast({ msg: 'Could not create plan — try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 16px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Icon name="bookopen" size={28} stroke={1.8} color="#fff" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.01em' }}>Start your reading plan</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5 }}>Build a daily Bible reading habit</div>
      </div>

      {/* progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Which testament?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {([['new', 'New Testament', 'Matthew – Revelation', '27 books · 260 chapters'], ['old', 'Old Testament', 'Genesis – Malachi', '39 books · 929 chapters'], ['both', 'Whole Bible', 'Genesis – Revelation', '66 books · 1,189 chapters']] as const).map(([v, label, range, note]) => {
              const sel = testament === v;
              return (
                <button key={v} onClick={() => handleTestament(v)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: sel ? 'var(--navy)' : 'var(--ink)' }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{range}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 1 }}>{note}</div>
                  </div>
                  {sel && <Icon name="check" size={18} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Where would you like to start?</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>You&apos;ll read through to the end of the {testament === 'new' ? 'New Testament' : testament === 'old' ? 'Old Testament' : 'Bible'}.</div>
          <div className="noscroll" style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pool.map(b => {
              const sel = startBook === b.name;
              return (
                <button key={b.name} onClick={() => setStartBook(b.name)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 9, background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: sel ? 700 : 500, color: sel ? 'var(--navy)' : 'var(--ink)' }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.chapters} ch.</div>
                  {sel && <Icon name="check" size={16} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Chapters per day</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>One chapter takes about 5 minutes to read.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {([1, 2, 3, 5] as const).map(n => {
              const mins = n * 5;
              const sel = cpd === n;
              return (
                <button key={n} onClick={() => setCpd(n)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: sel ? 'var(--navy)' : 'var(--ink)' }}>{n} chapter{n > 1 ? 's' : ''} / day</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>~{mins} minutes</div>
                  </div>
                  {sel && <Icon name="check" size={18} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ paddingLeft: 16, paddingRight: 16 }}>
            <Icon name="arrowleft" size={18} />
          </button>
        )}
        {step < 2
          ? <button onClick={() => setStep(s => s + 1)} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={create} disabled={saving} className="btn btn-primary btn-block"><Icon name="bookopen" size={17} color="#fff" /> Start plan</button>
        }
      </div>
    </div>
  );
}

// ─── Calendar dot ─────────────────────────────────────────────────────────────

function CalendarGrid({ entries, today }: { entries: JournalEntry[]; today: string }) {
  const doneSet = new Set(entries.filter(e => e.checklist?.read || e.checklist?.reflected).map(e => e.entry_date));
  const days: { date: string; label: string; done: boolean; isToday: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const s = d.toISOString().slice(0, 10);
    days.push({ date: s, label: d.getDate().toString(), done: doneSet.has(s), isToday: s === today });
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
      {days.map(d => (
        <div key={d.date} title={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: d.isToday ? 800 : 500, background: d.done ? '#d1fae5' : d.isToday ? 'var(--navy-tint)' : 'transparent', color: d.done ? '#065f46' : d.isToday ? 'var(--navy)' : 'var(--faint)', border: d.isToday ? '1.5px solid var(--navy)' : 'none' }}>
            {d.label}
          </div>
          {d.done && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a' }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DevotionPage() {
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [member, setMember]     = useState<{ id: string; points: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'plan'>('today');

  // Reading plan
  const [plan, setPlan]               = useState<BibleReadingPlanRow | null>(null);
  const [showSetup, setShowSetup]     = useState(false);
  const [dayNumber, setDayNumber]     = useState(1);

  // Bible text
  const [bibleText, setBibleText]     = useState<string | null>(null);
  const [bibleRef, setBibleRef]       = useState<string | null>(null);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [bibleExpanded, setBibleExpanded] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  // Today's journal
  const [journalId, setJournalId]     = useState<string | null>(null);
  const [checklist, setChecklist]     = useState({ read: false, prayed: false, reflected: false });
  const [reflection, setReflection]   = useState('');
  const [keyInsight, setKeyInsight]   = useState('');
  const [prayerNotes, setPrayerNotes] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [journaledPoints, setJournaledPoints] = useState(false);

  // History
  const [history, setHistory]         = useState<JournalEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Derived
  const passage = plan ? getDayPassage(plan, dayNumber) : null;
  const prayerPrompt = passage ? generatePrayerPrompt(passage.displayText) : '';
  const reflectionQs = passage ? generateReflectionQuestions(passage.displayText) : [];
  const streak = calcStreakFromDates(history.map(e => e.entry_date));
  const allDone = checklist.read && checklist.prayed && checklist.reflected;

  const [toast, setToast]             = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // ── Fetch member + plan ───────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: memberRow } = await supabase
        .from('members')
        .select('id, points, onboarding_complete')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMember({ id: memberRow.id, points: memberRow.points ?? 0 });

      // Load reading plan
      const { data: planRow } = await supabase
        .from('bible_reading_plans')
        .select('*')
        .eq('member_id', memberRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planRow) {
        const brp = planRow as BibleReadingPlanRow;
        setPlan(brp);
        const dn = getDayNumber(brp.start_date);
        setDayNumber(dn);

        // Load today's journal entry
        const today = todayStr();
        const { data: entry } = await supabase
          .from('devotion_journal')
          .select('*')
          .eq('member_id', memberRow.id)
          .eq('entry_date', today)
          .maybeSingle();

        if (entry) {
          const je = entry as JournalEntry;
          setJournalId(je.id);
          setChecklist(je.checklist ?? { read: false, prayed: false, reflected: false });
          setReflection(je.reflection ?? '');
          setKeyInsight(je.key_insight ?? '');
          setPrayerNotes(je.prayer_notes ?? '');
          if (je.checklist?.reflected) setJournaledPoints(true);
        }
      }

      setLoading(false);
    })();
  }, [router]);

  // ── Fetch Bible text when plan/day changes ────────────────────────────────

  useEffect(() => {
    if (!passage) return;
    setBibleLoading(true);
    setBibleText(null);
    setBibleRef(null);
    setFallbackUrl(null);
    fetch(`/api/bible/passage?q=${encodeURIComponent(passage.apiQuery)}`)
      .then(r => r.json())
      .then(data => {
        if (data.fallbackUrl) {
          setFallbackUrl(data.fallbackUrl as string);
        } else if (data.text) {
          setBibleText((data.text as string).trim());
          setBibleRef(data.reference as string ?? passage.displayText);
        }
      })
      .catch(() => setFallbackUrl(bibleGatewayUrl(passage.apiQuery)))
      .finally(() => setBibleLoading(false));
  }, [passage?.apiQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load history when History tab opens ───────────────────────────────────

  const loadHistory = async () => {
    if (historyLoaded || !member) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('devotion_journal')
      .select('*')
      .eq('member_id', member.id)
      .order('entry_date', { ascending: false })
      .limit(60);
    setHistory((data ?? []) as JournalEntry[]);
    setHistoryLoaded(true);
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Journal save/update helpers ───────────────────────────────────────────

  const ensureJournal = async (): Promise<string | null> => {
    if (journalId) return journalId;
    if (!member || !passage) return null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('devotion_journal')
      .insert({
        member_id: member.id,
        entry_date: todayStr(),
        reading_ref: passage.displayText,
        checklist: { read: false, prayed: false, reflected: false },
      })
      .select('id')
      .single();
    if (error || !data) return null;
    setJournalId(data.id);
    return data.id;
  };

  const markRead = async () => {
    if (checklist.read || !member) return;
    const id = await ensureJournal();
    if (!id) return;
    const supabase = createClient();
    const newChecklist = { ...checklist, read: true };
    await supabase.from('devotion_journal').update({ checklist: newChecklist, reading_ref: passage?.displayText ?? null }).eq('id', id);
    setChecklist(newChecklist);
    const pts = await awardPoints(member.id, 'devotion_read', 'devotion_journal', id);
    showToast({ msg: `+${pts || 3} pts — reading done!`, icon: 'bookopen', points: pts || 3 });
    setMember(m => m ? { ...m, points: m.points + (pts || 3) } : m);
    // Check for full-day bonus
    if (newChecklist.prayed && newChecklist.reflected) {
      const bonus = await awardPoints(member.id, 'devotion_full_day', 'devotion_journal', id);
      if (bonus) showToast({ msg: `+${bonus} bonus — devotion complete!`, icon: 'sparkles', points: bonus });
    }
    setHistory(h => h.map(e => e.id === id ? { ...e, checklist: newChecklist } : e));
  };

  const markPrayed = async () => {
    if (checklist.prayed || !member) return;
    const id = await ensureJournal();
    if (!id) return;
    const supabase = createClient();
    const newChecklist = { ...checklist, prayed: true };
    await supabase.from('devotion_journal').update({ checklist: newChecklist, prayer_notes: prayerNotes || null }).eq('id', id);
    setChecklist(newChecklist);
    const pts = await awardPoints(member.id, 'devotion_prayed', 'devotion_journal', id);
    showToast({ msg: `+${pts || 3} pts — prayer done!`, icon: 'heart', points: pts || 3 });
    setMember(m => m ? { ...m, points: m.points + (pts || 3) } : m);
    if (newChecklist.read && newChecklist.reflected) {
      const bonus = await awardPoints(member.id, 'devotion_full_day', 'devotion_journal', id);
      if (bonus) showToast({ msg: `+${bonus} bonus — devotion complete!`, icon: 'sparkles', points: bonus });
    }
    setHistory(h => h.map(e => e.id === id ? { ...e, checklist: newChecklist } : e));
  };

  const saveJournal = async () => {
    if (!member || savingJournal) return;
    setSavingJournal(true);
    try {
      const id = await ensureJournal();
      if (!id) return;
      const supabase = createClient();
      const newChecklist = { ...checklist, reflected: true };
      await supabase.from('devotion_journal').update({
        reflection: reflection.trim() || null,
        key_insight: keyInsight.trim() || null,
        checklist: newChecklist,
      }).eq('id', id);
      setChecklist(newChecklist);
      if (!journaledPoints) {
        const pts = await awardPoints(member.id, 'devotion_journal', 'devotion_journal', id);
        showToast({ msg: `+${pts || 4} pts — reflection saved!`, icon: 'pencil', points: pts || 4 });
        setMember(m => m ? { ...m, points: m.points + (pts || 4) } : m);
        setJournaledPoints(true);
        if (newChecklist.read && newChecklist.prayed) {
          const bonus = await awardPoints(member.id, 'devotion_full_day', 'devotion_journal', id);
          if (bonus) showToast({ msg: `+${bonus} bonus — devotion complete!`, icon: 'sparkles', points: bonus });
        }
      } else {
        showToast({ msg: 'Reflection saved', icon: 'check' });
      }
      setHistory(h => h.map(e => e.id === id ? { ...e, checklist: newChecklist, reflection, key_insight: keyInsight } : e));
    } finally {
      setSavingJournal(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[66, 120, 88, 88].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
        </div>
      </div>
    );
  }

  // ── Setup flow ───────────────────────────────────────────────────────────

  if (showSetup && member) {
    return (
      <div className="member-page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 0' }}>
            <button onClick={() => setShowSetup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Icon name="arrowleft" size={22} />
            </button>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Reading plan setup</div>
          </div>
          <PlanSetup
            memberId={member.id}
            onCreated={(p) => { setPlan(p); setDayNumber(1); setShowSetup(false); }}
            onToast={showToast}
          />
        </div>
        <BottomNav />
        <Toast toast={toast} />
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 0' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Devotion</div>
            {streak > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="zap" size={13} color="#f59e0b" /> {streak}-day streak
              </div>
            )}
          </div>
          {plan && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Day</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{dayNumber}</div>
            </div>
          )}
        </div>

        {/* Tab row */}
        <div style={{ display: 'flex', gap: 0, padding: '8px 16px 0' }}>
          {(['today', 'history', 'plan'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, paddingBottom: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: activeTab === t ? 800 : 500, color: activeTab === t ? 'var(--navy)' : 'var(--muted)', borderBottom: activeTab === t ? '2.5px solid var(--navy)' : '2.5px solid transparent', textTransform: 'capitalize' }}>
              {t === 'today' ? 'Today' : t === 'history' ? 'History' : 'My Plan'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── TODAY TAB ── */}
        {activeTab === 'today' && (
          <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {!plan ? (
              <EmptyState
                icon="bookopen"
                title="No reading plan yet"
                body="Start a daily Bible reading plan and build a devotion habit."
                cta="Start a reading plan"
                onCta={() => setShowSetup(true)}
              />
            ) : !passage ? (
              <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 16px' }}>
                <Icon name="check" size={32} stroke={2} color="#16a34a" />
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 10, color: '#065f46' }}>Reading plan complete!</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>You&apos;ve read through all assigned chapters. Start a new plan below.</div>
                <button onClick={() => setShowSetup(true)} className="btn btn-primary" style={{ marginTop: 16 }}>Start new plan</button>
              </div>
            ) : (
              <>
                {/* ── Progress bar ── */}
                {(() => {
                  const prog = getPlanProgress(plan, dayNumber);
                  return (
                    <div className="card card-pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                          Day {dayNumber} of {prog.totalDays}
                        </div>
                        <ProgressBar value={prog.pct} color="var(--navy)" />
                      </div>
                      <div className="tnum" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, flex: 'none' }}>
                        {Math.round(prog.pct * 100)}%
                      </div>
                    </div>
                  );
                })()}

                {/* ── Bible reading card ── */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#7c3aed20', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon name="bookopen" size={21} stroke={2} color="#7c3aed" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>Today&apos;s reading</div>
                      <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-.01em', marginTop: 2 }}>{passage.displayText}</div>
                    </div>
                    {checklist.read && (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name="check" size={14} stroke={2.8} color="#065f46" />
                      </div>
                    )}
                  </div>

                  {/* Bible text */}
                  <div style={{ padding: '12px 16px' }}>
                    {bibleLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13.5 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--line-2)', borderTopColor: 'var(--navy)', animation: 'spin 0.7s linear infinite' }} />
                        Loading passage…
                      </div>
                    )}
                    {fallbackUrl && !bibleLoading && (
                      <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="arrowupright" size={14} /> Open on Bible Gateway
                      </a>
                    )}
                    {bibleText && !bibleLoading && (
                      <div>
                        <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ink)', maxHeight: bibleExpanded ? 'none' : 180, overflow: 'hidden', maskImage: bibleExpanded ? 'none' : 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: bibleExpanded ? 'none' : 'linear-gradient(to bottom, black 60%, transparent 100%)' }}>
                          {bibleText}
                        </div>
                        <button onClick={() => setBibleExpanded(v => !v)} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--navy)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Icon name={bibleExpanded ? 'chevronup' : 'chevrondown'} size={15} color="var(--navy)" />
                          {bibleExpanded ? 'Show less' : 'Read full passage'}
                        </button>
                        {bibleRef && (
                          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>{bibleRef} · World English Bible (WEB)</div>
                        )}
                      </div>
                    )}
                  </div>

                  {!checklist.read && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <button onClick={markRead} className="btn btn-primary btn-block">
                        <Icon name="check" size={17} color="#fff" /> Mark reading done · +3 pts
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Prayer card ── */}
                <div className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#2563eb18', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon name="heart" size={21} stroke={2} color="#2563eb" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>Prayer</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>Pray through the passage</div>
                    </div>
                    {checklist.prayed && (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name="check" size={14} stroke={2.8} color="#065f46" />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 9, marginBottom: 12 }}>
                    &ldquo;{prayerPrompt}&rdquo;
                  </div>
                  <textarea
                    value={prayerNotes}
                    onChange={e => setPrayerNotes(e.target.value)}
                    placeholder="Add your prayer notes… (optional)"
                    disabled={checklist.prayed}
                    rows={3}
                    style={{ width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box', color: 'var(--ink)', marginBottom: 10 }}
                  />
                  {!checklist.prayed && (
                    <button onClick={markPrayed} className="btn btn-primary btn-block">
                      <Icon name="heart" size={17} color="#fff" /> Mark prayer done · +3 pts
                    </button>
                  )}
                </div>

                {/* ── Journal / reflection card ── */}
                <div className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#16a34a18', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon name="pencil" size={21} stroke={2} color="#16a34a" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>Journal</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>Reflect and respond</div>
                    </div>
                    {checklist.reflected && (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name="check" size={14} stroke={2.8} color="#065f46" />
                      </div>
                    )}
                  </div>

                  {reflectionQs.map((q, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 800, color: 'var(--navy)', flex: 'none' }}>{i + 1}.</span>
                      <span>{q}</span>
                    </div>
                  ))}

                  <textarea
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                    placeholder="Write your reflection here…"
                    rows={4}
                    style={{ width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box', color: 'var(--ink)', marginTop: 12, marginBottom: 10 }}
                  />

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>Key insight</div>
                    <input
                      type="text"
                      value={keyInsight}
                      onChange={e => setKeyInsight(e.target.value)}
                      placeholder="One sentence takeaway…"
                      style={{ width: '100%', height: 42, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box', color: 'var(--ink)' }}
                    />
                  </div>

                  <button
                    onClick={saveJournal}
                    disabled={savingJournal || (!reflection.trim() && !keyInsight.trim())}
                    className="btn btn-primary btn-block"
                  >
                    <Icon name="pencil" size={17} color="#fff" />
                    {checklist.reflected ? 'Update reflection' : 'Save reflection · +4 pts'}
                  </button>
                </div>

                {/* ── All done banner ── */}
                {allDone && (
                  <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', borderRadius: 'var(--r-md)', padding: '20px 18px', textAlign: 'center', color: '#fff' }}>
                    <Icon name="sparkles" size={28} stroke={1.8} color="#fff" />
                    <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>Devotion complete!</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>You&apos;ve read, prayed, and reflected. Keep this streak going.</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Last 30 days</div>
                {streak > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                    <Icon name="zap" size={14} color="#f59e0b" /> {streak} day streak
                  </div>
                )}
              </div>
              <CalendarGrid entries={history} today={todayStr()} />
            </div>

            {history.length === 0 ? (
              <EmptyState icon="pencil" title="No entries yet" body="Complete your first devotion to see your history here." />
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 9 }}>Recent entries</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {history.slice(0, 20).map(e => {
                    const done = (e.checklist?.read ? 1 : 0) + (e.checklist?.prayed ? 1 : 0) + (e.checklist?.reflected ? 1 : 0);
                    return (
                      <div key={e.id} className="card card-pad">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: done === 3 ? '#d1fae5' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            {done === 3
                              ? <Icon name="check" size={18} stroke={2.6} color="#065f46" />
                              : <Icon name="bookopen" size={18} stroke={2} color="var(--muted)" />
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{e.reading_ref ?? 'No passage recorded'}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{fmtDate(e.entry_date)}</div>
                            {e.key_insight && (
                              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>&ldquo;{e.key_insight}&rdquo;</div>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>{done}/3</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MY PLAN TAB ── */}
        {activeTab === 'plan' && (
          <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!plan ? (
              <EmptyState
                icon="bookopen"
                title="No reading plan yet"
                body="Set up a reading plan to track your daily Bible reading."
                cta="Start a reading plan"
                onCta={() => setShowSetup(true)}
              />
            ) : (
              <>
                {/* Plan summary */}
                <div className="card card-pad">
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 10 }}>Your reading plan</div>
                  {[
                    ['Testament', plan.testament === 'new' ? 'New Testament' : plan.testament === 'old' ? 'Old Testament' : 'Whole Bible'],
                    ['From', plan.start_book],
                    ['To', plan.end_book],
                    ['Chapters / day', String(plan.chapters_per_day)],
                    ['Started', new Date(plan.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                {(() => {
                  const prog = getPlanProgress(plan, dayNumber);
                  const total = getTotalDays(plan);
                  return (
                    <div className="card card-pad">
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Progress</div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                        {[
                          { v: dayNumber, l: 'Current day' },
                          { v: prog.daysCompleted, l: 'Days done' },
                          { v: total - prog.daysCompleted, l: 'Days left' },
                        ].map((s, i) => (
                          <div key={i} style={{ textAlign: 'center', flex: 1, borderLeft: i > 0 ? '1px solid var(--line)' : 'none' }}>
                            <div className="tnum" style={{ fontSize: 24, fontWeight: 800 }}>{s.v}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                      <ProgressBar value={prog.pct} color="var(--navy)" />
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>{Math.round(prog.pct * 100)}% complete</div>
                    </div>
                  );
                })()}

                <button onClick={() => setShowSetup(true)} className="btn btn-ghost btn-block">
                  <Icon name="pencil" size={16} /> Start a new plan
                </button>
              </>
            )}
          </div>
        )}

      </div>

      <BottomNav />
      <Toast toast={toast} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
