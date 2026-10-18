import { createClient, createAdminClient } from '@/lib/supabase-server';
import { hasAdminAccess, type Role } from '@/lib/roles';

// For admin API routes: confirms the caller is signed in with a back-office
// role and returns a service-role client. Reads roles with the service role so
// a Super Admin isn't filtered out by older RLS policies that only know
// `director`.
export async function requireAdmin(): Promise<
  | { ok: true; userId: string; roles: Role[]; db: ReturnType<typeof createAdminClient> }
  | { ok: false; response: Response }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  const db = createAdminClient();
  const { data } = await db.from('user_roles').select('role').eq('user_id', user.id);
  const roles = ((data ?? []) as { role: Role }[]).map(r => r.role);
  if (!hasAdminAccess(roles)) return { ok: false, response: Response.json({ error: 'Admin access required' }, { status: 403 }) };
  return { ok: true, userId: user.id, roles, db };
}
