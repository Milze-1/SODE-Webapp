'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Icon, PILLARS, pillarOf } from '@/components/sode/icons';
import {
  PillarChip, ProgressBar, ProgressRing, StatusPill,
  Sheet, Toast, Celebrate, Field, OptionChips, EmptyState,
} from '@/components/sode/ui';
import BottomNav from '@/components/member/bottom-nav';

type PillarKey = 'spiritual' | 'career' | 'business' | 'character';
type GoalStatus = 'ontrack' | 'atrisk' | 'behind' | 'done' | 'archived';
type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

interface CommunityGoal {
  id: string;
  title: string;
  notes: string | null;
  pillar: PillarKey;
  target: number;
  unit: string;
  due_date: string | null;
  is_mandatory: boolean;
  mcg_id: string;
  current_value: number;
  status: string;
}

interface Goal {
  id: string; pillar: PillarKey; title: string; current: number; target: number;
  unit: string; due: string; rawDue: string | null; status: GoalStatus;
  notes: string | null;
  msCompleted: number; msTotal: number;
}

interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  milestone_status: MilestoneStatus;
  deadline: string | null;
  order_index: number;
  started_at: string | null;
  completed_at: string | null;
  member_id: string | null;
}

interface MilestoneNote {
  id: string;
  step_id: string | null;
  comment: string;
  created_at: string;
}

interface ToastPayload { msg: string; icon?: string; points?: number; }
interface CelebratePayload { title: string; sub: string; points?: number; }
interface GoalRow {
  id: string; pillar: string; title: string; current: number | null;
  target: number | null; unit: string | null; due_date: string | null;
  status: string | null; notes: string | null;
}

const TODAY = new Date().toISOString().split('T')[0];

const fmtDate = (s: string | null) =>
  !s ? '' : new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtShort = (s: string | null) =>
  !s ? '' : new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return fmtShort(iso.slice(0, 10)) + ' · ' + d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const calcDaysOverdue = (deadline: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(deadline + 'T00:00:00').getTime()) / 86400000));

const calcDaysEarly = (deadline: string, completedAt: string) =>
  Math.ceil((new Date(deadline + 'T00:00:00').getTime() - new Date(completedAt).getTime()) / 86400000);

const effectiveStatus = (ms: Milestone): MilestoneStatus => {
  if (ms.milestone_status === 'completed') return 'completed';
  if (ms.deadline && ms.deadline < TODAY) return 'overdue';
  return ms.milestone_status;
};

const parseDue = (s: string): string => {
  const m: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
  const [mon, day] = s.split(' ');
  return `2026-${m[mon] ?? '12'}-${(day ?? '31').padStart(2, '0')}`;
};

const GOAL_TEMPLATES: Record<PillarKey, { t: string; target: number; unit: string }[]> = {
  spiritual: [{ t: 'Daily devotion streak', target: 30, unit: 'days' }, { t: 'Read 2 Christian books', target: 2, unit: 'books' }, { t: 'Join a prayer cell', target: 8, unit: 'sessions' }],
  career:    [{ t: 'Earn a professional certification', target: 5, unit: 'modules' }, { t: 'Refresh CV & LinkedIn', target: 3, unit: 'steps' }, { t: 'Apply to target roles', target: 10, unit: 'roles' }],
  business:  [{ t: 'Register the business', target: 4, unit: 'steps' }, { t: 'Land first paying customers', target: 3, unit: 'customers' }, { t: 'Reach revenue milestone', target: 12, unit: 'weeks' }],
  character: [{ t: 'Mentor a younger member', target: 6, unit: 'sessions' }, { t: 'Serve in a department', target: 12, unit: 'weeks' }, { t: '30-day integrity challenge', target: 30, unit: 'days' }],
};

// ── Milestone Status Icon ──────────────────────────────────────────────────────

function MilestoneIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'completed') return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name="check" size={12} stroke={2.8} color="#fff" />
    </div>
  );
  if (status === 'overdue') return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name="alertcircle" size={15} color="#c53030" />
    </div>
  );
  if (status === 'in_progress') return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--navy)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'var(--navy)' }} />
    </div>
  );
  return <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--line-2)', background: 'transparent', flex: 'none' }} />;
}

// ── Milestone Item ─────────────────────────────────────────────────────────────

