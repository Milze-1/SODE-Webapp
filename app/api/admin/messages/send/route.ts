import { createClient, createAdminClient } from '@/lib/supabase-server';
import { getUserRoles, hasAdminAccess } from '@/lib/roles';
import { resolveAudienceMembers, type FormAudience } from '@/lib/forms-audience';
import { sendBulkWhatsApp, personalizeMessage } from '@/lib/whatsapp';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await getUserRoles(user.id);
  if (!hasAdminAccess(roles)) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const { message, audience } = await request.json() as { message?: string; audience?: FormAudience };
  if (!message?.trim()) return Response.json({ error: 'Message is required' }, { status: 400 });
  if (!audience) return Response.json({ error: 'Audience is required' }, { status: 400 });

  const db = createAdminClient();
  const members = await resolveAudienceMembers(db, audience);
  if (members.length === 0) {
    return Response.json({ error: 'No members with a WhatsApp number match this audience' }, { status: 400 });
  }

  const { sent, failed } = await sendBulkWhatsApp(members, m => personalizeMessage(message, m));

  await db.from('group_messages').insert({
    sender_id: user.id,
    body: message,
    audience,
    recipient_count: members.length,
    sent_count: sent,
    failed_count: failed,
  });

  return Response.json({ ok: true, recipientCount: members.length, sent, failed });
}
