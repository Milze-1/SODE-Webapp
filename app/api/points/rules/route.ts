import { createClient, createAdminClient } from '@/lib/supabase-server';

// Active point values, so screens can show what an action is really worth
// (e.g. the devotion button) instead of hard-coded numbers.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await createAdminClient().from('point_rules').select('rule_key,points').eq('is_active', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    rules: Object.fromEntries(((data ?? []) as { rule_key: string; points: number }[]).map(r => [r.rule_key, r.points])),
  });
}
