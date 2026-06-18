import { createClient, createAdminClient } from '@/lib/supabase-server';
import { processReferralOnAttendance } from '@/lib/referral';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberId } = await request.json() as { memberId: string };
  if (!memberId) return Response.json({ error: 'memberId required' }, { status: 400 });

  // Verify the memberId belongs to the caller
  const db = createAdminClient();
  const { data: memberRow } = await db.from('members').select('id').eq('id', memberId).eq('auth_id', user.id).maybeSingle();
  if (!memberRow) return Response.json({ error: 'Forbidden' }, { status: 403 });

  await processReferralOnAttendance(memberId);
  return Response.json({ success: true });
}
