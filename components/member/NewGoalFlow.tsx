'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon, PILLARS } from '@/components/sode/icons';
import { Field } from '@/components/sode/ui';
import { GoalReminderPicker, DEFAULT_REMINDER, reminderColumns, type GoalReminder } from '@/components/member/goal-reminder';

// New-goal flow shared by member Home and Goals (it used to be duplicated in
// both, with the same bugs). Steps: pillar → template or "Write my own" →
// due date + reminder.

export type PillarKey = 'spiritual' | 'career' | 'business' | 'character';

export const GOAL_TEMPLATES: Record<PillarKey, { t: string; target: number; unit: string }[]> = {
  spiritual: [{ t: 'Daily devotion streak', target: 30, unit: 'days' }, { t: 'Read 2 Christian books', target: 2, unit: 'books' }, { t: 'Join a prayer cell', target: 8, unit: 'sessions' }],
  career:    [{ t: 'Earn a professional certification', target: 5, unit: 'modules' }, { t: 'Refresh CV & LinkedIn', target: 3, unit: 'steps' }, { t: 'Apply to target roles', target: 10, unit: 'roles' }],
  business:  [{ t: 'Register the business', target: 4, unit: 'steps' }, { t: 'Land first paying customers', target: 3, unit: 'customers' }, { t: 'Reach revenue milestone', target: 12, unit: 'weeks' }],
  character: [{ t: 'Mentor a younger member', target: 6, unit: 'sessions' }, { t: 'Serve in a department', target: 12, unit: 'weeks' }, { t: '30-day integrity challenge', target: 30, unit: 'days' }],
};

export interface NewGoal {
  id: string; pillar: PillarKey; title: string; target: number; unit: string;
  dueDate: string; // YYYY-MM-DD
  reminder: GoalReminder;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The next four quarter-ends at least two weeks away, e.g. "Dec 31",
// "Mar 31, 2027". Computed from today so the choices never go stale.
function dueChoices(now = new Date()) {
  const out: { label: string; iso: string }[] = [];
  const earliest = now.getTime() + 14 * 86_400_000;
  for (let i = 0; out.length < 4 && i < 24; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
    if (monthStart.getMonth() % 3 !== 2) continue; // Mar, Jun, Sep, Dec
    const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    if (end.getTime() < earliest) continue;
    const label = end.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
      .split(' ').reverse().join(' ') + (end.getFullYear() !== now.getFullYear() ? `, ${end.getFullYear()}` : '');
    out.push({ label, iso: isoLocal(end) });
  }
  return out;
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)',
  fontSize: 16, padding: '0 12px', outline: 'none', boxSizing: 'border-box',
};

