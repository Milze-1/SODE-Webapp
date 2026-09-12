import { createClient, createAdminClient } from '@/lib/supabase-server';
import { notifyMembers } from '@/lib/notify-server';

const ADMIN_ROLES = new Set([
  'super_admin', 'director', 'spiritual_lead', 'career_lead', 'business_lead',
  'member_care_lead', 'data_ops_lead', 'business_dev', 'external_mentor',
]);

// Notifies members that a piece of learning content just went live. Called
// by the admin learning page right after a save that newly sets
// is_published: true (create-as-published, or an existing draft flipped on).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));
  if (!isAdmin) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const { contentId } = await request.json() as { contentId?: string };
  if (!contentId) return Response.json({ error: 'contentId is required' }, { status: 400 });

  const db = createAdminClient();
  const { data: content } = await db
    .from('learning_content')
    .select('id, title, content_type, pillar')
    .eq('id', contentId)
    .maybeSingle();
  if (!content) return Response.json({ error: 'Content not found' }, { status: 404 });

  let memberQuery = db.from('members').select('id').eq('onboarding_complete', true);
  if (content.pillar) memberQuery = memberQuery.eq('pillar', content.pillar);
  const { data: members } = await memberQuery;
  const memberIds = ((members ?? []) as { id: string }[]).map(m => m.id);

  const result = await notifyMembers(memberIds, {
    type: 'learning_published',
    referenceId: content.id,
    title: 'New learning content',
    message: `New ${content.content_type}: ${content.title}`,
    url: '/member/learning',
  });

  return Response.json({ ok: true, ...result });
}
