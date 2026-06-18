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

  // Delete Supabase Auth user first (if linked)
  if (authId) {
    const { error: authError } = await adminClient.auth.admin.deleteUser(authId);
    if (authError) {
      return Response.json({ error: authError.message }, { status: 500 });
    }
  }

  // Delete member record — FK cascades handle related data
  const { error: memberError } = await adminClient.from('members').delete().eq('id', memberId);
  if (memberError) {
    return Response.json({ error: memberError.message }, { status: 500 });
  }

  // Audit trail — graceful if table doesn't exist yet
  try {
    await adminClient.from('audit_log').insert({
      action: 'member_deleted',
      entity_type: 'member',
      entity_id: memberId,
      performed_by: user.id,
      details: { deleted_member_id: memberId, deleted_auth_id: authId ?? null },
    });
  } catch { /* table may not exist yet */ }

  return Response.json({ success: true });
}
