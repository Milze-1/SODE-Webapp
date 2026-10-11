import { createAdminClient } from '@/lib/supabase-server';
import { notifyMembers } from '@/lib/notify-server';

// "Complete your profile" task notifications. The first one goes out right
// after onboarding (see /api/notify/profile-task); follow-ups are sent by the
// daily cron until the task is done. The count/last-sent of previous sends
// drives the schedule (see sendHistory below).

const TASK_URL = '/member/profile/complete';

// Gap (in days) required since the previous reminder before sending the next
// one: #1 immediately, #2 a day later, #3 two days after that, #4 four days
// after that — roughly day 0, 1, 3 and 7. Nothing after the fourth.
const FOLLOW_UP_GAPS_DAYS = [1, 2, 4];
const MAX_REMINDERS = FOLLOW_UP_GAPS_DAYS.length + 1;

const MESSAGES = [
  { title: 'One more step 🎯', message: 'Complete your profile so we can match you with a mentor — it takes about 3 minutes.' },
  { title: 'Your mentor is waiting', message: "You're almost there — finish your profile to get matched with a mentor." },
  { title: 'Finish your profile', message: 'A few quick questions stand between you and your SODE mentor. Pick up where you left off.' },
  { title: 'Last reminder', message: 'Complete your profile to unlock mentor matching. Tap to finish it now.' },
];

// Sends are recorded in job_runs as ('profile_task', '<member>:<n>') so the
// schedule survives members clearing their Alerts. Older sends only exist as
// `reminders` rows, so history takes whichever source shows more.
async function sendHistory(memberIds: string[]): Promise<Record<string, { count: number; last: number }>> {
  const db = createAdminClient();
  const history: Record<string, { count: number; last: number }> = {};
  const bump = (memberId: string, at: string, src: 'r' | 'j', counts: Record<string, { r: number; j: number }>) => {
    const h = history[memberId] ?? { count: 0, last: 0 };
    h.last = Math.max(h.last, new Date(at).getTime());
    history[memberId] = h;
    const c = (counts[memberId] ??= { r: 0, j: 0 });
    c[src]++;
  };
  const counts: Record<string, { r: number; j: number }> = {};
  const wanted = new Set(memberIds);

  for (let i = 0; i < memberIds.length; i += 200) {
    const { data } = await db.from('reminders').select('member_id, created_at')
      .eq('type', 'profile_incomplete').in('member_id', memberIds.slice(i, i + 200));
    for (const r of (data ?? []) as { member_id: string; created_at: string }[]) bump(r.member_id, r.created_at, 'r', counts);
  }
  const { data: runs } = await db.from('job_runs').select('run_key, created_at').eq('job', 'profile_task');
  for (const r of (runs ?? []) as { run_key: string; created_at: string }[]) {
    const memberId = r.run_key.split(':')[0];
    if (wanted.has(memberId)) bump(memberId, r.created_at, 'j', counts);
  }
  for (const [id, c] of Object.entries(counts)) history[id].count = Math.max(c.r, c.j);
  return history;
}

async function recordSends(memberIds: string[], index: number) {
  if (memberIds.length === 0) return;
  await createAdminClient().from('job_runs').upsert(
    memberIds.map(id => ({ job: 'profile_task', run_key: `${id}:${index}` })),
    { onConflict: 'job,run_key', ignoreDuplicates: true },
  );
}

export async function sendFirstProfileTaskNotification(memberId: string): Promise<boolean> {
  const history = await sendHistory([memberId]);
  if ((history[memberId]?.count ?? 0) > 0) return false;

  await notifyMembers([memberId], { type: 'profile_incomplete', url: TASK_URL, ...MESSAGES[0] });
  await recordSends([memberId], 0);
  return true;
}

export async function sendProfileTaskReminders(): Promise<{ sent: number }> {
  const db = createAdminClient();
  const { data: members } = await db
    .from('members')
    .select('id')
    .eq('onboarding_complete', true)
    .eq('profile_complete', false);
  const ids = ((members ?? []) as { id: string }[]).map(m => m.id);
  if (ids.length === 0) return { sent: 0 };

  const history = await sendHistory(ids);

  // Group due members by which reminder number they're on, so each batch
  // gets the right wording.
  const now = Date.now();
  const dueByIndex: Record<number, string[]> = {};
  for (const id of ids) {
    const h = history[id] ?? { count: 0, last: 0 };
    if (h.count >= MAX_REMINDERS) continue;
    if (h.count > 0) {
      const gapMs = FOLLOW_UP_GAPS_DAYS[h.count - 1] * 24 * 60 * 60 * 1000;
      // small tolerance so a daily cron doesn't drift a day late
      if (now - h.last < gapMs - 60 * 60 * 1000) continue;
    }
    (dueByIndex[h.count] ??= []).push(id);
  }

  let sent = 0;
  for (const [idx, memberIds] of Object.entries(dueByIndex)) {
    const { notified } = await notifyMembers(memberIds, { type: 'profile_incomplete', url: TASK_URL, ...MESSAGES[Number(idx)] });
    await recordSends(memberIds, Number(idx));
    sent += notified;
  }
  return { sent };
}
