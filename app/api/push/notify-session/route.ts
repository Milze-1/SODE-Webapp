import { createClient, createAdminClient } from '@/lib/supabase-server';
import { notifyAllMembers } from '@/lib/notify-server';
import { fmtLagos } from '@/lib/lagos-time';

const ADMIN_ROLES = new Set([
  'super_admin', 'director', 'spiritual_lead', 'career_lead', 'business_lead',
  'member_care_lead', 'data_ops_lead', 'business_dev', 'external_mentor',
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));
  if (!isAdmin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const { sessionId, event } = await request.json() as { sessionId?: string; event?: 'created' | 'live' };
  if (!sessionId || (event !== 'created' && event !== 'live')) {
    return Response.json({ error: 'sessionId and a valid event are required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: session } = await db
    .from('sessions')
    .select('id, title, location, scheduled_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const sessionTime = fmtLagos(session.scheduled_at);

  const { title, body } = event === 'live'
    ? {
        title: `${session.title} is live now`,
        body: `Check-in is open${session.location ? ` at ${session.location}` : ''}. Tap to sign attendance.`,
      }
    : {
        title: `New session: ${session.title}`,
        body: `${sessionTime}${session.location ? ` · ${session.location}` : ''}. We'll remind you when it starts so you can mark your attendance.`,
      };

  const result = await notifyAllMembers({
    type: event === 'live' ? 'session_live' : 'session_created',
    title,
    message: body,
    url: `/member/attendance?session=${session.id}`,
    referenceId: session.id,
  });

  return Response.json({ ok: true, ...result });
}
