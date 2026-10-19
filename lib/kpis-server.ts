import { createAdminClient } from '@/lib/supabase-server';
import { DEFAULT_CYCLE, cycleMonth, type GrowthCycle } from '@/lib/cycle-shared';

// Team scorecard KPIs computed from live data (Admin → Scorecard). Targets
// and manual values (KPIs with no data source yet) live in
// app_settings.kpi_overrides and are edited from the KPI drawer.

export type KpiStatus = 'ontrack' | 'atrisk' | 'behind' | 'pending';
export interface Contributor { id: string; name: string; detail: string; status: 'done' | 'ontrack' | 'atrisk' | 'behind' }
export interface LiveKpi {
  id: string; pillar: string; title: string; cur: number | null; tgt: number; unit: string; status: KpiStatus;
  owner: string; asof: string; source: string; trend: number[]; manual: boolean;
  contributorsTitle: string; contributors: Contributor[];
}
export interface KpiOverride { tgt?: number; value?: number; asof?: string }

type DB = ReturnType<typeof createAdminClient>;

const DEFS: { id: string; pillar: string; title: string; tgt: number; unit: string; owner: string; manual?: boolean; percent?: boolean }[] = [
  { id: 'k1', pillar: 'overall', title: 'Membership growth', tgt: 400, unit: 'members', owner: 'Director' },
  { id: 'k2', pillar: 'overall', title: 'Average NPS', tgt: 70, unit: 'score', owner: 'Data & Ops', manual: true },
  { id: 'k3', pillar: 'spiritual', title: 'Devotion consistency', tgt: 80, unit: '%', owner: 'P. Lead · Spiritual', percent: true },
  { id: 'k4', pillar: 'spiritual', title: 'Session attendance', tgt: 85, unit: '%', owner: 'P. Lead · Spiritual', percent: true },
  { id: 'k5', pillar: 'career', title: 'Certifications earned', tgt: 60, unit: 'certs', owner: 'P. Lead · Career' },
  { id: 'k6', pillar: 'career', title: 'Role placements', tgt: 25, unit: 'placed', owner: 'P. Lead · Career', manual: true },
  { id: 'k7', pillar: 'business', title: 'Businesses registered', tgt: 24, unit: 'biz', owner: 'P. Lead · Business' },
  { id: 'k8', pillar: 'business', title: 'First paying customers', tgt: 30, unit: 'biz', owner: 'P. Lead · Business', manual: true },
  { id: 'k9', pillar: 'character', title: 'Active mentor pairings', tgt: 55, unit: 'pairs', owner: 'P. Lead · Character' },
  { id: 'k10', pillar: 'character', title: 'Serving participation', tgt: 75, unit: '%', owner: 'P. Lead · Character', percent: true },
];

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// Last six month-ends (oldest first), Lagos-ish (UTC is close enough for trend lines)
function monthEnds(n = 6): Date[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i) + 1, 1));
    return i === n - 1 ? now : d;
  });
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function statusFor(cur: number | null, tgt: number, percent: boolean, cycleFraction: number): KpiStatus {
  if (cur == null) return 'pending';
  // Percent KPIs are judged against the target directly; counts against the
  // share of the target that should be reached by this point of the cycle.
  const expected = percent ? tgt : Math.max(1, tgt * cycleFraction);
  const ratio = cur / expected;
  return ratio >= 0.9 ? 'ontrack' : ratio >= 0.7 ? 'atrisk' : 'behind';
}

