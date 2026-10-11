import { runAllScheduledJobs } from '@/lib/scheduled-jobs';

// Called every minute by Supabase pg_cron (db/migrations/017_tick_scheduler.sql)
// because Vercel Hobby crons can only run once a day at an imprecise time.
// Sends time-based notifications: meeting start, 6am/7am devotion, and each
// goal's reminder time. Safe to call repeatedly — every send is claimed once
// in job_runs.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const allowed = [process.env.TICK_SECRET, process.env.CRON_SECRET].filter(Boolean).map(s => `Bearer ${s}`);
  if (!auth || !allowed.includes(auth)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await runAllScheduledJobs();
  if (result.sessions.length || result.devotion || result.goals) console.log('[cron/tick]', JSON.stringify(result));
  return Response.json(result);
}
