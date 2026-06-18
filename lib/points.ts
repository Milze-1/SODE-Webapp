export async function awardPoints(
  memberId: string,
  ruleKey: string,
  refTable?: string,
  refId?: string,
  note?: string,
): Promise<number> {
  try {
    const res = await fetch('/api/points/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, ruleKey, refTable, refId, note }),
    });
    if (!res.ok) return 0;
    const json = await res.json() as { awarded?: number };
    return json.awarded ?? 0;
  } catch {
    return 0;
  }
}