export async function computeKpis(): Promise<{ kpis: LiveKpi[]; cycle: GrowthCycle; cycleFraction: number }> {
  const db: DB = createAdminClient();
  const [{ data: cycleRow }, { data: ovRow }] = await Promise.all([
    db.from('app_settings').select('value').eq('key', 'growth_cycle').maybeSingle(),
    db.from('app_settings').select('value').eq('key', 'kpi_overrides').maybeSingle(),
  ]);
  const cycle: GrowthCycle = { ...DEFAULT_CYCLE, ...((cycleRow?.value ?? {}) as Partial<GrowthCycle>) };
  const overrides = (ovRow?.value ?? {}) as Record<string, KpiOverride>;
  const cycleFraction = cycleMonth(cycle) / cycle.months;
  const ends = monthEnds();
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const members = await all<{ id: string; name: string; created_at: string; department: string | null; business_status: string | null; business_verified_at?: string | null }>((f, t) =>
    db.from('members').select('id,name,created_at,department,business_status').eq('onboarding_complete', true).range(f, t));
  const byId = new Map(members.map(m => [m.id, m]));
  const total = members.length;

  const sixMonthsAgo = new Date(ends[0].getTime() - 31 * 86_400_000).toISOString();
  const [devotion, sessions, attendance, certs, pairings] = await Promise.all([
    all<{ member_id: string; checkin_date: string }>((f, t) => db.from('devotion_checkins').select('member_id,checkin_date').eq('completed', true).gte('checkin_date', sixMonthsAgo.slice(0, 10)).range(f, t)),
    all<{ id: string; scheduled_at: string }>((f, t) => db.from('sessions').select('id,scheduled_at').gte('scheduled_at', sixMonthsAgo).lte('scheduled_at', new Date().toISOString()).range(f, t)),
    all<{ session_id: string; member_id: string; status: string | null }>((f, t) => db.from('attendance_records').select('session_id,member_id,status').gte('checked_in_at', sixMonthsAgo).range(f, t)),
    all<{ id: string; member_id: string; completed_at: string; verified: boolean | null }>((f, t) => db.from('course_completions').select('id,member_id,completed_at,verified').range(f, t)),
    all<{ id: string; mentor_id: string; mentee_id: string; status: string; matched_at: string | null }>((f, t) => db.from('mentor_pairings').select('id,mentor_id,mentee_id,status,matched_at').range(f, t)),
  ]);
  const present = attendance.filter(a => (a.status ?? 'present') !== 'absent');

  const out: LiveKpi[] = [];
  for (const d of DEFS) {
    const ov = overrides[d.id] ?? {};
    const tgt = ov.tgt ?? d.tgt;
    let cur: number | null = null, trend: number[] = [], source = '', contributors: Contributor[] = [], contributorsTitle = 'Members';
    let asof = `Live · ${today}`;

    if (d.id === 'k1') {
      cur = total;
      trend = ends.map(e => members.filter(m => new Date(m.created_at) <= e).length);
      source = 'Auto · onboarded members';
      contributorsTitle = 'Newest members';
      contributors = [...members].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12)
        .map(m => ({ id: m.id, name: m.name, detail: `Joined ${new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, status: 'done' }));
    } else if (d.id === 'k3') {
      const active = new Set(devotion.filter(x => new Date(x.checkin_date) >= since30).map(x => x.member_id));
      cur = pct(active.size, total);
      trend = ends.map(e => {
        const start = new Date(e.getTime() - 30 * 86_400_000);
        return pct(new Set(devotion.filter(x => { const t = new Date(x.checkin_date); return t >= start && t <= e; }).map(x => x.member_id)).size, total);
      });
      source = 'Auto · members with a completed devotion in the last 30 days';
      contributorsTitle = 'No devotion in the last 30 days';
      contributors = members.filter(m => !active.has(m.id)).slice(0, 40).map(m => ({ id: m.id, name: m.name, detail: 'No completed devotion in 30 days', status: 'atrisk' }));
    } else if (d.id === 'k4') {
      const recent = sessions.filter(s => new Date(s.scheduled_at) >= since30);
      const ids = new Set(recent.map(s => s.id));
      const attendees = present.filter(a => ids.has(a.session_id));
      cur = recent.length ? pct(attendees.length, recent.length * total) : null;
      trend = ends.map(e => {
        const start = new Date(e.getTime() - 30 * 86_400_000);
        const ss = new Set(sessions.filter(s => { const t = new Date(s.scheduled_at); return t >= start && t <= e; }).map(s => s.id));
        return ss.size ? pct(present.filter(a => ss.has(a.session_id)).length, ss.size * total) : 0;
      });
      if (cur == null) asof = 'No sessions in the last 30 days';
      source = 'Auto · average turnout per session, last 30 days';
      const came = new Set(attendees.map(a => a.member_id));
      contributorsTitle = 'Missed every session in the last 30 days';
      contributors = recent.length ? members.filter(m => !came.has(m.id)).slice(0, 40).map(m => ({ id: m.id, name: m.name, detail: `0 of ${recent.length} sessions`, status: 'behind' })) : [];
    } else if (d.id === 'k5') {
      cur = certs.length;
      trend = ends.map(e => certs.filter(c => new Date(c.completed_at) <= e).length);
      source = 'Auto · course completions';
      contributorsTitle = 'Recent certifications';
      contributors = [...certs].sort((a, b) => b.completed_at.localeCompare(a.completed_at)).slice(0, 20)
        .map(c => ({ id: c.member_id, name: byId.get(c.member_id)?.name ?? '—', detail: c.verified ? 'Verified' : 'Awaiting verification', status: c.verified ? 'done' : 'ontrack' }));
    } else if (d.id === 'k7') {
      const reg = members.filter(m => m.business_status === 'I have a registered business');
      cur = reg.length;
      trend = ends.map(e => reg.filter(m => new Date(m.created_at) <= e).length);
      source = 'Auto · members reporting a registered business';
      contributorsTitle = 'Registered businesses';
      contributors = reg.map(m => ({ id: m.id, name: m.name, detail: 'Registered business', status: 'done' }));
    } else if (d.id === 'k9') {
      const active = pairings.filter(p => p.status === 'active');
      cur = active.length;
      trend = ends.map(e => active.filter(p => p.matched_at && new Date(p.matched_at) <= e).length);
      source = 'Auto · Mentorship console';
      const paired = new Set(active.map(p => p.mentee_id));
      contributorsTitle = 'Members waiting for a mentor';
      contributors = members.filter(m => !paired.has(m.id) && !active.some(p => p.mentor_id === m.id)).slice(0, 40)
        .map(m => ({ id: m.id, name: m.name, detail: 'Not paired yet', status: 'atrisk' }));
    } else if (d.id === 'k10') {
      const serving = members.filter(m => m.department && !/^not yet$/i.test(m.department));
      cur = pct(serving.length, total);
      trend = Array(6).fill(cur);
      source = 'Auto · members serving in a department (from profiles)';
      contributorsTitle = 'Not serving yet';
      contributors = members.filter(m => !m.department || /^not yet$/i.test(m.department)).slice(0, 40)
        .map(m => ({ id: m.id, name: m.name, detail: m.department ? 'Not yet serving' : 'Department not set', status: 'atrisk' }));
    }

    if (d.manual) {
      cur = typeof ov.value === 'number' ? ov.value : null;
      asof = ov.asof ? `Updated ${ov.asof}` : 'Awaiting update';
      source = 'Manual · enter the latest figure';
      trend = cur != null ? [cur] : [];
    }

    out.push({
      id: d.id, pillar: d.pillar, title: d.title, cur, tgt, unit: d.unit, owner: d.owner, asof, source, trend,
      manual: !!d.manual, status: statusFor(cur, tgt, !!d.percent, cycleFraction), contributorsTitle, contributors,
    });
  }
  return { kpis: out, cycle, cycleFraction };
}
