import { createClient, createAdminClient } from '@/lib/supabase-server';
import { ROLES, canManageAccess, type Role } from '@/lib/roles';

// Grant / revoke back-office roles.
//
// Done server-side with the service role because the user_roles write policy
// only allows the `director` role — a super_admin (who per lib/roles.ts can
// manage all access) got a row-level-security error from the browser.
// Authorisation is enforced here instead: caller must be super_admin or
// director, and only a super_admin can grant or remove super_admin.

const GRANTABLE = new Set<string>(Object.values(ROLES).filter(r => r !== ROLES.MEMBER));

async function caller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  const db = createAdminClient();
  const { data } = await db.from('user_roles').select('role').eq('user_id', user.id);
  const roles = ((data ?? []) as { role: Role }[]).map(r => r.role);
  if (!canManageAccess(roles)) return { error: Response.json({ error: 'Only a Super Admin or Director can manage access.' }, { status: 403 }) };
  return { user, db, isSuper: roles.includes(ROLES.SUPER_ADMIN) };
}

// List everyone with a back-office role, with their member record.
export async function GET() {
  const c = await caller();
  if ('error' in c) return c.error;
  const { data: roles } = await c.db.from('user_roles').select('user_id, role').neq('role', ROLES.MEMBER).order('role');
  const rows = (roles ?? []) as { user_id: string; role: string }[];
  const authIds = Array.from(new Set(rows.map(r => r.user_id)));
  const { data: members } = authIds.length
    ? await c.db.from('members').select('id, name, email, auth_id').in('auth_id', authIds)
    : { data: [] };
  const byAuth = Object.fromEntries(((members ?? []) as { id: string; name: string; email: string; auth_id: string }[]).map(m => [m.auth_id, m]));
  return Response.json({
    admins: rows.map(r => ({ user_id: r.user_id, role: r.role, member: byAuth[r.user_id] ?? null })),
  });
}

// Assign a role. One role per person: the new role replaces any existing one.
export async function POST(request: Request) {
  const c = await caller();
  if ('error' in c) return c.error;

  const { memberId, role } = await request.json().catch(() => ({})) as { memberId?: string; role?: string };
  if (!memberId || !role || !GRANTABLE.has(role)) return Response.json({ error: 'Choose a member and a valid role.' }, { status: 400 });
  if (role === ROLES.SUPER_ADMIN && !c.isSuper) return Response.json({ error: 'Only a Super Admin can grant Super Admin.' }, { status: 403 });
  if (role === ROLES.DIRECTOR && !c.isSuper) return Response.json({ error: 'Only a Super Admin can grant Director.' }, { status: 403 });

  const { data: member } = await c.db.from('members').select('id, name, email, auth_id').eq('id', memberId).maybeSingle();
  if (!member) return Response.json({ error: 'Member not found.' }, { status: 404 });
  if (!member.auth_id) {
    return Response.json({ error: `${member.name} hasn't created a login yet — they need to sign up before they can be given access.` }, { status: 400 });
  }

  const { data: existing } = await c.db.from('user_roles').select('role').eq('user_id', member.auth_id);
  const current = ((existing ?? []) as { role: string }[]).map(r => r.role);
  if (current.includes(role) && current.length === 1) return Response.json({ error: `${member.name} already has this role.` }, { status: 409 });
  if (current.includes(ROLES.SUPER_ADMIN) && !c.isSuper) return Response.json({ error: "Only a Super Admin can change a Super Admin's access." }, { status: 403 });

  // Insert first, then drop the others — so a failure never leaves them with no access
  if (!current.includes(role)) {
    const { error } = await c.db.from('user_roles').insert({ user_id: member.auth_id, role });
    if (error) {
      console.error('[admin/roles] grant failed:', error.message);
      return Response.json({ error: `Could not grant access: ${error.message}` }, { status: 500 });
    }
  }
  const { error: cleanupErr } = await c.db.from('user_roles').delete().eq('user_id', member.auth_id).neq('role', role);
  if (cleanupErr) console.error('[admin/roles] removing previous role failed:', cleanupErr.message);

  return Response.json({ ok: true, member: { name: member.name, email: member.email }, replaced: current.filter(r => r !== role) });
}

// Remove a role from someone.
export async function DELETE(request: Request) {
  const c = await caller();
  if ('error' in c) return c.error;

  const { userId, role } = await request.json().catch(() => ({})) as { userId?: string; role?: string };
  if (!userId || !role) return Response.json({ error: 'userId and role are required.' }, { status: 400 });
  if (userId === c.user.id) return Response.json({ error: "You can't remove your own access." }, { status: 400 });
  if (role === ROLES.SUPER_ADMIN && !c.isSuper) return Response.json({ error: 'Only a Super Admin can remove Super Admin.' }, { status: 403 });

  const { error } = await c.db.from('user_roles').delete().eq('user_id', userId).eq('role', role);
  if (error) {
    console.error('[admin/roles] revoke failed:', error.message);
    return Response.json({ error: `Could not remove access: ${error.message}` }, { status: 500 });
  }
  return Response.json({ ok: true });
}
