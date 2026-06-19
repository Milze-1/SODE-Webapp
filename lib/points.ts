import { createClient } from '@/lib/supabase';

export async function awardPoints(
  memberId: string,
  ruleKey: string,
  refTable?: string,
  refId?: string,
  note?: string,
): Promise<number> {
  try {
    // Always include authId so the route can fall back to it if the session
    // cookie is not yet established (e.g. right after sign-up).
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const res = await fetch('/api/points/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, ruleKey, refTable, refId, note, authId: user?.id }),
    });
    if (!res.ok) return 0;
    const json = await res.json() as { awarded?: number };
    return json.awarded ?? 0;
  } catch {
    return 0;
  }
}
