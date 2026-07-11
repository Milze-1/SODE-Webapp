import { createAdminClient } from '@/lib/supabase-server';
import { processReferralOnRegister } from '@/lib/referral';
import { applyMentorInvite } from '@/lib/mentor-invite';

export async function POST(req: Request) {
  const body = await req.json() as {
    email?: string;
    newMemberId?: string | null;
    authId?: string;
    refCode?: string | null;
  };

  console.log('[on-register] received:', JSON.stringify(body));

  const { email, newMemberId, authId, refCode } = body;

  if (!email && !refCode) {
    console.log('[on-register] No email or refCode — skipping');
    return Response.json({ error: 'Missing params' });
  }

  // Resolve memberId: prefer the value passed directly, fall back to authId lookup
  let resolvedMemberId = newMemberId ?? null;

  if (!resolvedMemberId && authId) {
    console.log('[on-register] newMemberId not provided, looking up by authId:', authId);
    const db = createAdminClient();
    const { data: memberRow } = await db
      .from('members')
      .select('id')
      .eq('auth_id', authId)
      .maybeSingle();

    if (!memberRow) {
      console.error('[on-register] Member not found for authId:', authId);
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }
    resolvedMemberId = memberRow.id as string;
    console.log('[on-register] resolved memberId via authId:', resolvedMemberId);
  }

  if (!resolvedMemberId) {
    console.error('[on-register] Could not resolve memberId');
    return Response.json({ error: 'Could not resolve memberId' }, { status: 400 });
  }

  // Apply a pending external-mentor invite, if one exists for this email
  if (email) {
    try {
      await applyMentorInvite(email, resolvedMemberId);
    } catch (err) {
      console.error('[on-register] mentor invite apply failed (non-fatal):', err);
    }
  }

  try {
    await processReferralOnRegister(email ?? '', resolvedMemberId, refCode ?? null);
    console.log('[on-register] completed successfully');
    return Response.json({ success: true });
  } catch (err) {
    console.error('[on-register] error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
