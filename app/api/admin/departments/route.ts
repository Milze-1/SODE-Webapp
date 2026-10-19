import { requireAdmin } from '@/lib/admin-auth';

// Save the church departments list (app_settings.departments).
export async function PUT(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;

  const { departments } = await request.json().catch(() => ({})) as { departments?: unknown };
  if (!Array.isArray(departments)) return Response.json({ error: 'departments must be a list' }, { status: 400 });
  const seen = new Set<string>();
  const clean = departments
    .filter((d): d is string => typeof d === 'string')
    .map(d => d.trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter(d => d && !seen.has(d.toLowerCase()) && seen.add(d.toLowerCase()));
  if (clean.length === 0) return Response.json({ error: 'Keep at least one department.' }, { status: 400 });
  if (clean.length > 60) return Response.json({ error: 'That is a lot of departments — keep it under 60.' }, { status: 400 });

  const { error } = await a.db.from('app_settings').upsert({
    key: 'departments', value: clean, updated_at: new Date().toISOString(), updated_by: a.userId,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, departments: clean });
}
