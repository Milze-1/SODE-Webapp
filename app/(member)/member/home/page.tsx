'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Icon, PILLARS, pillarOf } from '@/components/sode/icons';
import {
  Avatar, PillarChip, ProgressRing, ProgressBar, StatusPill,
  PointsBadge, SectionHead, Sheet, Toast, Celebrate,
  Field, TextInput, OptionChips, EmptyState,
} from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';
import { awardPoints } from '@/lib/points';
import { usePoints } from '@/lib/hooks/useRealtimeData';
import { getCached, setCached, invalidateCache } from '@/lib/home-cache';

// ─── Local types ──────────────────────────────────────────────────────────────

type PillarKey = 'spiritual' | 'career' | 'business' | 'character';
type GoalStatus = 'ontrack' | 'atrisk' | 'behind' | 'done';

interface Goal {
  id: string;
  pillar: PillarKey;
  title: string;
  current: number;
  target: number;
  unit: string;
  due: string;
  status: GoalStatus;
  milestones: { t: string; done: boolean }[];
}

interface ToastPayload { msg: string; icon?: string; points?: number; kind?: string; }
interface CelebratePayload {
  title: string; sub: string; points?: number;
  secondary?: { label: string; icon: string; onClick: () => void };
}
interface SheetState { type: 'win' | 'newGoal' | 'goalDetail'; goal?: Goal; }
interface SessionRow { title: string; location: string | null; scheduled_at: string; }
interface GoalRow { id: string; pillar: string; title: string; current: number | null; target: number | null; unit: string | null; due_date: string | null; status: string | null; milestones: { t: string; done: boolean }[] | null; }
interface WinRow { id: string; pillar: string | null; win_type: string | null; description: string | null; created_at: string; points_earned: number; }
interface ContentRow { id: string; title: string; content_type: string; author: string | null; pillar: string | null; }
interface PairingRow { id: string; mentor: { id: string; name: string; pillar: string | null } | null; }

interface HomeCache {
  member: { id: string; name: string; points: number };
  goals: Goal[];
  wins: WinRow[];
  rank: number;
  nextSession: SessionRow | null;
  content: ContentRow | null;
  pairing: PairingRow | null;
  devotionRef: string | null;
  devotionDone: boolean;
  liveSession: { id: string; title: string } | null;
  liveCheckedInAt: string | null;
}

const CONTENT_TYPE_ICON: Record<string, string> = { article: 'list', video: 'camera', podcast: 'message', book: 'bookopen', course: 'sparkles' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const fmtDate = (s: string | null): string => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
};

const fmtSession = (s: string): string => {
  const d = new Date(s);
  return (
    d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
};

const cycleMonth = (): number => {
  const now = new Date();
  const start = new Date('2026-01-01');
  const m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
  return Math.max(1, Math.min(12, m));
};

const parseDue = (s: string): string => {
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const [mon, day] = s.split(' ');
  return `2026-${months[mon] ?? '12'}-${(day ?? '31').padStart(2, '0')}`;
};

// ─── Win types / Goal templates ───────────────────────────────────────────────

const WIN_TYPES = [
  { value: 'milestone', label: 'Hit a milestone', icon: 'flag' },
  { value: 'progress', label: 'Made progress', icon: 'trendingup' },
  { value: 'skill', label: 'Learned a skill', icon: 'bookopen' },
  { value: 'helped', label: 'Helped someone', icon: 'heart' },
  { value: 'prayer', label: 'Answered prayer', icon: 'sprout' },
  { value: 'other', label: 'Something else', icon: 'star' },
];

const GOAL_TEMPLATES: Record<PillarKey, { t: string; target: number; unit: string }[]> = {
  spiritual: [
    { t: 'Daily devotion streak', target: 30, unit: 'days' },
    { t: 'Read 2 Christian books', target: 2, unit: 'books' },
    { t: 'Join a prayer cell', target: 8, unit: 'sessions' },
  ],
  career: [
    { t: 'Earn a professional certification', target: 5, unit: 'modules' },
    { t: 'Refresh CV & LinkedIn', target: 3, unit: 'steps' },
    { t: 'Apply to target roles', target: 10, unit: 'roles' },
  ],
  business: [
    { t: 'Register the business', target: 4, unit: 'steps' },
    { t: 'Land first paying customers', target: 3, unit: 'customers' },
    { t: 'Reach revenue milestone', target: 12, unit: 'weeks' },
  ],
  character: [
    { t: 'Mentor a younger member', target: 6, unit: 'sessions' },
    { t: 'Serve in a department', target: 12, unit: 'weeks' },
    { t: '30-day integrity challenge', target: 30, unit: 'days' },
  ],
};

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ value, max, unit, onChange }: { value: number; max: number; unit: string; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(0, Math.min(max, v)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
      <button onClick={() => set(value - 1)} style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="minus" size={20} stroke={2.4} />
      </button>
      <div style={{ textAlign: 'center', minWidth: 96 }}>
        <div className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>
          {value}<span style={{ fontSize: 18, color: 'var(--faint)', fontWeight: 600 }}> / {max}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{unit}</div>
      </div>
      <button onClick={() => set(value + 1)} style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={20} stroke={2.4} color="#fff" />
      </button>
    </div>
  );
}