function MilestoneItem({ ms, notes, onStart, onDone, onAddNote, onEdit, onDelete, onExtend }: {
  ms: Milestone;
  notes: MilestoneNote[];
  onStart: (id: string) => Promise<void>;
  onDone: (id: string) => Promise<void>;
  onAddNote: (stepId: string, comment: string) => Promise<void>;
  onEdit: (id: string, title: string, deadline: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExtend: (id: string, newDeadline: string) => Promise<void>;
}) {
  const status = effectiveStatus(ms);
  const [showNote, setShowNote]     = useState(false);
  const [noteText, setNoteText]     = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [editTitle, setEditTitle]   = useState(ms.title);
  const [editDl, setEditDl]         = useState(ms.deadline ?? '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [extendMode, setExtendMode] = useState(false);
  const [newDl, setNewDl]           = useState('');
  const [acting, setActing]         = useState(false);

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await onAddNote(ms.id, noteText.trim());
    setNoteText(''); setShowNote(false); setSavingNote(false);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editDl) return;
    setSavingEdit(true);
    await onEdit(ms.id, editTitle.trim(), editDl);
    setEditMode(false); setSavingEdit(false);
  };

  const bg = status === 'completed' ? 'var(--surface)'
    : status === 'overdue' ? '#fff5f5'
    : status === 'in_progress' ? 'var(--navy-tint)'
    : 'var(--bg)';
  const border = status === 'overdue' ? '1px solid #fed7d7'
    : status === 'in_progress' ? '1px solid var(--navy)30'
    : '1px solid var(--line-2)';

  if (editMode) return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1.5px solid var(--navy)', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Milestone title</div>
      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus
        style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Deadline</div>
      <input type="date" value={editDl} onChange={e => setEditDl(e.target.value)}
        style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => setEditMode(false)} className="btn btn-ghost btn-sm">Cancel</button>
        <button type="button" onClick={saveEdit} disabled={savingEdit || !editTitle.trim() || !editDl} className="btn btn-primary btn-sm">Save</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: bg, border, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ marginTop: 1, flex: 'none' }}><MilestoneIcon status={status} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: status === 'completed' ? 'var(--muted)' : 'var(--ink)', textDecoration: status === 'completed' ? 'line-through' : 'none' }}>
            {ms.title}
          </div>

          {status === 'completed' && ms.completed_at && (
            <div style={{ fontSize: 12, color: '#065f46', marginTop: 3 }}>
              Completed {fmtShort(ms.completed_at.slice(0, 10))}
              {ms.deadline && calcDaysEarly(ms.deadline, ms.completed_at) > 0
                ? ` · ${calcDaysEarly(ms.deadline, ms.completed_at)} day${calcDaysEarly(ms.deadline, ms.completed_at) !== 1 ? 's' : ''} early`
                : ''}
            </div>
          )}

          {status === 'not_started' && ms.deadline && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Due: {fmtDate(ms.deadline)}</div>
          )}

          {status === 'in_progress' && ms.deadline && (
            <div style={{ fontSize: 12, color: 'var(--navy)', marginTop: 3, fontWeight: 600 }}>Due: {fmtShort(ms.deadline)} · In progress</div>
          )}

          {status === 'overdue' && ms.deadline && (
            <div style={{ fontSize: 12.5, color: '#c53030', marginTop: 3, fontWeight: 700 }}>
              Due {fmtShort(ms.deadline)} · OVERDUE {calcDaysOverdue(ms.deadline)} day{calcDaysOverdue(ms.deadline) !== 1 ? 's' : ''}
            </div>
          )}

          {/* Notes visible when in_progress or overdue */}
          {(status === 'in_progress' || status === 'overdue') && notes.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Notes</div>
              {notes.slice(-3).map(n => (
                <div key={n.id} style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.4 }}>
                  <span style={{ fontStyle: 'italic' }}>&ldquo;{n.comment}&rdquo;</span>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{fmtTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}

          {showNote && (
            <div style={{ marginTop: 10 }}>
              <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What progress did you make?" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') setShowNote(false); }}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: '#fff', fontSize: 13, padding: '0 10px', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" onClick={() => setShowNote(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="button" onClick={saveNote} disabled={savingNote || !noteText.trim()} className="btn btn-primary btn-sm">Save note</button>
              </div>
            </div>
          )}

          {extendMode && (
            <div style={{ marginTop: 10 }}>
              <input type="date" value={newDl} onChange={e => setNewDl(e.target.value)} min={TODAY} autoFocus
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--navy)', background: '#fff', fontSize: 13, padding: '0 10px', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" onClick={() => setExtendMode(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="button" onClick={async () => { if (!newDl) return; await onExtend(ms.id, newDl); setExtendMode(false); }} disabled={!newDl} className="btn btn-primary btn-sm">Update deadline</button>
              </div>
            </div>
          )}

          {!showNote && !extendMode && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {status === 'not_started' && (
                <button type="button" disabled={acting} onClick={async () => { setActing(true); await onStart(ms.id); setActing(false); }} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="arrowright" size={13} /> Start
                </button>
              )}
              {status === 'in_progress' && (
                <>
                  <button type="button" onClick={() => setShowNote(true)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="message" size={13} /> Add note
                  </button>
                  <button type="button" disabled={acting} onClick={async () => { setActing(true); await onDone(ms.id); setActing(false); }} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={13} stroke={2.6} color="#fff" /> Done
                  </button>
                </>
              )}
              {status === 'overdue' && (
                <>
                  <button type="button" disabled={acting} onClick={async () => { setActing(true); await onDone(ms.id); setActing(false); }} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={13} stroke={2.6} color="#fff" /> Mark done
                  </button>
                  <button type="button" onClick={() => { setNewDl(''); setExtendMode(true); }} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="calendarclock" size={13} /> New deadline
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {status !== 'completed' && (
          <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
            <button type="button" onClick={() => { setEditTitle(ms.title); setEditDl(ms.deadline ?? ''); setEditMode(true); }}
              style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pencil" size={14} color="var(--muted)" />
            </button>
            <button type="button" onClick={() => setConfirmDel(true)}
              style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={14} color="#c53030" />
            </button>
          </div>
        )}
      </div>

      {confirmDel && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#fee2e2', borderRadius: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#c53030', marginBottom: 8 }}>Remove this milestone?</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setConfirmDel(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="button" onClick={() => onDelete(ms.id)} style={{ height: 30, padding: '0 12px', borderRadius: 7, background: '#c53030', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const p = pillarOf(goal.pillar);
  const pct = goal.msTotal > 0 ? goal.msCompleted / goal.msTotal : 0;
  return (
    <button onClick={onClick} className="card card-pad" style={{ textAlign: 'left', display: 'block', width: '100%', opacity: goal.status === 'archived' ? 0.65 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <PillarChip pillar={goal.pillar} size="sm" />
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.25 }}>{goal.title}</div>
        </div>
        {goal.status === 'archived'
          ? <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 700, flex: 'none' }}>Archived</span>
          : <StatusPill status={goal.status} size="sm" />}
      </div>
      {goal.msTotal > 0 && (
        <div style={{ marginTop: 13 }}>
          <ProgressBar value={pct} color={p.color} />
          <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="check" size={12} stroke={2.6} /> {goal.msCompleted} of {goal.msTotal} milestones · Due {goal.due}
          </div>
        </div>
      )}
      {goal.msTotal === 0 && (
        <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="calendarclock" size={13} /> Due {goal.due} · No milestones yet
        </div>
      )}
    </button>
  );
}

// ── New Goal Flow ─────────────────────────────────────────────────────────────

function NewGoalFlow({ memberId, onClose, onAdded, onToast }: {
  memberId: string; onClose: () => void; onAdded: (g: Goal) => void; onToast: (t: ToastPayload) => void;
}) {
  const [step, setStep]   = useState(0);
  const [pillar, setPillar] = useState<PillarKey | null>(null);
  const [tpl, setTpl]     = useState<{ t: string; target: number; unit: string } | null>(null);
  const [target, setTarget] = useState(10);
  const [unit, setUnit]   = useState('days');
  const [due, setDue]     = useState('Aug 31');
  const [busy, setBusy]   = useState(false);

  const pickTpl = (t: { t: string; target: number; unit: string }) => { setTpl(t); setTarget(t.target); setUnit(t.unit); };

  const submit = async () => {
    if (!pillar || !tpl) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const rawDue = parseDue(due);
      const { data, error } = await supabase.from('goals').insert({
        member_id: memberId, pillar, title: tpl.t, current: 0, target, unit, due_date: rawDue, status: 'ontrack',
      }).select('id').single();
      if (error) throw error;
      onAdded({ id: data.id, pillar, title: tpl.t, current: 0, target, unit, due, rawDue, status: 'ontrack', notes: null, msCompleted: 0, msTotal: 0 });
      if (pillar === 'spiritual' && tpl.t === 'Daily devotion streak') {
        const { data: existingPlan } = await supabase.from('bible_reading_plans').select('id').eq('member_id', memberId).limit(1).maybeSingle();
        if (!existingPlan) {
          await supabase.from('bible_reading_plans').insert({
            member_id: memberId, testament: 'new', start_book: 'Matthew',
            end_book: 'Revelation', chapters_per_day: 1,
            start_date: new Date().toISOString().slice(0, 10),
          });
        }
      }
      onClose();
      onToast({ msg: "Goal set. Let's start the climb.", icon: 'flag' });
    } catch {
      onToast({ msg: 'Could not save — try again.' });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 4 }}>New goal</h2>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />)}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Choose a pillar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PILLARS.map(p => {
              const sel = pillar === p.key;
              return (
                <button key={p.key} onClick={() => setPillar(p.key as PillarKey)} style={{ padding: '16px 12px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, margin: '0 auto', borderRadius: 13, background: '#fff', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}><Icon name={p.icon} size={22} stroke={2.1} /></div>
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
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Set the due date</div>
          <Field label="Due date">
            <OptionChips options={['Jun 30', 'Aug 31', 'Sep 30', 'Dec 31']} value={due} onChange={v => setDue(v as string)} />
          </Field>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>Add milestones after creating the goal to track your progress step by step.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ paddingLeft: 16, paddingRight: 16 }}><Icon name="arrowleft" size={18} /></button>}
        {step < 2
          ? <button onClick={() => setStep(s => s + 1)} disabled={step === 0 ? !pillar : !tpl} className="btn btn-primary btn-block">Continue</button>
          : <button onClick={submit} disabled={busy} className="btn btn-primary btn-block"><Icon name="flag" size={17} color="#fff" /> Set this goal</button>}
      </div>
    </div>
  );
}

// ── Goal Detail Sheet ─────────────────────────────────────────────────────────

function GoalDetail({ goal, goals, memberId, onGoalsChange, onClose, onPoints, onToast, onCelebrate, onDelete, onArchive }: {
  goal: Goal; goals: Goal[]; memberId: string;
  onGoalsChange: (gs: Goal[]) => void; onClose: () => void;
  onPoints: (n: number) => void; onToast: (t: ToastPayload) => void;
  onCelebrate: (d: CelebratePayload) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const live = goals.find(g => g.id === goal.id) ?? goal;
  const p    = pillarOf(live.pillar);

  const [milestones, setMilestones]         = useState<Milestone[]>([]);
  const [allNotes, setAllNotes]             = useState<MilestoneNote[]>([]);
  const [msLoaded, setMsLoaded]             = useState(false);
  const [newMsTitle, setNewMsTitle]         = useState('');
  const [newMsDl, setNewMsDl]               = useState('');
  const [showAdd, setShowAdd]               = useState(false);
  const [adding, setAdding]                 = useState(false);
  const [suggestions, setSuggestions]       = useState<{ title: string; description: string }[]>([]);
  const [loadingSugg, setLoadingSugg]       = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);
  const [confirmAction, setConfirmAction]   = useState<'delete' | 'archive' | null>(null);
  const [editingGoal, setEditingGoal]       = useState(false);
  const [editTitle, setEditTitle]           = useState(live.title);
  const [editPillar, setEditPillar]         = useState<PillarKey>(live.pillar);
  const [editTarget, setEditTarget]         = useState(live.target);
  const [editUnit, setEditUnit]             = useState(live.unit);
  const [editDue, setEditDue]               = useState(live.rawDue ?? '');
  const [savingEdit, setSavingEdit]         = useState(false);

  const loadMilestones = useCallback(async () => {
    const supabase = createClient();
    const [msRes, notesRes] = await Promise.all([
      supabase.from('goal_steps')
        .select('id, goal_id, title, milestone_status, deadline, order_index, started_at, completed_at, member_id')
        .eq('goal_id', live.id).is('member_id', null).order('order_index'),
      supabase.from('goal_updates')
        .select('id, step_id, comment, created_at')
        .eq('goal_id', live.id).order('created_at'),
    ]);
    if (msRes.data) setMilestones(msRes.data as Milestone[]);
    if (notesRes.data) setAllNotes(notesRes.data as MilestoneNote[]);
    setMsLoaded(true);
  }, [live.id]);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  const syncGoalProgress = async (updated: Milestone[]) => {
    const total     = updated.length;
    const completed = updated.filter(m => m.milestone_status === 'completed').length;
    const ratio     = total > 0 ? completed / total : 0;
    const newStatus: GoalStatus = total === 0 ? 'ontrack'
      : completed === total ? 'done'
      : ratio >= 0.9 ? 'ontrack'
      : ratio >= 0.5 ? 'atrisk'
      : 'behind';
    const supabase = createClient();
    await supabase.from('goals').update({ current: completed, target: Math.max(1, total), status: newStatus }).eq('id', live.id);
    onGoalsChange(goals.map(g => g.id === live.id ? { ...g, current: completed, target: Math.max(1, total), status: newStatus, msCompleted: completed, msTotal: total } : g));
    return { completed, total, newStatus };
  };

  const startMilestone = async (id: string) => {
    const now = new Date().toISOString();
    const supabase = createClient();
    await supabase.from('goal_steps').update({ milestone_status: 'in_progress', started_at: now }).eq('id', id);
    setMilestones(ms => ms.map(m => m.id === id ? { ...m, milestone_status: 'in_progress' as MilestoneStatus, started_at: now } : m));
  };

  const completeMilestone = async (id: string) => {
    const now = new Date().toISOString();
    const supabase = createClient();
    await supabase.from('goal_steps').update({ milestone_status: 'completed', completed_at: now }).eq('id', id);
    const updated = milestones.map(m => m.id === id ? { ...m, milestone_status: 'completed' as MilestoneStatus, completed_at: now } : m);
    setMilestones(updated);
    const awarded = await awardPoints(memberId, 'goal_step_completed', 'goal_steps', id);
    if (awarded) onToast({ msg: `+${awarded} pts`, icon: 'check', points: awarded });
    const { newStatus } = await syncGoalProgress(updated);
    if (newStatus === 'done') {
      const goalAwarded = await awardPoints(memberId, 'goal_complete', 'goals', live.id);
      onPoints(goalAwarded || 20);
      onClose();
      setTimeout(() => onCelebrate({ title: 'Goal complete!', sub: p.verse, points: goalAwarded || 20 }), 350);
    }
  };

  const addNote = async (stepId: string, comment: string) => {
    const supabase = createClient();
    const { data } = await supabase.from('goal_updates').insert({
      goal_id: live.id, step_id: stepId, member_id: memberId, comment,
    }).select('id, step_id, comment, created_at').single();
    if (data) {
      setAllNotes(ns => [...ns, data as MilestoneNote]);
      const awarded = await awardPoints(memberId, 'goal_update_added', 'goal_updates', data.id);
      if (awarded) onToast({ msg: `+${awarded} pts — progress noted!`, icon: 'zap', points: awarded });
    }
  };

  const editMilestone = async (id: string, title: string, deadline: string) => {
    const ms = milestones.find(m => m.id === id);
    const resetStatus = ms?.milestone_status === 'overdue' && deadline !== ms.deadline;
    const patch: Record<string, unknown> = { title, deadline };
    if (resetStatus) patch.milestone_status = 'not_started';
    const supabase = createClient();
    await supabase.from('goal_steps').update(patch).eq('id', id);
    setMilestones(mss => mss.map(m => m.id === id ? { ...m, title, deadline, ...(resetStatus ? { milestone_status: 'not_started' as MilestoneStatus } : {}) } : m));
  };

  const extendMilestone = async (id: string, newDeadline: string) => {
    const supabase = createClient();
    await supabase.from('goal_steps').update({ deadline: newDeadline, milestone_status: 'in_progress' }).eq('id', id);
    setMilestones(mss => mss.map(m => m.id === id ? { ...m, deadline: newDeadline, milestone_status: 'in_progress' as MilestoneStatus } : m));
  };

  const deleteMilestone = async (id: string) => {
    const supabase = createClient();
    await supabase.from('goal_steps').delete().eq('id', id);
    const updated = milestones.filter(m => m.id !== id);
    setMilestones(updated);
    await syncGoalProgress(updated);
  };

  const addMilestone = async () => {
    if (!newMsTitle.trim() || !newMsDl) return;
    setAdding(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('goal_steps').insert({
      goal_id: live.id, title: newMsTitle.trim(), deadline: newMsDl,
      milestone_status: 'not_started', order_index: milestones.length, member_id: null,
    }).select().single();
    if (!error && data) {
      const updated = [...milestones, data as Milestone];
      setMilestones(updated);
      setNewMsTitle(''); setNewMsDl(''); setShowAdd(false);
      await syncGoalProgress(updated);
    }
    setAdding(false);
  };

  const addFromSuggestion = async (sg: { title: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('goal_steps').insert({
      goal_id: live.id, title: sg.title, deadline: live.rawDue ?? '',
      milestone_status: 'not_started', order_index: milestones.length, member_id: null,
    }).select().single();
    if (!error && data) {
      const updated = [...milestones, data as Milestone];
      setMilestones(updated);
      setSuggestions(s => s.filter(x => x.title !== sg.title));
      await syncGoalProgress(updated);
      onToast({ msg: 'Milestone added!', icon: 'check' });
    }
  };

  const getSuggestions = async () => {
    setLoadingSugg(true);
    try {
      const res = await fetch('/api/goals/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalTitle: live.title, pillar: live.pillar }),
      });
      const { steps } = await res.json() as { steps: { title: string; description: string }[] };
      setSuggestions(steps ?? []);
    } catch {
      onToast({ msg: 'Could not load suggestions — try again.' });
    } finally { setLoadingSugg(false); }
  };

  const saveGoalEdits = async () => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase.from('goals').update({
      title: editTitle.trim(), pillar: editPillar, target: editTarget,
      unit: editUnit.trim(), due_date: editDue || null,
      updated_at: new Date().toISOString(),
    }).eq('id', live.id);
    if (!error) {
      onGoalsChange(goals.map(g => g.id === live.id ? {
        ...g, title: editTitle.trim(), pillar: editPillar, target: editTarget,
        unit: editUnit.trim(), rawDue: editDue || null, due: editDue ? fmtShort(editDue) : '',
      } : g));
      setEditingGoal(false);
      onToast({ msg: 'Goal updated', icon: 'check' });
    } else {
      onToast({ msg: 'Could not save — try again.' });
    }
    setSavingEdit(false);
  };

  const handleConfirmAction = async () => {
    const supabase = createClient();
    if (confirmAction === 'delete') {
      const { error } = await supabase.from('goals').delete().eq('id', live.id);
      if (!error) { onDelete(live.id); onClose(); onToast({ msg: 'Goal deleted' }); }
      else onToast({ msg: 'Could not delete — try again.' });
    } else if (confirmAction === 'archive') {
      const { error } = await supabase.from('goals').update({ status: 'archived' }).eq('id', live.id);
      if (!error) { onArchive(live.id); onClose(); onToast({ msg: 'Goal archived' }); }
      else onToast({ msg: 'Could not archive — try again.' });
    }
    setConfirmAction(null);
  };

  const completedMs = milestones.filter(m => m.milestone_status === 'completed').length;
  const totalMs     = milestones.length;
  const msPct       = totalMs > 0 ? completedMs / totalMs : 0;

  if (confirmAction) return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>
        {confirmAction === 'delete' ? 'Delete this goal?' : 'Archive this goal?'}
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>&ldquo;{live.title}&rdquo;</div>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 22 }}>
        {confirmAction === 'delete'
          ? 'This will also delete all milestones and progress notes. This cannot be undone.'
          : 'This goal will move to your Archived section. It will not count toward active goals.'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setConfirmAction(null)} className="btn btn-ghost btn-block">Cancel</button>
        <button onClick={handleConfirmAction} className="btn btn-block"
          style={{ background: confirmAction === 'delete' ? '#c53030' : 'var(--muted)', color: '#fff', border: 'none', borderRadius: 10, height: 46, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          {confirmAction === 'delete' ? 'Delete goal' : 'Archive goal'}
        </button>
      </div>
    </div>
  );

  if (editingGoal) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button type="button" onClick={() => setEditingGoal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Icon name="arrowleft" size={20} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Edit goal</div>
      </div>
      <Field label="Goal title">
        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
          style={{ width: '100%', height: 42, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
      </Field>
      <Field label="Pillar">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
          {PILLARS.map(pl => {
            const sel = editPillar === pl.key;
            return (
              <button key={pl.key} type="button" onClick={() => setEditPillar(pl.key as PillarKey)} style={{ padding: '10px 8px', borderRadius: 9, background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name={pl.icon} size={16} stroke={2.1} color={sel ? 'var(--navy)' : 'var(--muted)'} />
                <span style={{ fontSize: 13, fontWeight: 700, color: sel ? 'var(--navy)' : 'var(--ink)' }}>{pl.short}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Due date">
        <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
          style={{ width: '100%', height: 42, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Target">
          <input type="number" value={editTarget} onChange={e => setEditTarget(Number(e.target.value))} min={1}
            style={{ width: '100%', height: 42, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
        </Field>
        <Field label="Unit">
          <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} placeholder="days, books…"
            style={{ width: '100%', height: 42, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button type="button" onClick={() => setEditingGoal(false)} className="btn btn-ghost btn-block">Cancel</button>
        <button type="button" onClick={saveGoalEdits} disabled={savingEdit || !editTitle.trim()} className="btn btn-primary btn-block">Save</button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <ProgressRing value={msPct} size={72} stroke={7} color={p.color}>
          <span className="tnum" style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(msPct * 100)}%</span>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PillarChip pillar={live.pillar} size="sm" />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', marginTop: 7, lineHeight: 1.2 }}>{live.title}</div>
          <div style={{ marginTop: 6 }}>
            {live.status === 'archived'
              ? <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 }}>Archived</span>
              : <StatusPill status={live.status} size="sm" />}
          </div>
        </div>
        <div style={{ position: 'relative', flex: 'none' }}>
          <button type="button" onClick={() => setMenuOpen(v => !v)}
            style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="morehorizontal" size={18} color="var(--ink-2)" />
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
              <div style={{ position: 'absolute', top: 38, right: 0, width: 180, background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.15)', border: '1px solid var(--line)', zIndex: 2, overflow: 'hidden' }}>
                <button type="button" onClick={() => { setMenuOpen(false); setEditTitle(live.title); setEditPillar(live.pillar); setEditTarget(live.target); setEditUnit(live.unit); setEditDue(live.rawDue ?? ''); setEditingGoal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
                  <Icon name="pencil" size={15} color="var(--muted)" /> Edit goal
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setConfirmAction('archive'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'left', borderTop: '1px solid var(--line)' }}>
                  <Icon name="archive" size={15} color="var(--muted)" /> Archive goal
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setConfirmAction('delete'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#c53030', textAlign: 'left', borderTop: '1px solid var(--line)' }}>
                  <Icon name="trash" size={15} color="#c53030" /> Delete goal
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Milestone progress summary */}
      {totalMs > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={msPct} color={p.color} />
          </div>
          <div className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flex: 'none' }}>
            {completedMs} / {totalMs} milestones
          </div>
        </div>
      )}

      {/* Milestones section */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Milestones</div>
          <button type="button" onClick={() => setShowAdd(v => !v)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="plus" size={14} /> Add
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px dashed var(--navy)', background: 'var(--navy-tint)', marginBottom: 10 }}>
            <input type="text" value={newMsTitle} onChange={e => setNewMsTitle(e.target.value)} placeholder="Milestone title (required)"
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: '#fff', fontSize: 13.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 5 }}>Deadline (required)</div>
            <input type="date" value={newMsDl} onChange={e => setNewMsDl(e.target.value)} min={TODAY}
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: '#fff', fontSize: 13.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button type="button" onClick={addMilestone} disabled={adding || !newMsTitle.trim() || !newMsDl} className="btn btn-primary btn-sm">Add milestone</button>
            </div>
          </div>
        )}

        {!msLoaded ? (
          <div style={{ height: 60, borderRadius: 10, background: 'var(--surface-2)' }} />
        ) : milestones.length === 0 && !showAdd ? (
          <div style={{ padding: '16px 14px', borderRadius: 10, border: '1px solid var(--line-2)', background: 'var(--surface)', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>No milestones yet. Add some or let AI suggest a plan.</div>
            <button type="button" onClick={getSuggestions} disabled={loadingSugg} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkles" size={14} color="var(--navy)" />
              {loadingSugg ? 'Getting suggestions…' : 'Get AI suggestions'}
            </button>
          </div>
        ) : (
          milestones.map(ms => (
            <MilestoneItem
              key={ms.id} ms={ms}
              notes={allNotes.filter(n => n.step_id === ms.id)}
              onStart={startMilestone} onDone={completeMilestone}
              onAddNote={addNote} onEdit={editMilestone}
              onDelete={deleteMilestone} onExtend={extendMilestone}
            />
          ))
        )}

        {milestones.length > 0 && suggestions.length === 0 && (
          <button type="button" onClick={getSuggestions} disabled={loadingSugg}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12.5, color: 'var(--navy)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="sparkles" size={13} color="var(--navy)" />
            {loadingSugg ? 'Getting suggestions…' : 'Suggest more milestones'}
          </button>
        )}

        {suggestions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Suggested for you:</div>
            {suggestions.map((sg, i) => (
              <button key={i} type="button" onClick={() => addFromSuggestion(sg)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 10, border: '1.5px dashed var(--navy)', background: 'var(--navy-tint)', marginBottom: 7, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                <Icon name="plus" size={16} color="var(--navy)" stroke={2.4} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.3 }}>{sg.title}</div>
                  {sg.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sg.description}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5, padding: '0 2px 16px' }}>{p.verse}</div>
    </div>
  );
}

// ── Community Goal Detail ─────────────────────────────────────────────────────

interface CommunityMember { id: string; name: string; current_value: number; status: string; }

function CommunityGoalDetail({ goal, memberId, onUpdate, onCelebrate, onPoints, onToast }: {
  goal: CommunityGoal; memberId: string;
  onUpdate: (id: string, val: number, done: boolean) => void;
  onCelebrate: (d: CelebratePayload) => void;
  onPoints: (n: number) => void;
  onToast: (t: ToastPayload) => void;
}) {
  const p = pillarOf(goal.pillar);

  const [milestones, setMilestones]   = useState<Milestone[]>([]);
  const [allNotes, setAllNotes]       = useState<MilestoneNote[]>([]);
  const [msLoaded, setMsLoaded]       = useState(false);
  const [leaderboard, setLeaderboard] = useState<CommunityMember[]>([]);
  const [newMsTitle, setNewMsTitle]   = useState('');
  const [newMsDl, setNewMsDl]         = useState('');
  const [showAdd, setShowAdd]         = useState(false);
  const [adding, setAdding]           = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('goal_steps').select('id, goal_id, title, milestone_status, deadline, order_index, started_at, completed_at, member_id')
      .eq('goal_id', goal.id).eq('member_id', memberId).order('order_index')
      .then(({ data }) => { if (data) setMilestones(data as Milestone[]); setMsLoaded(true); });

    supabase.from('goal_updates').select('id, step_id, comment, created_at')
      .eq('goal_id', goal.id).order('created_at')
      .then(({ data }) => { if (data) setAllNotes(data as MilestoneNote[]); });

    supabase.from('member_community_goals').select('member_id, current_value, status')
      .eq('goal_id', goal.id).order('current_value', { ascending: false }).limit(10)
      .then(async ({ data: mcgRows }) => {
        if (!mcgRows?.length) return;
        const ids = (mcgRows as { member_id: string }[]).map(r => r.member_id);
        const { data: names } = await supabase.from('members').select('id, name').in('id', ids);
        const nameById = Object.fromEntries((names ?? []).map((m: { id: string; name: string }) => [m.id, m.name]));
        setLeaderboard((mcgRows as { member_id: string; current_value: number; status: string }[])
          .map(r => ({ id: r.member_id, name: nameById[r.member_id] ?? 'Member', current_value: r.current_value, status: r.status })));
      });
  }, [goal.id, memberId]);

  const syncProgress = async (updated: Milestone[]) => {
    const completed = updated.filter(m => m.milestone_status === 'completed').length;
    const total     = updated.length;
    const isDone    = total > 0 && completed === total;
    const supabase  = createClient();
    const patch: Record<string, unknown> = { current_value: completed };
    if (isDone && goal.status !== 'completed') {
      patch.status = 'completed';
      patch.completed_at = new Date().toISOString();
    }
    await supabase.from('member_community_goals').update(patch).eq('id', goal.mcg_id);
    onUpdate(goal.id, completed, isDone);
    return { isDone };
  };

  const startMilestone = async (id: string) => {
    const now = new Date().toISOString();
    const supabase = createClient();
    await supabase.from('goal_steps').update({ milestone_status: 'in_progress', started_at: now }).eq('id', id);
    setMilestones(ms => ms.map(m => m.id === id ? { ...m, milestone_status: 'in_progress' as MilestoneStatus, started_at: now } : m));
  };

  const completeMilestone = async (id: string) => {
    const now = new Date().toISOString();
    const supabase = createClient();
    await supabase.from('goal_steps').update({ milestone_status: 'completed', completed_at: now }).eq('id', id);
    const updated = milestones.map(m => m.id === id ? { ...m, milestone_status: 'completed' as MilestoneStatus, completed_at: now } : m);
    setMilestones(updated);
    const awarded = await awardPoints(memberId, 'goal_step_completed', 'goal_steps', id);
    if (awarded) onToast({ msg: `+${awarded} pts`, icon: 'check', points: awarded });
    const { isDone } = await syncProgress(updated);
    if (isDone) {
      const goalAwarded = await awardPoints(memberId, 'community_goal_completed', 'member_community_goals', goal.mcg_id);
      onPoints(goalAwarded || 30);
      onCelebrate({ title: 'Community goal complete!', sub: `You finished "${goal.title}" for the community.`, points: goalAwarded || 30 });
    }
  };

  const addNote = async (stepId: string, comment: string) => {
    const supabase = createClient();
    const { data } = await supabase.from('goal_updates').insert({
      goal_id: goal.id, step_id: stepId, member_id: memberId, comment,
    }).select('id, step_id, comment, created_at').single();
    if (data) {
      setAllNotes(ns => [...ns, data as MilestoneNote]);
      const awarded = await awardPoints(memberId, 'goal_update_added', 'goal_updates', data.id);
      if (awarded) onToast({ msg: `+${awarded} pts — progress noted!`, icon: 'zap', points: awarded });
    }
  };

  const editMilestone = async (id: string, title: string, deadline: string) => {
    const ms = milestones.find(m => m.id === id);
    const resetStatus = ms?.milestone_status === 'overdue' && deadline !== ms.deadline;
    const patch: Record<string, unknown> = { title, deadline };
    if (resetStatus) patch.milestone_status = 'not_started';
    const supabase = createClient();
    await supabase.from('goal_steps').update(patch).eq('id', id);
    setMilestones(mss => mss.map(m => m.id === id ? { ...m, title, deadline, ...(resetStatus ? { milestone_status: 'not_started' as MilestoneStatus } : {}) } : m));
  };

  const extendMilestone = async (id: string, newDeadline: string) => {
    const supabase = createClient();
    await supabase.from('goal_steps').update({ deadline: newDeadline, milestone_status: 'in_progress' }).eq('id', id);
    setMilestones(mss => mss.map(m => m.id === id ? { ...m, deadline: newDeadline, milestone_status: 'in_progress' as MilestoneStatus } : m));
  };

  const deleteMilestone = async (id: string) => {
    const supabase = createClient();
    await supabase.from('goal_steps').delete().eq('id', id);
    const updated = milestones.filter(m => m.id !== id);
    setMilestones(updated);
    await syncProgress(updated);
  };

  const addMilestone = async () => {
    if (!newMsTitle.trim() || !newMsDl) return;
    setAdding(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('goal_steps').insert({
      goal_id: goal.id, title: newMsTitle.trim(), deadline: newMsDl,
      milestone_status: 'not_started', order_index: milestones.length, member_id: memberId,
    }).select().single();
    if (!error && data) {
      const updated = [...milestones, data as Milestone];
      setMilestones(updated);
      setNewMsTitle(''); setNewMsDl(''); setShowAdd(false);
      await syncProgress(updated);
    }
    setAdding(false);
  };

  const completedMs = milestones.filter(m => m.milestone_status === 'completed').length;
  const totalMs     = milestones.length;
  const msPct       = totalMs > 0 ? completedMs / totalMs : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', border: `7px solid ${p.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: `${p.color}10` }}>
          <Icon name="globe" size={28} color={p.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PillarChip pillar={goal.pillar} size="sm" />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', marginTop: 7, lineHeight: 1.2 }}>{goal.title}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: `${p.color}18`, color: p.color, fontSize: 11.5, fontWeight: 700 }}>Community</span>
            {goal.is_mandatory && <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: '#fee2e2', color: '#c53030', fontSize: 11.5, fontWeight: 700 }}>Mandatory</span>}
            {goal.status === 'completed' && <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: '#d1fae5', color: '#065f46', fontSize: 11.5, fontWeight: 700 }}>✓ Done</span>}
          </div>
        </div>
      </div>

      {goal.notes && (
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 16 }}>{goal.notes}</p>
      )}

      {goal.due_date && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="calendarclock" size={13} /> Goal deadline: {fmtDate(goal.due_date)}
        </div>
      )}

      {/* Milestone progress */}
      {totalMs > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={msPct} color={p.color} />
          </div>
          <div className="tnum" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flex: 'none' }}>
            {completedMs} / {totalMs}
          </div>
        </div>
      )}

      {/* My milestones */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>My milestones</div>
            {totalMs === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Add your own milestones to achieve this goal</div>}
          </div>
          <button type="button" onClick={() => setShowAdd(v => !v)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="plus" size={14} /> Add
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px dashed var(--navy)', background: 'var(--navy-tint)', marginBottom: 10 }}>
            <input type="text" value={newMsTitle} onChange={e => setNewMsTitle(e.target.value)} placeholder="Milestone title (required)"
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: '#fff', fontSize: 13.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 5 }}>Deadline (before {goal.due_date ? fmtShort(goal.due_date) : 'main deadline'})</div>
            <input type="date" value={newMsDl} onChange={e => setNewMsDl(e.target.value)} min={TODAY} max={goal.due_date ?? undefined}
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid var(--line-2)', background: '#fff', fontSize: 13.5, padding: '0 10px', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button type="button" onClick={addMilestone} disabled={adding || !newMsTitle.trim() || !newMsDl} className="btn btn-primary btn-sm">Add milestone</button>
            </div>
          </div>
        )}

        {!msLoaded ? (
          <div style={{ height: 60, borderRadius: 10, background: 'var(--surface-2)' }} />
        ) : milestones.length === 0 && !showAdd ? (
          <div style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line-2)', background: 'var(--surface)', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No milestones yet — add your first one above.</div>
          </div>
        ) : (
          milestones.map(ms => (
            <MilestoneItem
              key={ms.id} ms={ms}
              notes={allNotes.filter(n => n.step_id === ms.id)}
              onStart={startMilestone} onDone={completeMilestone}
              onAddNote={addNote} onEdit={editMilestone}
              onDelete={deleteMilestone} onExtend={extendMilestone}
            />
          ))
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="trophy" size={15} color="var(--navy)" /> Leaderboard
          </div>
          {leaderboard.map((m, idx) => {
            const isMe = m.id === memberId;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: isMe ? 'var(--navy-tint)' : 'var(--bg)', border: isMe ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', marginBottom: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: idx < 3 ? ['#f59e0b', '#6b7280', '#ea580c'][idx] : 'var(--faint)', width: 22, textAlign: 'center', flex: 'none' }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isMe ? 800 : 600, color: isMe ? 'var(--navy)' : 'var(--ink)' }}>{isMe ? 'You' : m.name}</div>
                </div>
                <div className="tnum" style={{ fontSize: 12, color: 'var(--muted)', flex: 'none' }}>{m.current_value} milestone{m.current_value !== 1 ? 's' : ''}</div>
                {m.status === 'completed' && <Icon name="check" size={14} stroke={2.6} color="#065f46" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [member, setMember]             = useState<{ id: string; points: number } | null>(null);
  const [goals, setGoals]               = useState<Goal[]>([]);
  const [communityGoals, setCommunityGoals] = useState<CommunityGoal[]>([]);
  const [communitySheet, setCommunitySheet] = useState<CommunityGoal | null>(null);
  const [filter, setFilter]             = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sheet, setSheet]               = useState<{ type: 'new' | 'detail'; goal?: Goal } | null>(null);
  const [toast, setToast]               = useState<ToastPayload | null>(null);
  const [celebrate, setCelebrate]       = useState<CelebratePayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: ToastPayload) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const addPoints = (n: number) => setMember(m => m ? { ...m, points: m.points + n } : m);
  const handleDeleteGoal  = (id: string) => setGoals(gs => gs.filter(g => g.id !== id));
  const handleArchiveGoal = (id: string) => setGoals(gs => gs.map(g => g.id === id ? { ...g, status: 'archived' as GoalStatus } : g));

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase.from('members').select('id, points, onboarding_complete').eq('auth_id', user.id).maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      setMember({ id: memberRow.id, points: memberRow.points ?? 0 });

      const { data: goalsData } = await supabase
        .from('goals').select('id,pillar,title,current,target,unit,due_date,status,notes')
        .eq('member_id', memberRow.id).order('created_at', { ascending: true });

      let goals: Goal[] = [];
      if (goalsData && goalsData.length > 0) {
        const goalIds = (goalsData as GoalRow[]).map(g => g.id);
        const { data: stepData } = await supabase
          .from('goal_steps').select('goal_id, milestone_status')
          .in('goal_id', goalIds).is('member_id', null);

        const msCounts: Record<string, { total: number; completed: number }> = {};
        (stepData ?? []).forEach((s: { goal_id: string; milestone_status: string }) => {
          if (!msCounts[s.goal_id]) msCounts[s.goal_id] = { total: 0, completed: 0 };
          msCounts[s.goal_id].total++;
          if (s.milestone_status === 'completed') msCounts[s.goal_id].completed++;
        });

        goals = (goalsData as GoalRow[]).map(g => ({
          id: g.id, pillar: g.pillar as PillarKey, title: g.title,
          current: g.current ?? 0, target: g.target ?? 1, unit: g.unit ?? '',
          due: fmtShort(g.due_date), rawDue: g.due_date,
          status: (g.status ?? 'ontrack') as GoalStatus,
          notes: g.notes ?? null,
          msCompleted: msCounts[g.id]?.completed ?? 0,
          msTotal: msCounts[g.id]?.total ?? 0,
        }));
        setGoals(goals);
      }

      // Community goals
      const { data: mcgData } = await supabase
        .from('member_community_goals').select('id, current_value, status, goal_id')
        .eq('member_id', memberRow.id);

      if (mcgData && mcgData.length > 0) {
        const goalIds = mcgData.map((r: { goal_id: string }) => r.goal_id);
        const { data: cgData } = await supabase
          .from('goals').select('id, title, notes, pillar, target, unit, due_date, is_mandatory, is_published')
          .in('id', goalIds).eq('goal_type', 'community').eq('is_published', true);

        if (cgData) {
          const mcgById = Object.fromEntries(
            (mcgData as { id: string; goal_id: string; current_value: number; status: string }[]).map(r => [r.goal_id, r])
          );
          setCommunityGoals((cgData as {
            id: string; title: string; notes: string | null; pillar: string;
            target: number; unit: string; due_date: string | null;
            is_mandatory: boolean; is_published: boolean;
          }[]).map(g => {
            const mcg = mcgById[g.id];
            return {
              id: g.id, title: g.title, notes: g.notes, pillar: g.pillar as PillarKey,
              target: g.target, unit: g.unit, due_date: g.due_date,
              is_mandatory: g.is_mandatory,
              mcg_id: mcg?.id ?? '', current_value: mcg?.current_value ?? 0,
              status: mcg?.status ?? 'not_started',
            };
          }));
        }
      }

      setLoading(false);
    })();
  }, [router]);

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[56, 88, 88, 88].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
      </div>
    </div>
  );

  const month = Math.max(1, Math.min(12, (() => {
    const n = new Date(); const s = new Date('2026-01-01');
    return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1;
  })()));

  const activeGoals   = goals.filter(g => g.status !== 'archived');
  const archivedGoals = goals.filter(g => g.status === 'archived');
  const ontrack       = activeGoals.filter(g => g.status === 'ontrack').length;
  const atrisk        = activeGoals.filter(g => g.status === 'atrisk').length;
  const shown         = filter === 'all' ? activeGoals : activeGoals.filter(g => g.pillar === filter);

  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll member-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 12px' }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>My goals</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Personal · Month {month}</div>
            </div>
            <button onClick={() => setSheet({ type: 'new' })} className="btn btn-primary btn-sm" style={{ paddingLeft: 12 }}>
              <Icon name="plus" size={17} stroke={2.5} color="#fff" /> New
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            {[{ v: ontrack, l: 'On track' }, { v: atrisk, l: 'At risk' }, { v: activeGoals.filter(g => g.status !== 'done').length, l: 'Active' }].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', flex: 1, borderLeft: i > 0 ? '1px solid var(--line)' : 'none', paddingLeft: i > 0 ? 8 : 0 }}>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 800 }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}>
            {[{ value: 'all', label: 'All', icon: '' }, ...PILLARS.map(p => ({ value: p.key, label: p.short, icon: p.icon }))].map(o => {
              const act = filter === o.value;
              return (
                <button key={o.value} onClick={() => setFilter(o.value)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, background: act ? 'var(--navy)' : 'var(--surface)', color: act ? '#fff' : 'var(--ink)', border: act ? 'none' : '1px solid var(--line-2)' }}>
                  {o.icon && <Icon name={o.icon} size={15} stroke={2.2} color={act ? '#fff' : 'var(--muted)'} />}
                  {o.label}
                </button>
              );
            })}
          </div>

          {communityGoals.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="globe" size={14} color="var(--muted)" /> Community goals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {communityGoals.map(cg => {
                  const cp = pillarOf(cg.pillar);
                  return (
                    <button key={cg.id} onClick={() => setCommunitySheet(cg)} className="card card-pad"
                      style={{ textAlign: 'left', display: 'block', width: '100%', borderLeft: `4px solid ${cp.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <Icon name="globe" size={13} color="var(--muted)" />
                            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Community</span>
                            {cg.is_mandatory && <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 99, background: '#fee2e2', color: '#c53030', fontSize: 10.5, fontWeight: 700 }}>Mandatory</span>}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{cg.title}</div>
                        </div>
                        {cg.status === 'completed' && (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            <Icon name="check" size={13} stroke={2.8} color="#065f46" />
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="tnum" style={{ fontSize: 12, color: 'var(--faint)' }}>
                          {cg.current_value} milestone{cg.current_value !== 1 ? 's' : ''} done
                        </span>
                        {cg.due_date && <span style={{ fontSize: 12, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="calendarclock" size={12} /> Due {fmtShort(cg.due_date)}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ height: 1, background: 'var(--line)', margin: '16px 0 4px' }} />
            </div>
          )}

          {shown.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{shown.map(g => <GoalCard key={g.id} goal={g} onClick={() => setSheet({ type: 'detail', goal: g })} />)}</div>
            : <EmptyState icon="target" title="No goals here yet" body="Set one and let&apos;s start the climb — ten times better." cta="Set a goal" onCta={() => setSheet({ type: 'new' })} />}

          {archivedGoals.length > 0 && (
            <div>
              <button onClick={() => setShowArchived(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>
                <Icon name={showArchived ? 'chevrondown' : 'chevronright'} size={16} color="var(--muted)" />
                Archived ({archivedGoals.length})
              </button>
              {showArchived && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {archivedGoals.map(g => <GoalCard key={g.id} goal={g} onClick={() => setSheet({ type: 'detail', goal: g })} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      <Sheet open={sheet?.type === 'new'} onClose={() => setSheet(null)}>
        {member && <NewGoalFlow memberId={member.id} onClose={() => setSheet(null)} onAdded={g => setGoals(gs => [...gs, g])} onToast={showToast} />}
      </Sheet>
      <Sheet open={sheet?.type === 'detail'} onClose={() => setSheet(null)} title="Goal">
        {sheet?.type === 'detail' && sheet.goal && member && (
          <GoalDetail
            goal={sheet.goal} goals={goals} memberId={member.id}
            onGoalsChange={setGoals} onClose={() => setSheet(null)}
            onPoints={addPoints} onToast={showToast} onCelebrate={d => setCelebrate(d)}
            onDelete={handleDeleteGoal} onArchive={handleArchiveGoal}
          />
        )}
      </Sheet>
      <Sheet open={!!communitySheet} onClose={() => setCommunitySheet(null)} title="Community goal">
        {communitySheet && member && (
          <CommunityGoalDetail
            goal={communitySheet} memberId={member.id}
            onUpdate={(id, val, done) => {
              setCommunityGoals(gs => gs.map(g => g.id === id ? { ...g, current_value: val, status: done ? 'completed' : 'in_progress' } : g));
              setCommunitySheet(prev => prev ? { ...prev, current_value: val, status: done ? 'completed' : 'in_progress' } : prev);
            }}
            onCelebrate={d => setCelebrate(d)}
            onPoints={addPoints}
            onToast={showToast}
          />
        )}
      </Sheet>

      <Toast toast={toast} />
      <Celebrate data={celebrate} onClose={() => setCelebrate(null)} />
    </div>
  );
}
