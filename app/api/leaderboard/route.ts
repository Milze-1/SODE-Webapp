import { createClient, createAdminClient } from '@/lib/supabase-server';
import { DEFAULT_CYCLE, type GrowthCycle } from '@/lib/cycle-shared';

// GET /api/leaderboard?period=month|cycle|alltime
//
// Server-side so it can (a) rank by points earned in the period from
// point_events — the tabs used to all show the same all-time list — and
// (b) respect each member's privacy: leaderboard_opt_in = false hides them,
// leaderboard_name replaces their real name.

interface Row { id: string; auth_id: string | null; name: string | null; points: number | null; leaderboard_opt_in: boolean | null; leaderboard_name: string | null }

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const period = new URL(request.url).searchParams.get('period') ?? 'alltime';
  const db = createAdminClient();

  const { data: memberRows } = await db.from('members')
    .select('id, auth_id, name, points, leaderboard_opt_in, leaderboard_name')
    .eq('onboarding_complete', true);
  const members = (memberRows ?? []) as Row[];

  let since: Date | null = null;
  if (period === 'month') {
    // Lagos (UTC+1) calendar month
    const l = new Date(Date.now() + 3600_000);
    since = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - 3600_000);
  } else if (period === 'cycle') {
    const { data: s } = await db.from('app_settings').select('value').eq('key', 'growth_cycle').maybeSingle();
    const cycle = { ...DEFAULT_CYCLE, ...((s?.value ?? {}) as Partial<GrowthCycle>) };
    since = new Date(cycle.start + 'T00:00:00+01:00');
  }

  const totals = new Map<string, number>();
  if (since) {
    // Page through point events in the period and sum per member
    for (let from = 0; ; from += 1000) {
      const { data: ev } = await db.from('point_events').select('member_id, points')
        .gte('created_at', since.toISOString()).range(from, from + 999);
      for (const e of (ev ?? []) as { member_id: string; points: number }[]) totals.set(e.member_id, (totals.get(e.member_id) ?? 0) + (e.points ?? 0));
      if (!ev || ev.length < 1000) break;
    }
  } else {
    for (const m of members) totals.set(m.id, m.points ?? 0);
  }

  const ranked = members
    .map(m => ({ m, points: totals.get(m.id) ?? 0 }))
    .filter(x => x.points > 0)
    .sort((a, b) => b.points - a.points);

  const visible = ranked.filter(x => x.m.leaderboard_opt_in !== false);
  const entries = visible.slice(0, 100).map((x, i) => ({
    rank: i + 1,
    id: x.m.id,
    auth_id: x.m.auth_id,
    name: x.m.leaderboard_name?.trim() || x.m.name || 'Member',
    points: x.points,
  }));

  const me = members.find(m => m.auth_id === user.id);
  const myPoints = me ? (totals.get(me.id) ?? 0) : 0;
  const myRank = me ? visible.findIndex(x => x.m.id === me.id) + 1 : 0;
  return Response.json({
    entries,
    me: me ? {
      id: me.id, auth_id: me.auth_id, name: me.leaderboard_name?.trim() || me.name || '',
      points: myPoints,
      rank: myRank || visible.filter(x => x.points > myPoints).length + 1,
      hidden: me.leaderboard_opt_in === false,
    } : null,
  });
}
