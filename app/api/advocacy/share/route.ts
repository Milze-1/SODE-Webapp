import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { awardPointsServer } from '@/lib/points-server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { post_id } = (await request.json()) as { post_id: string };

  const { data: member } = await supabase.from('members').select('id').eq('auth_id', user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  // Try insert with token; if column doesn't exist, insert without
  const { error: insertError } = await supabase.from('advocacy_shares').insert({
    post_id,
    member_id: member.id,
    platform: 'direct',
    token,
    shared_at: new Date().toISOString(),
  });

  if (insertError?.message?.includes('token')) {
    await supabase.from('advocacy_shares').insert({
      post_id, member_id: member.id, platform: 'direct',
    });
  }

  // Increment share_count
  const { data: current } = await supabase.from('advocacy_posts').select('share_count').eq('id', post_id).maybeSingle();
  await supabase.from('advocacy_posts').update({ share_count: (current?.share_count ?? 0) + 1 }).eq('id', post_id);

  // Award points for sharing
  await awardPointsServer({
    memberId: member.id,
    ruleKey: 'advocacy_share',
    refTable: 'advocacy_shares',
    refId: token,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
  return NextResponse.json({ share_url: `${appUrl}/s/${token}`, token });
}
