import { createClient, createAdminClient } from '@/lib/supabase-server';

// Default values for rules to ensure absolute robustness even if db rule is missing
export const DEFAULT_POINT_RULES: Record<string, number> = {
  win_submitted: 5,
  win_verified: 10,
  goal_progress: 2,
  goal_completed: 20,
  goal_completed_verified: 25,
  attendance_present: 10,
  pulse_survey_completed: 5,
  form_response_submitted: 3,
  course_completed: 15,
  course_completed_verified: 20,
  onboarding_complete: 10,
  invite_sent: 2,
  invite_opened: 5,
  invite_joined: 25,
  invite_attended: 50,
  invite_active: 100,
  advocacy_share: 5,
  advocacy_click: 2,
  devotion_checkin: 5,
  devotion_full_day: 10,
  devotion_streak_7: 25,
  devotion_streak_30: 100,
  form_submitted: 3,
  content_completed: 10,
  community_goal_completed: 30,

  // Compatibility fallbacks
  goal_complete: 20,
  goal_step_completed: 2,
  goal_update_added: 2,
  win: 5,
  referral_joined: 25,
  member_joined: 10,
  referral_attended: 50,
  referral_five_meetings: 100,
  member_registered: 0,
};

function capPeriodStart(period: string): Date {
  const now = new Date();
  if (period === 'day')   return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week')  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'cycle') return new Date('2026-01-01');
  return new Date(0);
}

export async function awardPointsServer(params: {
  memberId?: string;
  ruleKey: string;
  refTable?: string;
  refId?: string;
  note?: string;
  authId?: string;
  sourceId?: string;
  sourceType?: string;
}) {
  const { memberId, ruleKey, refTable, refId, note, authId, sourceId, sourceType } = params;
  const effectiveRefId    = sourceId    ?? refId;
  const effectiveRefTable = sourceType  ?? refTable;

  const db = createAdminClient();

  // Auth resolution
  let userId: string | undefined;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id;
  } catch {
    // Session context may not be available (e.g. background job/cron/registration)
  }

  if (!userId && authId) {
    const { data: authData } = await db.auth.admin.getUserById(authId);
    if (authData?.user) userId = authId;
  }

  if (!userId) {
    console.error('[awardPointsServer] No user resolved — unauthorized');
    return { error: 'Unauthorized', status: 401 };
  }

  // 1. Get the current logged-in user's member profile
  const { data: currentUserMember } = await db
    .from('members')
    .select('id')
    .eq('auth_id', userId)
    .maybeSingle();

  // 2. Determine target member ID
  let targetMemberId = memberId;
  if (!targetMemberId) {
    if (!currentUserMember) {
      console.error('[awardPointsServer] Current user member profile not found');
      return { error: 'Member not found', status: 404 };
    }
    targetMemberId = currentUserMember.id;
  }

  // 3. Authorization check
  let isAuthorized = false;
  if (currentUserMember && targetMemberId === currentUserMember.id) {
    isAuthorized = true; // Awarding to self is always allowed
  } else {
    // Awarding to someone else: must be a leader (non-member role)
    const { data: roles } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const isLeader = (roles ?? []).some((r) => r.role !== 'member');
    if (isLeader) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.error('[awardPointsServer] User is not authorized to award points to target:', targetMemberId);
    return { error: 'Forbidden', status: 403 };
  }

  // 4. Fetch the target member's points
  const { data: memberRow } = await db
    .from('members')
    .select('id, points')
    .eq('id', targetMemberId)
    .maybeSingle();

  if (!memberRow) {
    console.error('[awardPointsServer] Target member not found:', targetMemberId);
    return { error: 'Member not found', status: 404 };
  }

  console.log('[awardPointsServer] processing for:', { memberId: memberRow.id, ruleKey, effectiveRefTable, effectiveRefId });

  // 5. Look up active rule from database
  const { data: rule } = await db
    .from('point_rules')
    .select('points, cap, cap_period, is_active')
    .eq('rule_key', ruleKey)
    .eq('is_active', true)
    .maybeSingle();

  // Determine points value (fall back to static rule mapping if missing in DB)
  let pts: number;
  let cap: number | null = null;
  let capPeriod: string | null = null;

  if (rule) {
    pts = rule.points;
    cap = rule.cap;
    capPeriod = rule.cap_period;
  } else {
    const fallbackPts = DEFAULT_POINT_RULES[ruleKey];
    if (fallbackPts === undefined) {
      console.warn('[awardPointsServer] no active rule or fallback found for:', ruleKey);
      return { awarded: 0 };
    }
    pts = fallbackPts;
    console.log('[awardPointsServer] fell back to local points value:', pts, 'for ruleKey:', ruleKey);
  }

  // 6. Idempotency check: prevent double-awarding for same source record
  if (effectiveRefId) {
    const { data: existing } = await db
      .from('point_events')
      .select('id')
      .eq('member_id', memberRow.id)
      .eq('rule_key', ruleKey)
      .eq('ref_id', effectiveRefId)
      .maybeSingle();
    if (existing) {
      console.log('[awardPointsServer] Already awarded:', ruleKey, effectiveRefId);
      return { awarded: 0 };
    }
  }

  // 7. Cap check
  if (cap) {
    const since = capPeriodStart(capPeriod ?? 'day').toISOString();
    const { count } = await db
      .from('point_events')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberRow.id)
      .eq('rule_key', ruleKey)
      .gte('created_at', since);
    if ((count ?? 0) >= cap) {
      console.log('[awardPointsServer] Cap reached:', ruleKey, count, '/', cap);
      return { awarded: 0 };
    }
  }

  // 8. Insert ledger event
  console.log('[awardPointsServer] inserting point_event for member:', memberRow.id, 'rule:', ruleKey, 'pts:', pts);
  const { error: insertError } = await db.from('point_events').insert({
    member_id:  memberRow.id,
    rule_key:   ruleKey,
    points:     pts,
    ref_table:  effectiveRefTable ?? null,
    ref_id:     effectiveRefId   ?? null,
    note:       note ?? null,
  });

  if (insertError) {
    console.error('[awardPointsServer] insert error:', insertError);
    return { error: insertError.message, status: 500 };
  }

  // 9. Update members.points
  const newPoints = (memberRow.points ?? 0) + pts;
  await db.from('members').update({ points: newPoints }).eq('id', memberRow.id);

  // 10. Sync user_points_balance
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
  // 11. Trigger referral milestone checks if this is an attendance check-in
  if (ruleKey === 'attendance_present') {
    try {
      const { processReferralOnAttendance } = await import('./referral');
      await processReferralOnAttendance(memberRow.id);
    } catch (refErr) {
      console.error('[awardPointsServer] failed to process referral milestones:', refErr);
    }
  }

  console.log('[awardPointsServer] Awarded', pts, 'to', memberRow.id, 'for', ruleKey);
  return { awarded: pts };
}