// ─── GoalMini ─────────────────────────────────────────────────────────────────

function GoalMini({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const p = pillarOf(goal.pillar);
  const pct = goal.target > 0 ? goal.current / goal.target : 0;
  return (
    <button onClick={onClick} className="card" style={{ width: 158, flex: 'none', textAlign: 'left', padding: 14, scrollSnapAlign: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <ProgressRing value={pct} size={44} stroke={5} color={p.color}>
          <span style={{ color: p.color, display: 'flex' }}><Icon name={p.icon} size={18} stroke={2.2} /></span>
        </ProgressRing>
        <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 11, lineHeight: 1.25, letterSpacing: '-.01em' }}>{goal.title}</div>
      <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 5 }}>
        {goal.current}/{goal.target} {goal.unit} · {goal.due}
      </div>
    </button>
  );
}

// ─── WinFlow ─────────────────────────────────────────────────────────────────

interface WinFlowProps {
  memberId: string;
  onClose: () => void;
  onPoints: (n: number) => void;
  onToast: (t: ToastPayload) => void;
  onCelebrate: (d: CelebratePayload) => void;
  onAdded: (w: WinRow) => void;
}

function WinFlow({ memberId, onClose, onPoints, onToast, onCelebrate, onAdded }: WinFlowProps) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<string | null>(null);
  const [pillar, setPillar] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const total = 3;
  const canNext = step === 0 ? !!type : step === 1 ? !!pillar : desc.trim().length > 2;

  const submit = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: newWin, error } = await supabase
        .from('wins')
        .insert({ member_id: memberId, pillar, win_type: type, description: desc, points_earned: 5 })
        .select('id,created_at')
        .single();
      if (error) throw error;
      const awarded = await awardPoints(memberId, 'win_submitted', 'wins', newWin.id);
      onAdded({ id: newWin.id, pillar, win_type: type, description: desc, created_at: newWin.created_at, points_earned: awarded || 5 });
      onPoints(awarded || 5);
      onClose();
      onToast({ msg: 'Logged. Well done.', points: 5 });
      setTimeout(() => onCelebrate({ title: 'Logged. Well done.', sub: 'Your win is shared with the room — small seeds, real harvest.', points: 5 }), 350);
    } catch {
      onToast({ msg: 'Could not save — try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Share a win</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="clock" size={13} /> ~60 sec
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)', transition: 'background .2s ease' }} />
        ))}
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
              const sel = pillar === p.key;
              return (
                <button key={p.key} onClick={() => setPillar(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: 'var(--sh-sm)' }}>
                    <Icon name={p.icon} size={20} stroke={2.1} />
                  </div>
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
          <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
            <button onClick={() => onToast({ msg: 'Camera ready (demo)' })} className="btn btn-outline btn-sm" style={{ flex: 1 }}><Icon name="camera" size={17} /> Photo</button>
            <button onClick={() => onToast({ msg: 'Add a link (demo)' })} className="btn btn-outline btn-sm" style={{ flex: 1 }}><Icon name="link" size={16} /> Link</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ flex: '0 0 auto', paddingLeft: 16, paddingRight: 16 }}>
            <Icon name="arrowleft" size={18} />
          </button>
        )}
        {step < total - 1
          ? <button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={submit} disabled={!canNext || busy} className="btn btn-primary btn-block">
              <Icon name="sparkles" size={18} stroke={2.2} color="#fff" /> Share win · +5
            </button>
        }
      </div>
    </div>
  );
}

// ─── NewGoalFlow ──────────────────────────────────────────────────────────────

interface NewGoalFlowProps {
  memberId: string;
  onClose: () => void;
  onAdded: (g: Goal) => void;
  onToast: (t: ToastPayload) => void;
}

