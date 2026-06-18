import { NextRequest, NextResponse } from 'next/server';
import { fetchPassage, bibleGatewayUrl } from '@/lib/bible-api';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const passage = await fetchPassage(q.trim());
  if (!passage) {
    return NextResponse.json({ fallbackUrl: bibleGatewayUrl(q.trim()) }, { status: 200 });
  }
  return NextResponse.json(passage);
}
