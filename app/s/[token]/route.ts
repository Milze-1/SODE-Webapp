import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: share } = await supabase
    .from('advocacy_shares')
    .select('post_id, member_id')
    .eq('token', token)
    .maybeSingle();

  if (!share) return NextResponse.redirect(new URL('/', request.url));

  const { data: post } = await supabase
    .from('advocacy_posts')
    .select('canonical_link, click_count')
    .eq('id', share.post_id)
    .maybeSingle();

  // Track click (fire-and-forget, non-critical)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const ua = request.headers.get('user-agent') ?? '';
    await supabase.from('advocacy_clicks').insert({
      share_token: token,
      ip_hash:     Buffer.from(ip).toString('base64'),
      ua_hash:     Buffer.from(ua).toString('base64'),
      is_bot:      /bot|crawler|spider/i.test(ua),
      created_at:  new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  // Increment click_count
  await supabase.from('advocacy_posts')
    .update({ click_count: (post?.click_count ?? 0) + 1 })
    .eq('id', share.post_id);

  const dest = post?.canonical_link;
  if (!dest) return NextResponse.redirect(new URL('/member/share', request.url));
  const redirectUrl = dest.startsWith('http') ? dest : `https://${dest}`;
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