function NewGoalFlow({ memberId, onClose, onAdded, onToast }: NewGoalFlowProps) {
  const [step, setStep] = useState(0);
  const [pillar, setPillar] = useState<PillarKey | null>(null);
  const [tpl, setTpl] = useState<{ t: string; target: number; unit: string } | null>(null);
  const [target, setTarget] = useState(10);
  const [unit, setUnit] = useState('days');
  const [due, setDue] = useState('Aug 31');
  const [busy, setBusy] = useState(false);

  const pickTpl = (t: { t: string; target: number; unit: string }) => { setTpl(t); setTarget(t.target); setUnit(t.unit); };

  const submit = async () => {
    if (!pillar || !tpl) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('goals').insert({
        member_id: memberId, pillar, title: tpl.t,
        current: 0, target, unit, due_date: parseDue(due), status: 'ontrack',
      }).select('id').single();
      if (error) throw error;
      onAdded({ id: data.id, pillar, title: tpl.t, current: 0, target, unit, due, status: 'ontrack', milestones: [] });
      onClose();
      onToast({ msg: "Goal set. Let's start the climb.", icon: 'flag' });
    } catch {
      onToast({ msg: 'Could not save goal — try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 4 }}>New goal</h2>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Choose a pillar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PILLARS.map(p => {
              const sel = pillar === p.key;
              return (
                <button key={p.key} onClick={() => setPillar(p.key as PillarKey)} style={{ padding: '16px 12px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, margin: '0 auto', borderRadius: 13, background: '#fff', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}>
                    <Icon name={p.icon} size={22} stroke={2.1} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 9 }}>{p.short}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step === 1 && pillar && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Pick a template</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>Laddered from your team&apos;s pillar goals.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {GOAL_TEMPLATES[pillar].map((t, i) => {
              const sel = tpl?.t === t.t;
              return (
                <button key={i} onClick={() => pickTpl(t)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.t}</div>
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{t.target} {t.unit}</div>
                  </div>
                  {sel && <Icon name="check" size={20} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
            <button onClick={() => pickTpl({ t: 'Custom goal', target: 10, unit: 'steps' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1.5px dashed var(--line-2)', color: 'var(--navy)', fontWeight: 700, fontSize: 14 }}>
              <Icon name="pencil" size={17} /> Write my own
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Set the target</div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <Stepper value={target} max={Math.max(50, target)} unit={unit} onChange={setTarget} />
          </div>
          <Field label="Due date">
            <OptionChips options={['Jun 30', 'Aug 31', 'Sep 30', 'Dec 31']} value={due} onChange={v => setDue(v as string)} />
          </Field>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ paddingLeft: 16, paddingRight: 16 }}>
            <Icon name="arrowleft" size={18} />
          </button>
        )}
        {step < 2
          ? <button onClick={() => setStep(s => s + 1)} disabled={step === 0 ? !pillar : !tpl} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={submit} disabled={busy} className="btn btn-primary btn-block">
              <Icon name="flag" size={17} color="#fff" /> Set this goal
            </button>
        }
      </div>
    </div>
  );
}

// ─── GoalDetail ───────────────────────────────────────────────────────────────

interface GoalDetailProps {
  goal: Goal;
  goals: Goal[];
  memberId: string;
  onGoalsChange: (gs: Goal[]) => void;
  onClose: () => void;
  onPoints: (n: number) => void;
  onToast: (t: ToastPayload) => void;
  onCelebrate: (d: CelebratePayload) => void;
  onOpenWin: () => void;
}

function GoalDetail({ goal, goals, memberId, onGoalsChange, onClose, onPoints, onToast, onCelebrate, onOpenWin }: GoalDetailProps) {
  const live = goals.find(g => g.id === goal.id) ?? goal;
  const p = pillarOf(live.pillar);
  const pct = live.target > 0 ? live.current / live.target : 0;

  const setCurrent = (v: number) => {
    onGoalsChange(goals.map(g =>
      g.id === live.id ? { ...g, current: v, status: (v >= g.target ? 'done' : g.status) as GoalStatus } : g
    ));
  };

  const toggleMs = (i: number) => {
    onGoalsChange(goals.map(g =>
      g.id === live.id ? { ...g, milestones: g.milestones.map((m, j) => j === i ? { ...m, done: !m.done } : m) } : g
    ));
  };

  const saveProgress = async () => {
    try {
      const supabase = createClient();
      await supabase.from('goals').update({ current: live.current, updated_at: new Date().toISOString() }).eq('id', live.id);
      const awarded = await awardPoints(memberId, 'goal_progress', 'goals', live.id);
      onPoints(awarded || 2);
      onClose();
      onToast({ msg: `Progress saved${awarded ? ` · +${awarded} pts` : ''}`, icon: 'check', points: awarded || 2 });
    } catch {
      onToast({ msg: 'Could not save — try again.' });
    }
  };

  const complete = async () => {
    try {
      const supabase = createClient();
      await supabase.from('goals').update({ current: live.target, status: 'done', updated_at: new Date().toISOString() }).eq('id', live.id);
      const awarded = await awardPoints(memberId, 'goal_completed', 'goals', live.id);
      onGoalsChange(goals.map(g => g.id === live.id ? { ...g, current: g.target, status: 'done' } : g));
      onPoints(awarded || 20);
      onClose();
      setTimeout(() => onCelebrate({
        title: 'Goal complete!', sub: p.verse, points: 20,
        secondary: { label: 'Share it as a win', icon: 'sparkles', onClick: onOpenWin },
      }), 350);
    } catch {
      onToast({ msg: 'Could not save — try again.' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <ProgressRing value={pct} size={72} stroke={7} color={p.color}>
          <span className="tnum" style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(pct * 100)}%</span>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PillarChip pillar={live.pillar} size="sm" />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', marginTop: 7, lineHeight: 1.2 }}>{live.title}</div>
          <div style={{ marginTop: 6 }}><StatusPill status={live.status} size="sm" /></div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 14, textAlign: 'center' }}>Update your progress</div>
        <Stepper value={live.current} max={live.target} unit={live.unit} onChange={setCurrent} />
      </div>

      {live.milestones.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>Milestones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {live.milestones.map((m, i) => (
              <button key={i} onClick={() => toggleMs(i)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', textAlign: 'left' }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', border: m.done ? 'none' : '1.5px solid var(--line-2)', background: m.done ? 'var(--navy)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.done && <Icon name="check" size={15} stroke={3} color="#fff" />}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: m.done ? 'var(--faint)' : 'var(--ink)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.t}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5, padding: '0 2px 16px' }}>{p.verse}</div>

      <div style={{ display: 'flex', gap: 10 }}>
        {live.status !== 'done' && (
          <button onClick={saveProgress} className="btn btn-ghost" style={{ flex: 1 }}>Save · +2</button>
        )}
        <button onClick={complete} disabled={live.status === 'done'} className="btn btn-primary" style={{ flex: 1.5 }}>
          {live.status === 'done'
            ? <><Icon name="check" size={19} stroke={2.6} color="#fff" /> Completed</>
            : <><Icon name="flag" size={18} color="#fff" /> Mark complete</>}
        </button>
      </div>
    </div>
  );
}

// ─── DeskGoalCard ─────────────────────────────────────────────────────────────

function DeskGoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const p = pillarOf(goal.pillar);
  const pct = goal.target > 0 ? goal.current / goal.target : 0;
  return (
    <button onClick={onClick} className="card card-pad" style={{ textAlign: 'left', display: 'block', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PillarChip pillar={goal.pillar} size="sm" />
          <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 7, lineHeight: 1.25 }}>{goal.title}</div>
        </div>
        <StatusPill status={goal.status} size="sm" />
      </div>
      <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}><ProgressBar value={pct} color={p.color} /></div>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{goal.current}/{goal.target}</span>
      </div>
      <div className="tnum" style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon name="calendarclock" size={12} /> Due {goal.due}
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // data
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<{ id: string; name: string; points: number } | null>(null);
  const { balance: liveBalance } = usePoints(member?.id ?? '');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wins, setWins] = useState<WinRow[]>([]);
  const [rank, setRank] = useState(0);
  const [nextSession, setNextSession] = useState<SessionRow | null>(null);
  const [content, setContent] = useState<ContentRow | null>(null);
  const [pairing, setPairing] = useState<PairingRow | null>(null);
  const [devotionRef, setDevotionRef] = useState<string | null>(null);
  const [devotionDone, setDevotionDone] = useState(false);

  // ui state
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [celebrate, setCelebrate] = useState<CelebratePayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeCacheKey = useRef<string | null>(null);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const addPoints = (n: number) => {
    setMember(m => m ? { ...m, points: m.points + n } : m);
    if (homeCacheKey.current) invalidateCache(homeCacheKey.current);
  };

  const [liveSession, setLiveSession] = useState<{ id: string; title: string } | null>(null);
  const [liveCheckedInAt, setLiveCheckedInAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const cacheKey = `home-${user.id}`;
      homeCacheKey.current = cacheKey;
      const cached = getCached<HomeCache>(cacheKey);
      if (cached) {
        setMember(cached.member);
        setGoals(cached.goals);
        setWins(cached.wins);
        setRank(cached.rank);
        setNextSession(cached.nextSession);
        setContent(cached.content);
        setPairing(cached.pairing);
        setDevotionRef(cached.devotionRef);
        setDevotionDone(cached.devotionDone);
        setLiveSession(cached.liveSession);
        setLiveCheckedInAt(cached.liveCheckedInAt);
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const currentMonth = new Date().getMonth() + 1;

      // RT2: everything that doesn't need member PK or member.points.
      // goals, wins, attendance_records have RLS policies using auth_member_id() —
      // no explicit member_id filter required; Supabase applies it server-side.
      const [
        memberRes, sessionRes, monthlyContentRes, fallbackContentRes, liveSessionRes,
        goalsRes, winsRes, attendanceRes,
      ] = await Promise.all([
        supabase.from('members').select('id,name,points,onboarding_complete').eq('auth_id', user.id).maybeSingle(),
        supabase.from('sessions').select('title,location,scheduled_at').gt('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('learning_content').select('id,title,content_type,author,pillar').eq('is_published', true).eq('month_number', currentMonth).order('created_at', { ascending: false }).limit(1),
        supabase.from('learning_content').select('id,title,content_type,author,pillar').eq('is_published', true).is('month_number', null).order('created_at', { ascending: false }).limit(1),
        supabase.from('sessions').select('id,title').eq('is_live', true).maybeSingle(),
        supabase.from('goals').select('id,pillar,title,current,target,unit,due_date,status').neq('status', 'done').order('created_at', { ascending: true }),
        supabase.from('wins').select('id,pillar,win_type,description,created_at,points_earned').order('created_at', { ascending: false }).limit(10),
        supabase.from('attendance_records').select('session_id,checked_in_at').order('checked_in_at', { ascending: false }).limit(5),
      ]);

      const memberRow = memberRes.data;
      if (!memberRow) { router.replace('/member/onboarding'); return; }
      if (!memberRow.onboarding_complete) { router.replace('/member/onboarding'); return; }

      const member = { id: memberRow.id, name: memberRow.name, points: memberRow.points ?? 0 };
      setMember(member);

      const mappedGoals: Goal[] = (goalsRes.data as GoalRow[] ?? []).map((g) => ({
        id: g.id,
        pillar: g.pillar as PillarKey,
        title: g.title,
        current: g.current ?? 0,
        target: g.target ?? 1,
        unit: g.unit ?? '',
        due: fmtDate(g.due_date),
        status: (g.status ?? 'ontrack') as GoalStatus,
        milestones: [],
      }));
      setGoals(mappedGoals);

      setNextSession(sessionRes.data ?? null);
      const mappedWins = (winsRes.data ?? []) as WinRow[];
      setWins(mappedWins);

      const monthlyArr = (monthlyContentRes.data ?? []) as ContentRow[];
      const fallbackArr = (fallbackContentRes.data ?? []) as ContentRow[];
      const featured = monthlyArr[0] ?? fallbackArr[0] ?? null;
      setContent(featured);

      const liveSessionData = liveSessionRes.data ?? null;
      setLiveSession(liveSessionData);

      // Find this user's check-in for the live session from the RLS-filtered batch
      const liveId = liveSessionData?.id ?? null;
      const checkinRow = ((attendanceRes.data ?? []) as { session_id: string; checked_in_at: string }[]).find(r => r.session_id === liveId);
      const checkedInAt = checkinRow?.checked_in_at ?? null;
      setLiveCheckedInAt(checkedInAt);

      // Page is renderable now — show it while RT3 loads rank + member-specific data
      setLoading(false);

      // RT3: queries that genuinely need memberRow.id or memberRow.points
      const [rankRes, pairingRes, devotionPlanRes, devotionJournalRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).gt('points', memberRow.points ?? 0),
        supabase.from('mentor_pairings').select('id,mentor:mentor_id(id,name,pillar)').eq('mentee_id', memberRow.id).eq('status', 'active').maybeSingle(),
        supabase.from('bible_reading_plans').select('start_date,start_book,chapters_per_day,testament,end_book').eq('member_id', memberRow.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('devotion_journal').select('checklist').eq('member_id', memberRow.id).eq('entry_date', today).maybeSingle(),
      ]);

      const computedRank = (rankRes.count ?? 0) + 1;
      setRank(computedRank);
      const computedPairing = (pairingRes.data ?? null) as unknown as PairingRow | null;
      setPairing(computedPairing);

      let computedDevotionRef: string | null = null;
      if (devotionPlanRes.data) {
        const brp = devotionPlanRes.data as { start_date: string; start_book: string; chapters_per_day: number; testament: string; end_book: string };
        try {
          const { getDayPassage: gdp, getDayNumber: gdn } = await import('@/lib/bible-structure');
          const dn = gdn(brp.start_date);
          const p = gdp(brp as Parameters<typeof gdp>[0], dn);
          if (p) { computedDevotionRef = p.displayText; setDevotionRef(p.displayText); }
        } catch { /* optional enhancement */ }
      }

      let computedDevotionDone = false;
      if (devotionJournalRes.data) {
        const cl = (devotionJournalRes.data as { checklist: { read: boolean; prayed: boolean; reflected: boolean } | null }).checklist;
        computedDevotionDone = !!(cl?.read && cl?.prayed && cl?.reflected);
        setDevotionDone(computedDevotionDone);
      }

      setCached(cacheKey, {
        member,
        goals: mappedGoals,
        wins: mappedWins,
        rank: computedRank,
        nextSession: sessionRes.data ?? null,
        content: featured,
        pairing: computedPairing,
        devotionRef: computedDevotionRef,
        devotionDone: computedDevotionDone,
        liveSession: liveSessionData,
        liveCheckedInAt: checkedInAt,
      });
    })();
  }, [router]);

  useEffect(() => {
    if (!member) return;
    const supabase = createClient();

    const refreshLive = async () => {
      const { data: live } = await supabase.from('sessions').select('id,title').eq('is_live', true).maybeSingle();
      setLiveSession(live ?? null);
      if (live) {
        const { data: rec } = await supabase
          .from('attendance_records')
          .select('checked_in_at')
          .eq('session_id', live.id)
          .eq('member_id', member.id)
          .maybeSingle();
        setLiveCheckedInAt(rec?.checked_in_at ?? null);
      } else {
        setLiveCheckedInAt(null);
      }
    };

    const channel = supabase.channel('member-home-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, refreshLive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, refreshLive)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [member?.id]);

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[88, 66, 132, 80, 80].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    );
  }

  const month = cycleMonth();

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {liveSession && (
        liveCheckedInAt ? (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#1f7a4f', color: '#fff' }}>
            <Icon name="check" size={18} stroke={2.6} color="#fff" />
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
              Checked in · {new Date(liveCheckedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ) : (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--navy)', color: '#fff' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', flex: 'none', animation: 'sode-pulse 1.4s ease-in-out infinite' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>Live now</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liveSession.title}</div>
            </div>
            <button
              onClick={() => router.push('/member/attendance')}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', color: 'var(--navy)', fontWeight: 700, fontSize: 13, padding: '9px 13px', borderRadius: 999 }}
            >
              Check in now <Icon name="arrowupright" size={14} stroke={2.4} color="var(--navy)" />
            </button>
          </div>
        )
      )}
      {/* ── Mobile layout ── */}
      <div className="md:hidden flex flex-col" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>

        {/* sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px 11px' }}>
            <Avatar name={member?.name ?? ''} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>{greeting()},</div>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.1 }}>
                {member?.name?.split(' ')[0] ?? ''}
              </div>
            </div>
            <PointsBadge value={liveBalance?.total_points ?? member?.points ?? 0} onClick={() => router.push('/member/leaderboard')} />
          </div>
        </div>

        <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* cycle + rank card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: '15px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>2026 Growth Cycle</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>Month {month} of 12 — keep going</div>
              </div>
              <ProgressRing value={month / 12} size={46} stroke={5} color="#fff" track="rgba(255,255,255,.22)">
                <span className="tnum" style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{month}/12</span>
              </ProgressRing>
            </div>
            <button onClick={() => router.push('/member/leaderboard')} style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="trophy" size={20} stroke={2.1} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>You&apos;re #{rank} this month</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Keep climbing</div>
              </div>
              <Icon name="chevronright" size={20} color="var(--faint)" />
            </button>
          </div>

          {/* win nudge */}
          <button onClick={() => setSheet({ type: 'win' })} style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-ink) 100%)', color: '#fff', padding: '17px 18px', boxShadow: 'var(--sh-md)' }}>
            <div style={{ position: 'absolute', right: -18, bottom: -22, opacity: .14 }}>
              <Icon name="sprout" size={120} stroke={1.5} color="#fff" />
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-.01em' }}>Something good happened?</div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.72)', marginTop: 3 }}>Share it — about 60 seconds.</div>
              </div>
              <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: 'var(--navy)', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', borderRadius: 999 }}>
                <Icon name="sparkles" size={16} stroke={2.2} color="var(--navy)" /> Share a win
              </div>
            </div>
          </button>

          {/* quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { icon: 'mappin', label: 'Check in', href: '/member/attendance' },
              { icon: 'list', label: 'Forms', href: '/member/forms' },
              { icon: 'userplus', label: 'Invite', href: '/member/invite' },
              { icon: 'share', label: 'Share', href: '/member/share' },
            ].map((a, i) => (
              <button key={i} onClick={() => router.push(a.href)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '13px 4px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}>
                  <Icon name={a.icon} size={19} stroke={2.1} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
          </div>

          {/* goals rail */}
          <div>
            <SectionHead title="My goals" action="View all" onAction={() => router.push('/member/goals')} />
            <div className="noscroll" style={{ display: 'flex', gap: 11, overflowX: 'auto', margin: '0 -16px', padding: '2px 16px 4px', scrollSnapType: 'x mandatory' }}>
              {goals.map(g => (
                <GoalMini key={g.id} goal={g} onClick={() => setSheet({ type: 'goalDetail', goal: g })} />
              ))}
              <button onClick={() => setSheet({ type: 'newGoal' })} style={{ width: 132, flex: 'none', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-2)', background: 'var(--surface)', color: 'var(--navy)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, minHeight: 128 }}>
                <Icon name="pluscircle" size={26} stroke={2} /> New goal
              </button>
            </div>
          </div>

          {/* devotion reminder */}
          <button onClick={() => router.push('/member/devotion')} className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', width: '100%' }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: devotionDone ? '#d1fae5' : 'var(--navy-tint)', color: devotionDone ? '#065f46' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name={devotionDone ? 'check' : 'bookopen'} size={22} stroke={devotionDone ? 2.6 : 2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{devotionDone ? 'Devotion done today' : 'Daily devotion'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                {devotionRef ? (devotionDone ? `Completed · ${devotionRef}` : `Today: ${devotionRef}`) : 'Build a daily reading habit'}
              </div>
            </div>
            <Icon name="chevronright" size={20} color="var(--faint)" />
          </button>

          {/* next up */}
          {nextSession && (
            <div>
              <SectionHead title="Next up" />
              <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name="calendarclock" size={23} stroke={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{nextSession.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="mappin" size={13} />
                    {fmtSession(nextSession.scheduled_at)}{nextSession.location ? ` · ${nextSession.location}` : ''}
                  </div>
                </div>
                <button onClick={() => router.push('/member/attendance')} className="btn btn-primary btn-sm" style={{ flex: 'none' }}>Check in</button>
              </div>
            </div>
          )}

          {/* reading */}
          <div>
            <SectionHead title="This month's reading" action="Learn" onAction={() => router.push('/member/learning')} />
            {content ? (
              <button onClick={() => router.push(`/member/learning/${content.id}`)} className="card card-pad" style={{ display: 'flex', gap: 13, textAlign: 'left', width: '100%' }}>
                <div style={{ width: 46, height: 60, borderRadius: 8, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'flex-end', padding: 7, flex: 'none' }}>
                  <Icon name={CONTENT_TYPE_ICON[content.content_type] ?? 'bookopen'} size={20} stroke={2} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {content.pillar && <PillarChip pillar={content.pillar} size="sm" />}
                  <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 7, lineHeight: 1.25 }}>{content.title}</div>
                  {content.author && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{content.author}</div>}
                </div>
              </button>
            ) : (
              <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
                No reading scheduled for this month yet.
              </div>
            )}
          </div>

          {/* mentor */}
          <div>
            <SectionHead title="Your mentor" action="Open" onAction={() => router.push('/member/mentorship')} />
            {pairing?.mentor ? (
              <button onClick={() => router.push('/member/mentorship')} className="card card-pad" style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={pairing.mentor.name} size={44} tone="soft" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{pairing.mentor.name}</div>
                  {pairing.mentor.pillar && <div style={{ marginTop: 4 }}><PillarChip pillar={pairing.mentor.pillar} size="sm" /></div>}
                </div>
                <Icon name="chevronright" size={20} color="var(--faint)" />
              </button>
            ) : (
              <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
                Mentor coming soon — our team is matching you based on your goals.
              </div>
            )}
          </div>

          {/* wins feed */}
          <div>
            <SectionHead title="Your wins" action="Forms" onAction={() => router.push('/member/forms')} />
            {wins.length === 0 ? (
              <EmptyState
                icon="sparkles"
                title="No wins yet"
                body="Share your first one — small seeds, real harvest."
                cta="Share a win"
                onCta={() => setSheet({ type: 'win' })}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {wins.map(w => {
                  const p = w.pillar ? pillarOf(w.pillar) : pillarOf('spiritual');
                  const typeLabel = WIN_TYPES.find(t => t.value === w.win_type)?.label ?? w.win_type ?? 'Win';
                  const typeIcon = WIN_TYPES.find(t => t.value === w.win_type)?.icon ?? 'sparkles';
                  return (
                    <div key={w.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 13px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
                        <Icon name={typeIcon} size={17} stroke={2.2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: p.color, letterSpacing: '.01em' }}>{typeLabel}</div>
                        {w.description && (
                          <div style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink)', marginTop: 2 }}>{w.description}</div>
                        )}
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--navy)', fontWeight: 700 }}>
                            <Icon name="zap" size={12} /> +{w.points_earned}
                          </span>
                        </div>
                      </div>
                      <span style={{ color: p.color, flex: 'none', marginTop: 2 }}><Icon name={p.icon} size={16} stroke={2} /></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* invite nudge */}
          <button onClick={() => router.push('/member/invite')} className="card" style={{ textAlign: 'left', padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name="userplus" size={22} stroke={2.1} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Bring someone into the room</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>Know someone who&apos;d thrive here? Invite them.</div>
            </div>
            <Icon name="chevronright" size={20} color="var(--faint)" />
          </button>
        </div>
      </div>

      <BottomNav />
      </div>{/* end mobile wrapper */}

      {/* ── Desktop layout ── */}
      <div className="hidden md:block member-scroll" style={{ flex: 1 }}>
        <div style={{ padding: '28px 32px 40px' }}>

          {/* greeting */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>
                {greeting()}, {member?.name?.split(' ')[0] ?? ''}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
                Month {month} of 12 — here&apos;s you this cycle.
              </p>
            </div>
            <PointsBadge value={liveBalance?.total_points ?? member?.points ?? 0} onClick={() => router.push('/member/leaderboard')} />
          </div>

          {/* three stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Cycle ring */}
            <div className="card card-pad" style={{ background: 'var(--navy)', border: 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
              <ProgressRing value={month / 12} size={56} stroke={6} color="#fff" track="rgba(255,255,255,.22)">
                <span className="tnum" style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{month}/12</span>
              </ProgressRing>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase' }}>2026 Cycle</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 3 }}>On pace</div>
              </div>
            </div>
            {/* Rank */}
            <button onClick={() => router.push('/member/leaderboard')} className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="trophy" size={24} stroke={2} />
              </div>
              <div>
                <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>#{rank}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Keep climbing</div>
              </div>
            </button>
            {/* Share a win */}
            <button onClick={() => setSheet({ type: 'win' })} className="card card-pad" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-ink) 100%)', border: 'none' }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="sparkles" size={24} color="#fff" stroke={2} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff' }}>Share a win</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)' }}>Something good happened?</div>
              </div>
            </button>
          </div>

          {/* two-col grid: goals left, panels right */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Left: goals */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>My goals</h3>
                <button onClick={() => router.push('/member/goals')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>View all →</button>
              </div>
              <div style={{ padding: 18 }}>
                {goals.length === 0 ? (
                  <EmptyState icon="target" title="No goals yet" body="Set your first goal and start climbing." cta="Set a goal" onCta={() => setSheet({ type: 'newGoal' })} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {goals.slice(0, 4).map(g => (
                      <DeskGoalCard key={g.id} goal={g} onClick={() => setSheet({ type: 'goalDetail', goal: g })} />
                    ))}
                    {goals.length < 4 && (
                      <button onClick={() => setSheet({ type: 'newGoal' })} style={{ borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-2)', background: 'var(--surface)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, minHeight: 90, padding: 14 }}>
                        <Icon name="pluscircle" size={20} /> New goal
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: next session + reading + mentor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {nextSession && (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Next up</h3>
                  </div>
                  <div style={{ padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-2)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name="calendarclock" size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>{nextSession.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{fmtSession(nextSession.scheduled_at)}</div>
                      </div>
                    </div>
                    <button onClick={() => router.push('/member/attendance')} className="btn btn-primary btn-block btn-sm">Check in</button>
                  </div>
                </div>
              )}

              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>This month&apos;s reading</h3>
                </div>
                <div style={{ padding: 18 }}>
                  {content ? (
                    <button onClick={() => router.push(`/member/learning/${content.id}`)} style={{ textAlign: 'left', width: '100%' }}>
                      {content.pillar && <PillarChip pillar={content.pillar} size="sm" />}
                      <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 8, lineHeight: 1.3 }}>{content.title}</div>
                      {content.author && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4, fontStyle: 'italic' }}>{content.author}</div>}
                    </button>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>No reading scheduled for this month yet.</div>
                  )}
                </div>
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>Your mentor</h3>
                </div>
                <div style={{ padding: 18 }}>
                  {pairing?.mentor ? (
                    <button onClick={() => router.push('/member/mentorship')} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left' }}>
                      <Avatar name={pairing.mentor.name} size={38} tone="soft" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pairing.mentor.name}</div>
                        {pairing.mentor.pillar && <div style={{ marginTop: 3 }}><PillarChip pillar={pairing.mentor.pillar} size="sm" /></div>}
                      </div>
                      <Icon name="chevronright" size={18} color="var(--faint)" />
                    </button>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>Mentor coming soon.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>{/* end desktop wrapper */}

      {/* sheets — positioned inside the relative container */}
      <Sheet open={sheet?.type === 'win'} onClose={() => setSheet(null)}>
        {member && (
          <WinFlow
            memberId={member.id}
            onClose={() => setSheet(null)}
            onPoints={addPoints}
            onToast={showToast}
            onCelebrate={d => setCelebrate(d)}
            onAdded={w => setWins(ws => [w, ...ws])}
          />
        )}
      </Sheet>

      <Sheet open={sheet?.type === 'newGoal'} onClose={() => setSheet(null)}>
        {member && (
          <NewGoalFlow
            memberId={member.id}
            onClose={() => setSheet(null)}
            onAdded={g => setGoals(gs => [...gs, g])}
            onToast={showToast}
          />
        )}
      </Sheet>

      <Sheet open={sheet?.type === 'goalDetail'} onClose={() => setSheet(null)} title="Goal">
        {sheet?.type === 'goalDetail' && sheet.goal && member && (
          <GoalDetail
            goal={sheet.goal}
            goals={goals}
            memberId={member.id}
            onGoalsChange={setGoals}
            onClose={() => setSheet(null)}
            onPoints={addPoints}
            onToast={showToast}
            onCelebrate={d => setCelebrate(d)}
            onOpenWin={() => setSheet({ type: 'win' })}
          />
        )}
      </Sheet>

      <Toast toast={toast} />
      <Celebrate data={celebrate} onClose={() => setCelebrate(null)} />
    </div>
  );
}
