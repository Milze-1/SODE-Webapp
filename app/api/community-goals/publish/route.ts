import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { type FormAudience } from '@/lib/forms-audience';

export async function POST(req: NextRequest) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();

  // Verify caller is an admin (check user_roles OR service role)
  const { data: roleRow } = await db
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!roleRow) {
    console.warn('[publish] User', user.id, 'has no role row — blocking publish');
    return NextResponse.json({ error: 'Forbidden: no admin role found for this user' }, { status: 403 });
  }

  const body = await req.json() as { goalId: string };
  const { goalId } = body;
  console.log('[publish] Publishing goal:', goalId, 'by user:', user.id, 'role:', roleRow.role);

  // Load the goal
  const { data: goal, error: goalErr } = await db
    .from('goals')
    .select('id, title, pillar, due_date, audience, is_published, goal_type')
    .eq('id', goalId)
    .eq('goal_type', 'community')
    .maybeSingle();

  if (goalErr || !goal) {
    console.error('[publish] Goal not found:', goalErr);
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  }

  const audience = (goal.audience ?? { type: 'everyone' }) as FormAudience;
  console.log('[publish] Audience:', JSON.stringify(audience));

  // Build member query server-side by audience type (avoids JS-side filtering issues)
  let memberQuery = db
    .from('members')
    .select('id, email, name, pillar, life_stage')
    .eq('onboarding_complete', true);

  if (audience.type === 'pillar' && audience.pillars?.length) {
    memberQuery = memberQuery.in('pillar', audience.pillars);
  } else if (audience.type === 'life_stage' && audience.stages?.length) {
    memberQuery = memberQuery.in('life_stage', audience.stages);
  } else if (audience.type === 'specific' && audience.member_ids?.length) {
    memberQuery = memberQuery.in('id', audience.member_ids);
  }
  // 'everyone' and 'cell' (unsupported server-side) → no extra filter → all onboarded members

  const { data: members, error: membersErr } = await memberQuery;
  console.log('[publish] Matched members:', members?.length ?? 0, membersErr ? 'error:' + membersErr.message : '');

  // Upsert member_community_goals rows
  let assignedCount = 0;
  if (members && members.length > 0) {
    const rows = members.map(m => ({
      goal_id: goalId,
      member_id: m.id,
      current_value: 0,
      status: 'not_started',
    }));

    const { data: inserted, error: upsertErr } = await db
      .from('member_community_goals')
      .upsert(rows, { onConflict: 'goal_id,member_id', ignoreDuplicates: true })
      .select('id');

    if (upsertErr) {
      console.error('[publish] Upsert error:', JSON.stringify(upsertErr, null, 2));
      return NextResponse.json({ error: 'Failed to assign members: ' + upsertErr.message }, { status: 500 });
    }

    assignedCount = inserted?.length ?? rows.length;
    console.log('[publish] Upserted rows:', assignedCount);
  }

  // Mark goal as published
  const { error: updateErr } = await db.from('goals').update({
    is_published: true,
    published_at: new Date().toISOString(),
  }).eq('id', goalId);

  if (updateErr) {
    console.error('[publish] Failed to mark published:', updateErr);
  }

  // Send notification emails (fire-and-forget, don't block on failure)
  const memberEmails = (members ?? []).map(m => m.email).filter(Boolean) as string[];
  if (memberEmails.length > 0) {
    const { data: adminProfile } = await db
      .from('user_roles')
      .select('members(name)')
      .eq('user_id', user.id)
      .maybeSingle();
    const adminName = (adminProfile as unknown as { members: { name: string } | null })?.members?.name ?? 'SODE Admin';

    fetch(new URL('/api/notify/community-goal', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId,
        goalTitle: goal.title,
        pillar: goal.pillar,
        deadline: goal.due_date,
        adminName,
        memberEmails,
      }),
    }).catch(e => console.warn('[publish] Email notify failed (non-fatal):', e));
  }

  console.log('[publish] Done. assigned:', assignedCount);
  return NextResponse.json({ ok: true, assigned: assignedCount });
}
