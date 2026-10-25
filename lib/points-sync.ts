import { createAdminClient } from '@/lib/supabase-server';

// point_events is the single source of truth for points. members.points and
// user_points_balance (total + this month) are caches derived from it, and
// are always recomputed from the events — never incremented — so they can't
// drift (they had: double-counted onboarding points, and a "this month"
// figure that never reset).

type DB = ReturnType<typeof createAdminClient>;

// Start of the current Lagos (UTC+1) calendar month, as an ISO timestamp
export function lagosMonthStartIso(now = new Date()): string {
  const l = new Date(now.getTime() + 3600_000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - 3600_000).toISOString();
}

export async function syncMemberPoints(db: DB, memberId: string): Promise<{ total: number; month: number }> {
  const monthStart = lagosMonthStartIso();
  let total = 0, month = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('point_events').select('points,created_at').eq('member_id', memberId).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const e of (data ?? []) as { points: number; created_at: string }[]) {
      total += e.points ?? 0;
      if (e.created_at >= monthStart) month += e.points ?? 0;
    }
    if (!data || data.length < 1000) break;
  }
  const now = new Date().toISOString();
  await db.from('members').update({ points: total }).eq('id', memberId);
  await db.from('user_points_balance').upsert(
    { member_id: memberId, total_points: total, this_month_points: month, updated_at: now, last_recalc_at: now },
    { onConflict: 'member_id' },
  );
  return { total, month };
}

// Recompute every member (nightly, via /api/cron/tick). Returns how many
// members' totals had drifted and were corrected.
export async function reconcileAllPoints(db: DB = createAdminClient()): Promise<{ members: number; corrected: number }> {
  const monthStart = lagosMonthStartIso();
  const totals = new Map<string, { total: number; month: number }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('point_events').select('member_id,points,created_at').range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const e of (data ?? []) as { member_id: string; points: number; created_at: string }[]) {
      const t = totals.get(e.member_id) ?? { total: 0, month: 0 };
      t.total += e.points ?? 0;
      if (e.created_at >= monthStart) t.month += e.points ?? 0;
      totals.set(e.member_id, t);
    }
    if (!data || data.length < 1000) break;
  }

  const members: { id: string; points: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('members').select('id,points').range(from, from + 999);
    members.push(...((data ?? []) as { id: string; points: number | null }[]));
    if (!data || data.length < 1000) break;
  }
  const balances = new Map<string, { total_points: number; this_month_points: number }>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('user_points_balance').select('member_id,total_points,this_month_points').range(from, from + 999);
    for (const b of (data ?? []) as { member_id: string; total_points: number; this_month_points: number }[]) balances.set(b.member_id, b);
    if (!data || data.length < 1000) break;
  }

  let corrected = 0;
  const now = new Date().toISOString();
  for (const m of members) {
    const t = totals.get(m.id) ?? { total: 0, month: 0 };
    const b = balances.get(m.id);
    const memberOff = (m.points ?? 0) !== t.total;
    const balanceOff = !b || b.total_points !== t.total || b.this_month_points !== t.month;
    if (!memberOff && !balanceOff) continue;
    if (memberOff) { await db.from('members').update({ points: t.total }).eq('id', m.id); corrected++; }
    if (balanceOff) {
      await db.from('user_points_balance').upsert(
        { member_id: m.id, total_points: t.total, this_month_points: t.month, updated_at: now, last_recalc_at: now },
        { onConflict: 'member_id' },
      );
    }
  }
  return { members: members.length, corrected };
}
