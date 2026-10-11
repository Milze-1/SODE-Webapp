import { createClient, createAdminClient } from '@/lib/supabase-server';

// Lets a member delete their own in-app alerts — all of them, or specific ids.
// Members have no DELETE policy on `reminders` (insert is admin-only so alerts
// can't be forged), so the delete runs with the service role, always scoped to
// the caller's own member_id.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 500) : null;

  const db = createAdminClient();
  const { data: member } = await db.from('members').select('id').eq('auth_id', user.id).maybeSingle();
  if (!member) return Response.json({ error: 'Member not found' }, { status: 404 });

  let query = db.from('reminders').delete({ count: 'exact' }).eq('member_id', member.id);
  if (ids) {
    if (ids.length === 0) return Response.json({ cleared: 0 });
    query = query.in('id', ids);
  }
  const { error, count } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cleared: count ?? 0 });
}
