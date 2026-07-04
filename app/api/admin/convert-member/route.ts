import { createClient, createAdminClient } from '@/lib/supabase-server';
import { awardPointsServer } from '@/lib/points-server';

// Convert a first-timer to a full member.
//
// Done server-side with the service-role client because RLS on `members`
// only allows users to update their OWN row (members_update_own) — an admin
// updating someone else's row from the browser silently affects 0 rows.

const ADMIN_ROLES = new Set([
  'super_admin', 'director', 'spiritual_lead', 'career_lead', 'business_lead',
  'member_care_lead', 'data_ops_lead', 'business_dev', 'external_mentor',
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));
  if (!isAdmin) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { memberId } = await request.json() as { memberId?: string };
  if (!memberId) {
    return Response.json({ error: 'memberId required' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const updatedAt = new Date().toISOString();

  // Try the full update; if the is_first_timer column doesn't exist in this
  // environment, fall back to just completing onboarding.
  let { data, error } = await adminClient
    .from('members')
    .update({ onboarding_complete: true, is_first_timer: false, updated_at: updatedAt })
    .eq('id', memberId)
    .select('id, name, onboarding_complete')
    .maybeSingle();

  if (error && error.code === '42703') {
    ({ data, error } = await adminClient
      .from('members')
      .update({ onboarding_complete: true, updated_at: updatedAt })
      .eq('id', memberId)
      .select('id, name, onboarding_complete')
      .maybeSingle());
  }

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  // Award the "onboarding complete / joined SODE" points the member would
  // have earned by finishing onboarding themselves — but only once ever.
  let pointsAwarded = 0;
  try {
    const { data: alreadyAwarded } = await adminClient
      .from('point_events')
      .select('id')
      .eq('member_id', memberId)
      .eq('rule_key', 'onboarding_complete')
      .limit(1)
      .maybeSingle();

    if (!alreadyAwarded) {
      const result = await awardPointsServer({
        memberId,
        ruleKey: 'onboarding_complete',
        note: 'Converted from first-timer to member by admin',
      });
      pointsAwarded = (result as { awarded?: number }).awarded ?? 0;
    }
  } catch (e) {
    // Points are a bonus — conversion itself already succeeded.
    console.error('[convert-member] points award failed:', e);
  }

  return Response.json({ ok: true, member: data, pointsAwarded });
}
