import { createAdminClient } from '@/lib/supabase-server';

// Claims (job, key) in public.job_runs. Returns true only for the first
// caller — the primary key makes the insert the lock — so scheduled sends
// happen exactly once even if ticks overlap or retry.
//
// Fails CLOSED: if the table is missing or the insert errors for any other
// reason we return false, because the tick runs every minute and failing
// open would re-send the same notification every minute.
export async function claimRun(job: string, key: string): Promise<boolean> {
  const db = createAdminClient();
  const { error } = await db.from('job_runs').insert({ job, run_key: key });
  if (!error) return true;
  if (error.code !== '23505') console.error(`[job-runs] claim ${job}/${key} failed:`, error.message);
  return false;
}
