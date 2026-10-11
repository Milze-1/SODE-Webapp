import { createAdminClient } from '@/lib/supabase-server';
import { notifyAllMembers, notifyMembers } from '@/lib/notify-server';
import { claimRun } from '@/lib/job-runs';
import { lagosClock, hmToMinutes, type LagosClock } from '@/lib/lagos-time';

// Time-based notification jobs, run by /api/cron/tick every minute.
// Every job claims a (job, key) in job_runs before sending, so each send
// happens exactly once. Windows are a few minutes wide so a delayed or missed
// tick still catches up instead of skipping the notification.

const CATCH_UP_MIN = 15;

const inWindow = (clock: LagosClock, targetMinutes: number) =>
  clock.minutes >= targetMinutes && clock.minutes < targetMinutes + CATCH_UP_MIN;

// ── Meetings: at the scheduled start time ────────────────────────────────────
// Opens check-in (marks the session live) and tells everyone to mark their
// attendance. If an admin already took it live, members were notified then,
// so nothing more is sent.
export async function runSessionStart(now = new Date()): Promise<string[]> {
  const db = createAdminClient();
  const from = new Date(now.getTime() - CATCH_UP_MIN * 60_000).toISOString();
  const to = new Date(now.getTime() + 60_000).toISOString();

  const { data: sessions } = await db
    .from('sessions')
    .select('id, title, location, is_live')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to);

  const done: string[] = [];
  for (const s of (sessions ?? []) as { id: string; title: string; location: string | null; is_live: boolean }[]) {
    if (!(await claimRun('session_start', s.id))) continue;
    if (s.is_live) continue;

    // Same as the admin "Go live" button: one live session at a time
    await db.from('sessions').update({ is_live: false }).eq('is_live', true);
    await db.from('sessions').update({ is_live: true }).eq('id', s.id);

    await notifyAllMembers({
      type: 'session_starting',
      title: `${s.title} is starting now`,
      message: `Check-in is open${s.location ? ` at ${s.location}` : ''} — tap to mark your attendance.`,
      url: `/member/attendance?session=${s.id}`,
      referenceId: s.id,
    });
    done.push(s.id);
  }
  return done;
}

// ── Devotion: 6:00am for everyone, 7:00am follow-up if not done ──────────────
export async function runDevotion(clock: LagosClock): Promise<string | null> {
  if (inWindow(clock, 6 * 60)) {
    if (!(await claimRun('devotion_6am', clock.date))) return null;
    const db = createAdminClient();
    const { data: devotional } = await db
      .from('daily_devotionals')
      .select('title, scripture_ref')
      .eq('devotional_date', clock.date)
      .eq('is_published', true)
      .maybeSingle();
    const message = devotional?.title
      ? `Today's devotion: ${devotional.title}${devotional.scripture_ref ? ` (${devotional.scripture_ref})` : ''}. Start your day with God.`
      : "Today's devotion is ready — start your day with God.";
    await notifyAllMembers({ type: 'devotion_reminder', title: 'Good morning 🙏', message, url: '/member/devotion' });
    return 'devotion_6am';
  }

  if (inWindow(clock, 7 * 60)) {
    if (!(await claimRun('devotion_7am', clock.date))) return null;
    const db = createAdminClient();
    const [{ data: members }, { data: doneRows }] = await Promise.all([
      db.from('members').select('id').eq('onboarding_complete', true),
      db.from('devotion_checkins').select('member_id').eq('checkin_date', clock.date).eq('completed', true),
    ]);
    const done = new Set(((doneRows ?? []) as { member_id: string }[]).map(r => r.member_id));
    const due = ((members ?? []) as { id: string }[]).map(m => m.id).filter(id => !done.has(id));
    await notifyMembers(due, {
      type: 'devotion_followup',
      title: 'Devotion reminder',
      message: "You haven't done today's devotion yet — take a few minutes now and keep your streak going 🔥",
      url: '/member/devotion',
    });
    return 'devotion_7am';
  }
  return null;
}

// ── Goals: at the reminder time each member set on the goal ─────────────────
export async function runGoalReminders(clock: LagosClock): Promise<number> {
  const db = createAdminClient();
  const { data: goals, error } = await db
    .from('goals')
    .select('id, member_id, title, reminder_frequency, reminder_time, reminder_weekday, status')
    .neq('reminder_frequency', 'off')
    .not('reminder_time', 'is', null)
    .not('member_id', 'is', null);
  if (error) { console.error('[tick] goal query failed:', error.message); return 0; }

  let sent = 0;
  for (const g of (goals ?? []) as {
    id: string; member_id: string; title: string; reminder_frequency: string;
    reminder_time: string; reminder_weekday: number | null; status: string | null;
  }[]) {
    if (g.status === 'done' || g.status === 'archived') continue;
    if (g.reminder_frequency === 'weekly' && g.reminder_weekday !== clock.weekday) continue;
    if (!inWindow(clock, hmToMinutes(g.reminder_time))) continue;
    if (!(await claimRun('goal_reminder', `${g.id}:${clock.date}`))) continue;

    await notifyMembers([g.member_id], {
      type: 'goal_checkin',
      title: 'Goal check-in 🎯',
      message: `Time to check in on "${g.title}" — log your progress.`,
      url: '/member/goals',
      referenceId: g.id,
    });
    sent++;
  }
  return sent;
}

export async function runAllScheduledJobs(now = new Date()) {
  const clock = lagosClock(now);
  const [sessions, devotion, goals] = await Promise.all([
    runSessionStart(now).catch(e => { console.error('[tick] sessions failed:', e); return []; }),
    runDevotion(clock).catch(e => { console.error('[tick] devotion failed:', e); return null; }),
    runGoalReminders(clock).catch(e => { console.error('[tick] goals failed:', e); return 0; }),
  ]);
  return { lagos: `${clock.date} ${String(Math.floor(clock.minutes / 60)).padStart(2, '0')}:${String(clock.minutes % 60).padStart(2, '0')}`, sessions, devotion, goals };
}
