import { requireAdmin } from '@/lib/admin-auth';
import { computeKpis, type KpiOverride } from '@/lib/kpis-server';

// GET  → live scorecard KPIs (lib/kpis-server.ts)
// POST { id, tgt?, value? } → set a KPI's target and/or a manual value
export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  try {
    return Response.json(await computeKpis());
  } catch (e) {
    console.error('[admin/kpis] failed:', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { id, tgt, value } = await request.json().catch(() => ({})) as { id?: string; tgt?: number; value?: number | null };
  if (!id || !/^k\d+$/.test(id)) return Response.json({ error: 'Unknown KPI' }, { status: 400 });
  if (tgt !== undefined && (!Number.isFinite(tgt) || tgt <= 0)) return Response.json({ error: 'Target must be a positive number.' }, { status: 400 });
  if (value !== undefined && value !== null && !Number.isFinite(value)) return Response.json({ error: 'Value must be a number.' }, { status: 400 });

  const { data: row } = await a.db.from('app_settings').select('value').eq('key', 'kpi_overrides').maybeSingle();
  const all = (row?.value ?? {}) as Record<string, KpiOverride>;
  const next: KpiOverride = { ...(all[id] ?? {}) };
  if (tgt !== undefined) next.tgt = tgt;
  if (value !== undefined) {
    if (value === null) delete next.value; else next.value = value;
    next.asof = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const { error } = await a.db.from('app_settings').upsert({ key: 'kpi_overrides', value: { ...all, [id]: next }, updated_at: new Date().toISOString(), updated_by: a.userId });
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return Response.json({ error: missing ? 'Run migration 018 in Supabase to save KPI targets.' : error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
