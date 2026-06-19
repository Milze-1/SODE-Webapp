import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';

function capPeriodStart(period: string): Date {
  const now = new Date();
  if (period === 'day')   return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week')  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'cycle') return new Date('2026-01-01');
  return new Date(0);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    memberId?: string;    // internal member UUID — passed by lib/points.ts callers
    ruleKey: string;
    refTable?: string;
    refId?: string;
    note?: string;
    authId?: string;      // auth user UUID — fallback when session cookie not yet established
    sourceId?: string;    // alias for refId (new callers)
    sourceType?: string;  // alias for refTable (new callers)
  };

  const { memberId, ruleKey, refTable, refId, note, authId, sourceId, sourceType } = body;
  const effectiveRefId    = sourceId    ?? refId;
  const effectiveRefTable = sourceType  ?? refTable;

  const db = createAdminClient();

  // Auth resolution: session cookie first, then authId body param
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  let userId = user?.id;

  if (!userId && authId) {
    const { data: authData } = await db.auth.admin.getUserById(authId);
    if (authData.user) userId = authId;
  }

  if (!userId) {
    console.error('[awardPoints] No user — unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Member lookup: by internal memberId (old callers) or by auth_id (registration / new callers)
  let memberRow: { id: string; points: number } | null = null;

  if (memberId) {
    const { data } = await db
      .from('members')
      .select('id, points')
      .eq('id', memberId)
      .eq('auth_id', userId)
      .maybeSingle();
    memberRow = data as { id: string; points: number } | null;
  } else {
    const { data } = await db
      .from('members')
      .select('id, points')
      .eq('auth_id', userId)
      .maybeSingle();
    memberRow = data as { id: string; points: number } | null;
  }

  if (!memberRow) {
    console.error('[awardPoints] Member not found for userId:', userId);
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  console.log('[awardPoints] called with:', { memberId: memberRow.id, ruleKey, effectiveRefTable, effectiveRefId });

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
  if (effectiveRefId) {
    const { data: existing } = await db
      .from('point_events')
      .select('id')
      .eq('member_id', memberRow.id)
      .eq('rule_key', ruleKey)
      .eq('ref_id', effectiveRefId)
      .maybeSingle();
    if (existing) {
      console.log('[awardPoints] Already awarded:', ruleKey, effectiveRefId);
      return NextResponse.json({ awarded: 0 });
    }
  }

  // Cap check
  if (rule.cap) {
    const since = capPeriodStart(rule.cap_period ?? 'day').toISOString();
    const { count } = await db
      .from('point_events')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberRow.id)
      .eq('rule_key', ruleKey)
      .gte('created_at', since);
    if ((count ?? 0) >= rule.cap) {
      console.log('[awardPoints] Cap reached:', ruleKey, count, '/', rule.cap);
      return NextResponse.json({ awarded: 0 });
    }
  }

  // Insert ledger event
  console.log('[awardPoints] inserting point_event for member:', memberRow.id, 'rule:', ruleKey, 'pts:', pts);
  const { error: insertError } = await db.from('point_events').insert({
    member_id:  memberRow.id,
    rule_key:   ruleKey,
    points:     pts,
    ref_table:  effectiveRefTable ?? null,
    ref_id:     effectiveRefId   ?? null,
    note:       note ?? null,
  });

  if (insertError) {
    console.error('[awardPoints] insert error:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  console.log('[awardPoints] insert ok, pts awarded:', pts);

  // Update members.points (denormalized cache for leaderboard)
  const newPoints = (memberRow.points ?? 0) + pts;
  await db.from('members').update({ points: newPoints }).eq('id', memberRow.id);

  // Sync user_points_balance — total_points tracks members.points exactly (no drift)
  const { data: bal } = await db
    .from('user_points_balance')
    .select('this_month_points')
    .eq('member_id', memberRow.id)
    .maybeSingle();

  const now = new Date().toISOString();
  if (bal) {
    await db.from('user_points_balance').update({
      total_points:      newPoints,
      this_month_points: (bal.this_month_points ?? 0) + pts,
      updated_at:        now,
    }).eq('member_id', memberRow.id);
  } else {
    await db.from('user_points_balance').insert({
      member_id:         memberRow.id,
      total_points:      newPoints,
      this_month_points: pts,
      updated_at:        now,
    });
  }

  console.log('[awardPoints] Awarded', pts, 'to', memberRow.id, 'for', ruleKey);
  return NextResponse.json({ awarded: pts });
}
