import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';

function capPeriodStart(period: string): Date {
  const now = new Date();
  if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'cycle') return new Date('2026-01-01');
  return new Date(0);
}

export async function POST(req: NextRequest) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberId, ruleKey, refTable, refId, note } = await req.json() as {
    memberId: string;
    ruleKey: string;
    refTable?: string;
    refId?: string;
    note?: string;
  };

  const db = createAdminClient();

  console.log('[awardPoints] called with:', { memberId, ruleKey, refTable, refId });

  // Verify member belongs to this user
  const { data: memberRow } = await db
    .from('members')
    .select('id, points')
    .eq('id', memberId)
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!memberRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Look up active rule
  const { data: rule } = await db
    .from('point_rules')
    .select('points, cap, cap_period, is_active')
    .eq('rule_key', ruleKey)
    .eq('is_active', true)
    .maybeSingle();

  if (!rule) {
    console.warn('[awardPoints] no active rule found for:', ruleKey);
    return NextResponse.json({ awarded: 0 });
  }
  console.log('[awardPoints] rule found:', rule);

  const pts: number = rule.points;

  // Idempotency: prevent double-awarding for the same source record
  if (refTable && refId) {
    const { data: existing } = await db
      .from('point_events')
      .select('id')
      .eq('member_id', memberId)
      .eq('rule_key', ruleKey)
      .eq('ref_table', refTable)
      .eq('ref_id', refId)
      .maybeSingle();
    if (existing) return NextResponse.json({ awarded: 0 });
  }

  // Cap check
  if (rule.cap) {
    const since = capPeriodStart(rule.cap_period ?? 'day').toISOString();
    const { count } = await db
      .from('point_events')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('rule_key', ruleKey)
      .gte('created_at', since);
    if ((count ?? 0) >= rule.cap) return NextResponse.json({ awarded: 0 });
  }

  // Insert ledger event
  console.log('[awardPoints] inserting point_event for member:', memberId, 'rule:', ruleKey, 'pts:', pts);
  const { error: insertError } = await db.from('point_events').insert({
    member_id: memberId,
    rule_key: ruleKey,
    points: pts,
    ref_table: refTable ?? null,
    ref_id: refId ?? null,
    note: note ?? null,
  });

  if (insertError) console.error('[awardPoints] insert error:', insertError);
  else console.log('[awardPoints] insert ok, pts awarded:', pts);

  // Increment members.points (denormalized cache for leaderboard ordering)
  await db.from('members').update({ points: (memberRow.points ?? 0) + pts }).eq('id', memberId);

  // Upsert user_points_balance
  const { data: bal } = await db
    .from('user_points_balance')
    .select('total_points, this_month_points')
    .eq('member_id', memberId)
    .maybeSingle();

  const now = new Date().toISOString();
  await db.from('user_points_balance').upsert({
    member_id: memberId,
    total_points: (bal?.total_points ?? 0) + pts,
    this_month_points: (bal?.this_month_points ?? 0) + pts,
    last_recalc_at: now,
    updated_at: now,
  });

  return NextResponse.json({ awarded: pts });
}
