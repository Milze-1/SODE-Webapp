import { requireAdmin } from '@/lib/admin-auth';
import { syncMemberPoints, reconcileAllPoints } from '@/lib/points-sync';

// POST { memberId, points, reason } → manual award / deduction, recorded in
//   the points ledger (point_events, rule 'manual_adjustment') so totals,
//   leaderboards and reports all agree.
// PUT → recalculate every member's totals from the ledger.

export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { memberId, points, reason } = await request.json().catch(() => ({})) as { memberId?: string; points?: number; reason?: string };
  if (!memberId || !Number.isInteger(points) || points === 0 || Math.abs(points!) > 10000 || !reason?.trim()) {
    return Response.json({ error: 'Choose a member, a whole number of points (not 0) and a reason.' }, { status: 400 });
  }
  const { data: admin } = await a.db.from('members').select('name').eq('auth_id', a.userId).maybeSingle();
  const { error } = await a.db.from('point_events').insert({
    member_id: memberId, rule_key: 'manual_adjustment', points,
    note: `${reason.trim().slice(0, 300)} — by ${admin?.name ?? 'admin'}`,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const totals = await syncMemberPoints(a.db, memberId);
  return Response.json({ ok: true, ...totals });
}

export async function PUT() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  try {
    return Response.json({ ok: true, ...(await reconcileAllPoints(a.db)) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// GET → recent manual adjustments for the Points page log
export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { data } = await a.db.from('point_events')
    .select('id,points,note,created_at,member_id').eq('rule_key', 'manual_adjustment')
    .order('created_at', { ascending: false }).limit(100);
  const ids = Array.from(new Set(((data ?? []) as { member_id: string }[]).map(d => d.member_id)));
  const { data: people } = ids.length ? await a.db.from('members').select('id,name').in('id', ids) : { data: [] };
  const name = Object.fromEntries(((people ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]));
  return Response.json({
    log: ((data ?? []) as { id: string; points: number; note: string | null; created_at: string; member_id: string }[])
      .map(d => ({ id: d.id, delta: d.points, reason: d.note ?? '', created_at: d.created_at, members: { name: name[d.member_id] ?? '—' } })),
  });
}
