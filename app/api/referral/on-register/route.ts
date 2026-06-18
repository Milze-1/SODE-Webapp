import { createAdminClient } from '@/lib/supabase-server';
import { processReferralOnRegister } from '@/lib/referral';

export async function POST(request: Request) {
  const { email, refCode, authId } = await request.json() as {
    email: string;
    refCode?: string | null;
    authId: string;
  };

  if (!email || !authId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify authId belongs to this email using admin client
  // (avoids session-cookie timing race right after signUp)
  const { data: { user: authUser } } = await db.auth.admin.getUserById(authId);
  if (!authUser || authUser.email?.toLowerCase() !== email.toLowerCase()) {
    console.error('[on-register] Auth check failed for authId:', authId, 'email:', email);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: memberRow } = await db.from('members').select('id').eq('auth_id', authId).maybeSingle();
  if (!memberRow) {
    console.error('[on-register] Member not found for authId:', authId);
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  console.log('[on-register] Processing referral for member:', memberRow.id, 'refCode:', refCode);
  await processReferralOnRegister(email, memberRow.id as string, refCode ?? null);

  return Response.json({ success: true });
}
