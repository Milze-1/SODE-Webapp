import { createClient, createAdminClient } from '@/lib/supabase-server';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data: memberRow } = await db.from('members').select('id').eq('auth_id', user.id).maybeSingle();
  if (!memberRow) return Response.json({ error: 'Member not found' }, { status: 404 });

  const memberId = memberRow.id as string;

  // Check for existing code
  const { data: existing } = await db.from('referral_codes').select('code').eq('member_id', memberId).maybeSingle();
  if (existing) return Response.json({ code: existing.code });

  // Create new code (retry once on collision)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const { error } = await db.from('referral_codes').insert({ member_id: memberId, code });
    if (!error) return Response.json({ code });
  }

  return Response.json({ error: 'Could not generate code' }, { status: 500 });
}
