import { createClient, createAdminClient } from '@/lib/supabase-server';
import { processReferralOnRegister } from '@/lib/referral';

export async function POST(request: Request) {
  // Verify caller is authenticated as the email they're claiming
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { email, refCode } = await request.json() as { email: string; refCode?: string | null };

  if (!user || user.email?.toLowerCase() !== email?.toLowerCase()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the new member record using admin client to bypass RLS timing issues
  const db = createAdminClient();
  const { data: memberRow } = await db.from('members').select('id').eq('auth_id', user.id).maybeSingle();
  if (!memberRow) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  const result = await processReferralOnRegister({
    newMemberId: memberRow.id as string,
    email,
    refCode,
  });

  return Response.json({ success: true, result });
}
