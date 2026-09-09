import { createClient, createAdminClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint } = await request.json() as { endpoint?: string };
  if (!endpoint) return Response.json({ error: 'endpoint required' }, { status: 400 });

  const db = createAdminClient();
  const { data: memberRow } = await db.from('members').select('id').eq('auth_id', user.id).maybeSingle();
  if (!memberRow) return Response.json({ error: 'Member not found' }, { status: 404 });

  // Scope the delete to the caller's own member_id so one member can't
  // delete another's subscription by guessing an endpoint.
  await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('member_id', memberRow.id);
  return Response.json({ ok: true });
}
