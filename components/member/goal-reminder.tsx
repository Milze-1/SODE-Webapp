'use client';

// Per-goal push reminder (goals.reminder_frequency / reminder_time /
// reminder_weekday, migration 016). Sent by /api/cron/tick at this Lagos time.

export interface GoalReminder { frequency: 'off' | 'daily' | 'weekly'; time: string; weekday: number; }
export const DEFAULT_REMINDER: GoalReminder = { frequency: 'off', time: '19:00', weekday: 1 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const reminderColumns = (r: GoalReminder) => ({
  reminder_frequency: r.frequency,
  reminder_time: r.frequency === 'off' ? null : r.time,
  reminder_weekday: r.frequency === 'weekly' ? r.weekday : null,
});

export const reminderFromRow = (row: { reminder_frequency?: string | null; reminder_time?: string | null; reminder_weekday?: number | null }): GoalReminder => ({
  frequency: (row.reminder_frequency ?? 'off') as GoalReminder['frequency'],
  time: row.reminder_time?.slice(0, 5) ?? DEFAULT_REMINDER.time,
  weekday: row.reminder_weekday ?? DEFAULT_REMINDER.weekday,
});

const fmtTime12 = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export const describeReminder = (r?: GoalReminder) =>
  !r || r.frequency === 'off' ? 'Off'
  : r.frequency === 'daily' ? `daily at ${fmtTime12(r.time)}`
  : `every ${WEEKDAYS[r.weekday]} at ${fmtTime12(r.time)}`;

export function GoalReminderPicker({ value, onChange }: { value: GoalReminder; onChange: (r: GoalReminder) => void }) {
  const chip = (sel: boolean): React.CSSProperties => ({
    padding: '8px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700,
    background: sel ? 'var(--navy)' : 'var(--surface)', color: sel ? '#fff' : 'var(--ink)',
    border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)',
  });
  return (
    <div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {(['off', 'daily', 'weekly'] as const).map(f => (
          <button key={f} type="button" onClick={() => onChange({ ...value, frequency: f })} style={chip(value.frequency === f)}>
            {f === 'off' ? 'Off' : f === 'daily' ? 'Daily' : 'Weekly'}
          </button>
        ))}
      </div>
      {value.frequency === 'weekly' && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => onChange({ ...value, weekday: i })} style={{ ...chip(value.weekday === i), padding: '7px 10px', fontSize: 12.5 }}>{d}</button>
          ))}
        </div>
      )}
      {value.frequency !== 'off' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>at</span>
          <input type="time" value={value.time} onChange={e => e.target.value && onChange({ ...value, time: e.target.value })}
            style={{ height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 16, padding: '0 10px', outline: 'none' }} />
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.45 }}>
        {value.frequency === 'off' ? 'No reminders for this goal.' : `We'll notify you ${describeReminder(value)} (Lagos time) to log your progress.`}
      </p>
    </div>
  );
}
