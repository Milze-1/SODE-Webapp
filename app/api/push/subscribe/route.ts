import { createClient, createAdminClient } from '@/lib/supabase-server';

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as PushSubscriptionJSON;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: memberRow } = await db.from('members').select('id').eq('auth_id', user.id).maybeSingle();
  if (!memberRow) return Response.json({ error: 'Member not found' }, { status: 404 });

  const { error } = await db.from('push_subscriptions').upsert({
    member_id: memberRow.id,
    endpoint:  body.endpoint,
    p256dh:    body.keys.p256dh,
    auth:      body.keys.auth,
  }, { onConflict: 'endpoint' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
