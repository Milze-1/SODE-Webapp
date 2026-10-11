import { createClient, createAdminClient } from '@/lib/supabase-server';
import { sendFirstProfileTaskNotification } from '@/lib/profile-task-server';

// Called by onboarding once the member is in: drops the "Complete your
// profile" task into their notification center and pushes it to any
// subscribed devices. Idempotent — only the first call sends anything.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data: member } = await db
    .from('members')
    .select('id, onboarding_complete, profile_complete')
    .eq('auth_id', user.id)
    .maybeSingle();
  if (!member) return Response.json({ error: 'Member not found' }, { status: 404 });
  if (!member.onboarding_complete || member.profile_complete) return Response.json({ sent: false });

  const sent = await sendFirstProfileTaskNotification(member.id);
  return Response.json({ sent });
}