export default function NewGoalFlow({ memberId, onClose, onAdded, onToast }: {
  memberId: string;
  onClose: () => void;
  onAdded: (g: NewGoal) => void;
  onToast: (t: { msg: string; icon?: string }) => void;
}) {
  const choices = useMemo(() => dueChoices(), []);
  const tomorrow = useMemo(() => isoLocal(new Date(Date.now() + 86_400_000)), []);

  const [step, setStep]     = useState(0);
  const [pillar, setPillar] = useState<PillarKey | null>(null);
  const [tpl, setTpl]       = useState<{ t: string; target: number; unit: string } | null>(null);
  const [custom, setCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [target, setTarget] = useState(10);
  const [unit, setUnit]     = useState('steps');
  const [due, setDue]       = useState<string>(choices[0]?.iso ?? '');
  const [pickingDate, setPickingDate] = useState(false);
  const [reminder, setReminder] = useState<GoalReminder>(DEFAULT_REMINDER);
  const [busy, setBusy]     = useState(false);

  const pickTpl = (t: { t: string; target: number; unit: string }) => { setCustom(false); setTpl(t); setTarget(t.target); setUnit(t.unit); };
  const pickCustom = () => { setCustom(true); setTpl(null); setTarget(10); setUnit('steps'); };
  const title = custom ? customTitle.trim() : (tpl?.t ?? '');
  const goalReady = custom ? !!(customTitle.trim() && target > 0 && unit.trim()) : !!tpl;
  const dueValid = !!due && due >= tomorrow;

  const submit = async () => {
    if (!pillar || !goalReady || !dueValid) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('goals').insert({
        member_id: memberId, pillar, title, current: 0, target, unit: unit.trim(), due_date: due, status: 'ontrack',
        ...reminderColumns(reminder),
      }).select('id').single();
      if (error) throw error;
      onAdded({ id: data.id, pillar, title, target, unit: unit.trim(), dueDate: due, reminder });
      if (pillar === 'spiritual' && title === 'Daily devotion streak') {
        const { data: existingPlan } = await supabase.from('bible_reading_plans').select('id').eq('member_id', memberId).limit(1).maybeSingle();
        if (!existingPlan) {
          // A plan spans the full testament (New Testament: Matthew → Revelation)
          await supabase.from('bible_reading_plans').insert({
            member_id: memberId, testament: 'new', chapters_per_day: 1,
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

  const chip = (sel: boolean): React.CSSProperties => ({
    padding: '9px 13px', borderRadius: 99, fontSize: 13.5, fontWeight: 700,
    background: sel ? 'var(--navy)' : 'var(--surface)', color: sel ? '#fff' : 'var(--ink)',
    border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)',
  });

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 4 }}>New goal</h2>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 18px' }}>
        {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? 'var(--navy)' : 'var(--surface-2)' }} />)}
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Choose a pillar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PILLARS.map(p => {
              const sel = pillar === p.key;
              return (
                <button key={p.key} type="button" onClick={() => setPillar(p.key as PillarKey)} style={{ padding: '16px 12px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'center' }}>
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
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>Laddered from your team&apos;s pillar goals — or write your own.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {GOAL_TEMPLATES[pillar].map((t, i) => {
              const sel = !custom && tpl?.t === t.t;
              return (
                <button key={i} type="button" onClick={() => pickTpl(t)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.t}</div>
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{t.target} {t.unit}</div>
                  </div>
                  {sel && <Icon name="check" size={20} stroke={2.6} color="var(--navy)" />}
                </button>
              );
            })}
            <button type="button" onClick={pickCustom} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderRadius: 'var(--r-sm)', background: custom ? 'var(--navy-tint)' : 'var(--surface)', border: custom ? '1.5px solid var(--navy)' : '1.5px dashed var(--line-2)', color: 'var(--navy)', fontWeight: 700, fontSize: 14, textAlign: 'left' }}>
              <Icon name="pencil" size={17} /> <span style={{ flex: 1 }}>Write my own</span>
              {custom && <Icon name="check" size={20} stroke={2.6} color="var(--navy)" />}
            </button>
            {custom && (
              <div style={{ padding: '4px 2px 0' }}>
                <Field label="Your goal">
                  <input type="text" autoFocus value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                    placeholder="e.g. Read 12 leadership books" maxLength={120} style={inputStyle} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Target">
                    <input type="number" inputMode="numeric" min={1} value={target}
                      onChange={e => setTarget(Math.max(0, Number(e.target.value)))} style={inputStyle} />
                  </Field>
                  <Field label="Unit">
                    <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="books, days…" style={inputStyle} />
                  </Field>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Due date &amp; reminders</div>
          <Field label="Due date">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {choices.map(c => (
                <button key={c.iso} type="button" onClick={() => { setPickingDate(false); setDue(c.iso); }} style={chip(!pickingDate && due === c.iso)}>{c.label}</button>
              ))}
              <button type="button" onClick={() => setPickingDate(true)} style={chip(pickingDate)}>
                <Icon name="calendarclock" size={14} color={pickingDate ? '#fff' : 'currentColor'} /> Pick a date
              </button>
            </div>
            {pickingDate && (
              <input type="date" value={due} min={tomorrow} onChange={e => setDue(e.target.value)} style={{ ...inputStyle, marginTop: 10 }} />
            )}
            {pickingDate && due && !dueValid && (
              <div style={{ fontSize: 12, color: '#c53030', fontWeight: 600, marginTop: 6 }}>Pick a date in the future.</div>
            )}
          </Field>
          <Field label="Remind me to log progress">
            <GoalReminderPicker value={reminder} onChange={setReminder} />
          </Field>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>Add milestones after creating the goal to track your progress step by step.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && <button type="button" onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ paddingLeft: 16, paddingRight: 16 }}><Icon name="arrowleft" size={18} /></button>}
        {step < 2
          ? <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 0 ? !pillar : !goalReady} className="btn btn-primary btn-block">Continue</button>
          : <button type="button" onClick={submit} disabled={busy || !dueValid} className="btn btn-primary btn-block"><Icon name="flag" size={17} color="#fff" /> Set this goal</button>}
      </div>
    </div>
  );
}
