import { createClient, createAdminClient } from '@/lib/supabase-server';

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const canDelete = (roles ?? []).some(
    (r: { role: string }) => r.role === 'director' || r.role === 'data_ops_lead',
  );
  if (!canDelete) {
    return Response.json({ error: 'Only Directors and Data Ops can delete accounts' }, { status: 403 });
  }

  const { memberId, authId } = await request.json() as { memberId: string; authId: string | null };
  if (!memberId) {
    return Response.json({ error: 'memberId required' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // 1. Reset invitations this member was invited through
  //    (so the invitation can be re-used or re-linked if the person re-registers)
  await adminClient
    .from('invitations')
    .update({
      invited_member_id: null,
      stage: 'sent',
      stage_updated_at: new Date().toISOString(),
    })
    .eq('invited_member_id', memberId);

  // 2. Null out inviter_id on invitations this member sent
  //    (preserve the invitation history but unlink the deleted member)
  await adminClient
    .from('invitations')
    .update({ inviter_id: null })
    .eq('inviter_id', memberId);

  // 3. Delete point events
  await adminClient
    .from('point_events')
    .delete()
    .eq('member_id', memberId);

  // 4. Delete points balance cache
  await adminClient
    .from('user_points_balance')
    .delete()
    .eq('member_id', memberId);

  // 5. Delete push subscriptions
  try {
    await adminClient
      .from('push_subscriptions')
      .delete()
      .eq('member_id', memberId);
  } catch { /* table may not exist */ }

  // 6. Delete goal steps
  try {
    await adminClient
      .from('goal_steps')
      .delete()
      .eq('member_id', memberId);
  } catch { /* table may not exist */ }

  // 7. Delete devotion data
  await adminClient
    .from('devotion_checkins')
    .delete()
    .eq('member_id', memberId);

  await adminClient
    .from('devotion_plans')
    .delete()
    .eq('member_id', memberId);

  await adminClient
    .from('bible_reading_plans')
    .delete()
    .eq('member_id', memberId);

  // 8. Delete cell memberships
  await adminClient
    .from('cell_members')
    .delete()
    .eq('member_id', memberId);

  // 9. Delete mentor pairings (both as mentor and mentee)
  await adminClient
    .from('mentor_pairings')
    .delete()
    .or(`mentor_id.eq.${memberId},mentee_id.eq.${memberId}`);

  // 10. Delete community goal assignments
  try {
    await adminClient
      .from('member_community_goals')
      .delete()
      .eq('member_id', memberId);
  } catch { /* table may not exist */ }

  // 11. Delete advocacy shares
  await adminClient
    .from('advocacy_shares')
    .delete()
    .eq('member_id', memberId);

  // 12. Delete user roles
  if (authId) {
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', authId);
  }

  // 13. Delete the member record
  const { error: memberError } = await adminClient
    .from('members')
    .delete()
    .eq('id', memberId);

  if (memberError) {
    return Response.json({ error: memberError.message }, { status: 500 });
  }

  // 14. Delete auth user LAST (after all FK-dependent rows are gone)
  if (authId) {
    const { error: authError } = await adminClient.auth.admin.deleteUser(authId);
    if (authError) {
      // Member row is already deleted — log but don't fail the request
      console.error('[delete-member] Auth user delete failed:', authError.message);
    }
  }

  // Audit trail
  try {
    await adminClient.from('audit_log').insert({
      action: 'member_deleted',
      entity_type: 'member',
      entity_id: memberId,
      performed_by: user.id,
      details: { deleted_member_id: memberId, deleted_auth_id: authId ?? null },
    });
  } catch { /* table shape may differ */ }

  return Response.json({ success: true });
}
