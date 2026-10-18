import { createClient, createAdminClient } from '@/lib/supabase-server';
import { canManageAccess, type Role } from '@/lib/roles';

// Update the growth cycle (app_settings.growth_cycle). Super Admin / Director.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', user.id);
  if (!canManageAccess(((roles ?? []) as { role: Role }[]).map(r => r.role))) {
    return Response.json({ error: 'Only a Super Admin or Director can change the cycle.' }, { status: 403 });
  }

  const { label, start, months } = await request.json().catch(() => ({})) as { label?: string; start?: string; months?: number };
  if (!label?.trim() || !start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(months) || months! < 1 || months! > 36) {
    return Response.json({ error: 'Give the cycle a name, a start date and a length of 1–36 months.' }, { status: 400 });
  }

  const { error } = await db.from('app_settings').upsert({
    key: 'growth_cycle',
    value: { label: label.trim().slice(0, 60), start, months },
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return Response.json({ error: missing ? 'Settings table not set up yet — run migration 018 in Supabase.' : error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
