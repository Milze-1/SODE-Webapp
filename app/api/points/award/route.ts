import { NextRequest, NextResponse } from 'next/server';
import { awardPointsServer } from '@/lib/points-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      memberId?: string;
      ruleKey: string;
      refTable?: string;
      refId?: string;
      note?: string;
      authId?: string;
      sourceId?: string;
      sourceType?: string;
    };

    const result = await awardPointsServer(body);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[awardPoints API] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}

