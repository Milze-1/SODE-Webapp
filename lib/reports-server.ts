import { createAdminClient } from '@/lib/supabase-server';
import { DEFAULT_CYCLE, type GrowthCycle } from '@/lib/cycle-shared';

// Live-data report builders for Admin → Reports. Each report is a set of
// tables ("sheets"); the API renders them as Excel, CSV (first sheet) or a
// printable HTML page.

export type ReportType = 'scorecard' | 'attendance' | 'members' | 'goals' | 'devotion';
export type ReportPeriod = 'month' | 'quarter' | 'year' | 'cycle';

export interface Sheet {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, string | number | null>[];
}
export interface Report { title: string; periodLabel: string; generatedAt: string; sheets: Sheet[] }

type DB = ReturnType<typeof createAdminClient>;

const PILLARS = ['spiritual', 'career', 'business', 'character'];
const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }) : '');

// Fetch every row (PostgREST caps responses at 1000)
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function periodRange(db: DB, period: ReportPeriod): Promise<{ since: Date; label: string }> {
  const l = new Date(Date.now() + 3600_000); // Lagos
  const y = l.getUTCFullYear(), m = l.getUTCMonth();
  const lagosMidnight = (yy: number, mm: number, dd = 1) => new Date(Date.UTC(yy, mm, dd) - 3600_000);
  if (period === 'month') return { since: lagosMidnight(y, m), label: l.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  if (period === 'quarter') { const q = Math.floor(m / 3); return { since: lagosMidnight(y, q * 3), label: `Q${q + 1} ${y}` }; }
  if (period === 'year') return { since: lagosMidnight(y, 0), label: String(y) };
  const { data: s } = await db.from('app_settings').select('value').eq('key', 'growth_cycle').maybeSingle();
  const c = { ...DEFAULT_CYCLE, ...((s?.value ?? {}) as Partial<GrowthCycle>) };
  return { since: new Date(c.start + 'T00:00:00+01:00'), label: c.label };
}

interface Member { id: string; name: string; email: string | null; whatsapp: string | null; pillar: string | null; life_stage: string | null; department: string | null; onboarding_complete: boolean; profile_complete: boolean | null; is_mentor: boolean; points: number | null; created_at: string }

async function loadMembers(db: DB) {
  return all<Member>((f, t) => db.from('members')
    .select('id,name,email,whatsapp,pillar,life_stage,department,onboarding_complete,profile_complete,is_mentor,points,created_at')
    .order('name').range(f, t));
}

export async function buildReport(type: ReportType, period: ReportPeriod): Promise<Report> {
  const db = createAdminClient();
  const { since, label } = await periodRange(db, period);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);
  const nowIso = new Date().toISOString();

  const members = await loadMembers(db);
  const byId = new Map(members.map(m => [m.id, m]));
  const onboarded = members.filter(m => m.onboarding_complete);

  const sessions = await all<{ id: string; title: string; type: string | null; pillar: string | null; scheduled_at: string; expected_count: number | null; location: string | null }>((f, t) =>
    db.from('sessions').select('id,title,type,pillar,scheduled_at,expected_count,location').gte('scheduled_at', sinceIso).lte('scheduled_at', nowIso).order('scheduled_at').range(f, t));
  const sessionIds = new Set(sessions.map(s => s.id));
  const attendance = (await all<{ session_id: string; member_id: string; status: string | null; source: string | null }>((f, t) =>
    db.from('attendance_records').select('session_id,member_id,status,source').gte('checked_in_at', sinceIso).range(f, t)))
    .filter(a => sessionIds.has(a.session_id) && (a.status ?? 'present') !== 'absent');
  const goals = await all<{ id: string; member_id: string | null; pillar: string; title: string; current: number | null; target: number | null; unit: string | null; due_date: string | null; status: string | null; created_at: string; goal_type: string | null; reminder_frequency: string | null }>((f, t) =>
    db.from('goals').select('id,member_id,pillar,title,current,target,unit,due_date,status,created_at,goal_type,reminder_frequency').not('member_id', 'is', null).range(f, t));
  const devotion = await all<{ member_id: string; checkin_date: string; completed: boolean | null }>((f, t) =>
    db.from('devotion_checkins').select('member_id,checkin_date,completed').gte('checkin_date', sinceDate).range(f, t));
  const wins = await all<{ member_id: string; pillar: string | null; created_at: string }>((f, t) =>
    db.from('wins').select('member_id,pillar,created_at').gte('created_at', sinceIso).range(f, t));
  const points = await all<{ member_id: string; points: number }>((f, t) =>
    db.from('point_events').select('member_id,points').gte('created_at', sinceIso).range(f, t));

  const count = <T,>(rows: T[], key: (r: T) => string) => rows.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<string, number>());
  const attByMember = count(attendance, a => a.member_id);
  const attBySession = count(attendance, a => a.session_id);
  const devDone = devotion.filter(d => d.completed);
  const devByMember = count(devDone, d => d.member_id);
  const winsByMember = count(wins, w => w.member_id);
  const ptsByMember = points.reduce((m, p) => m.set(p.member_id, (m.get(p.member_id) ?? 0) + (p.points ?? 0)), new Map<string, number>());
  const activeGoals = goals.filter(g => g.status !== 'archived');
  const goalsByMember = count(activeGoals, g => g.member_id!);
  const generatedAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });

  // ── Sheets ──────────────────────────────────────────────────────────────
  const sessionsSheet: Sheet = {
    name: 'Sessions',
    columns: [
      { header: 'Date', key: 'date', width: 14 }, { header: 'Session', key: 'title', width: 34 }, { header: 'Type', key: 'type', width: 12 },
      { header: 'Pillar', key: 'pillar', width: 12 }, { header: 'Present', key: 'present', width: 10 }, { header: 'Expected', key: 'expected', width: 10 },
      { header: 'Turnout %', key: 'turnout', width: 11 },
    ],
    rows: sessions.map(s => {
      const present = attBySession.get(s.id) ?? 0;
      return { date: day(s.scheduled_at), title: s.title, type: cap(s.type), pillar: cap(s.pillar), present, expected: s.expected_count ?? null,
        turnout: s.expected_count ? Math.round((present / s.expected_count) * 100) : null };
    }),
  };

  const membersSheet: Sheet = {
    name: 'Members',
    columns: [
      { header: 'Name', key: 'name', width: 26 }, { header: 'Email', key: 'email', width: 28 }, { header: 'WhatsApp', key: 'whatsapp', width: 16 },
      { header: 'Pillar', key: 'pillar', width: 12 }, { header: 'Life stage', key: 'life', width: 14 }, { header: 'Department', key: 'dept', width: 14 },
      { header: 'Joined', key: 'joined', width: 13 }, { header: 'Onboarded', key: 'onb', width: 11 }, { header: 'Profile complete', key: 'prof', width: 15 },
      { header: 'Check-ins', key: 'att', width: 10 }, { header: 'Devotion days', key: 'dev', width: 13 }, { header: 'Active goals', key: 'goals', width: 12 },
      { header: 'Wins', key: 'wins', width: 8 }, { header: 'Points (period)', key: 'pts', width: 14 }, { header: 'Points (total)', key: 'total', width: 13 },
    ],
    rows: members.map(m => ({
      name: m.name, email: m.email, whatsapp: m.whatsapp, pillar: cap(m.pillar), life: cap(m.life_stage), dept: m.department,
      joined: day(m.created_at), onb: m.onboarding_complete ? 'Yes' : 'No', prof: m.profile_complete ? 'Yes' : 'No',
      att: attByMember.get(m.id) ?? 0, dev: devByMember.get(m.id) ?? 0, goals: goalsByMember.get(m.id) ?? 0,
      wins: winsByMember.get(m.id) ?? 0, pts: ptsByMember.get(m.id) ?? 0, total: m.points ?? 0,
    })),
  };

  const attendanceByMemberSheet: Sheet = {
    name: 'Attendance by member',
    columns: [{ header: 'Name', key: 'name', width: 26 }, { header: 'Pillar', key: 'pillar', width: 12 }, { header: 'Sessions attended', key: 'att', width: 17 }, { header: `of ${sessions.length}`, key: 'pct', width: 10 }],
    rows: onboarded.map(m => ({ name: m.name, pillar: cap(m.pillar), att: attByMember.get(m.id) ?? 0,
      pct: sessions.length ? `${Math.round(((attByMember.get(m.id) ?? 0) / sessions.length) * 100)}%` : '' }))
      .sort((a, b) => (b.att as number) - (a.att as number)),
  };

  const goalsSheet: Sheet = {
    name: 'Goals',
    columns: [
      { header: 'Member', key: 'member', width: 24 }, { header: 'Pillar', key: 'pillar', width: 12 }, { header: 'Goal', key: 'title', width: 36 },
      { header: 'Progress', key: 'progress', width: 14 }, { header: '%', key: 'pct', width: 7 }, { header: 'Status', key: 'status', width: 11 },
      { header: 'Due', key: 'due', width: 13 }, { header: 'Reminders', key: 'rem', width: 11 }, { header: 'Created', key: 'created', width: 13 },
    ],
    rows: activeGoals.map(g => ({
      member: byId.get(g.member_id!)?.name ?? '—', pillar: cap(g.pillar), title: g.title,
      progress: `${g.current ?? 0} / ${g.target ?? 0} ${g.unit ?? ''}`.trim(),
      pct: g.target ? Math.round(((g.current ?? 0) / g.target) * 100) : 0,
      status: cap(g.status === 'ontrack' ? 'on_track' : g.status === 'atrisk' ? 'at_risk' : g.status), due: day(g.due_date),
      rem: cap(g.reminder_frequency ?? 'off'), created: day(g.created_at),
    })).sort((a, b) => String(a.member).localeCompare(String(b.member))),
  };

  const devotionSheet: Sheet = {
    name: 'Devotion',
    columns: [{ header: 'Name', key: 'name', width: 26 }, { header: 'Pillar', key: 'pillar', width: 12 }, { header: 'Days completed', key: 'done', width: 15 }, { header: 'Days started', key: 'started', width: 13 }, { header: 'Last completed', key: 'last', width: 15 }],
    rows: onboarded.map(m => {
      const mine = devotion.filter(d => d.member_id === m.id);
      const lastDone = mine.filter(d => d.completed).map(d => d.checkin_date).sort().pop() ?? null;
      return { name: m.name, pillar: cap(m.pillar), done: mine.filter(d => d.completed).length, started: mine.length, last: lastDone ? day(lastDone) : '' };
    }).sort((a, b) => (b.done as number) - (a.done as number)),
  };

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
  const newMembers = members.filter(m => m.created_at >= sinceIso);
  const { data: pairings } = await db.from('mentor_pairings').select('id,status');
  const activePairs = (pairings ?? []).filter((p: { status: string }) => p.status === 'active').length;
  const avgAttendance = sessions.length ? Math.round(attendance.length / sessions.length) : 0;

  const summarySheet: Sheet = {
    name: 'Summary',
    columns: [{ header: 'Measure', key: 'k', width: 40 }, { header: 'Value', key: 'v', width: 18 }],
    rows: [
      { k: 'Members (onboarded)', v: onboarded.length },
      { k: 'New sign-ups this period', v: newMembers.length },
      { k: 'Profiles complete', v: `${onboarded.filter(m => m.profile_complete).length} (${pct(onboarded.filter(m => m.profile_complete).length, onboarded.length)})` },
      { k: 'Sessions held', v: sessions.length },
      { k: 'Total check-ins', v: attendance.length },
      { k: 'Average attendance per session', v: avgAttendance },
      { k: 'Members who attended at least once', v: `${attByMember.size} (${pct(attByMember.size, onboarded.length)})` },
      { k: 'Devotions completed', v: devDone.length },
      { k: 'Members with a devotion this period', v: `${devByMember.size} (${pct(devByMember.size, onboarded.length)})` },
      { k: 'Active goals', v: activeGoals.filter(g => g.status !== 'done').length },
      { k: 'Goals completed (all time)', v: activeGoals.filter(g => g.status === 'done').length },
      { k: 'Goals at risk / behind', v: activeGoals.filter(g => g.status === 'atrisk' || g.status === 'behind').length },
      { k: 'Wins logged', v: wins.length },
      { k: 'Points earned', v: points.reduce((s, p) => s + (p.points ?? 0), 0) },
      { k: 'Active mentor pairings', v: activePairs },
    ],
  };

  const pillarSheet: Sheet = {
    name: 'By pillar',
    columns: [
      { header: 'Pillar', key: 'p', width: 14 }, { header: 'Members', key: 'm', width: 10 }, { header: 'Active goals', key: 'g', width: 12 },
      { header: 'On track', key: 'on', width: 10 }, { header: 'At risk / behind', key: 'risk', width: 15 }, { header: 'Completed', key: 'done', width: 11 },
      { header: 'Wins', key: 'w', width: 8 },
    ],
    rows: [...PILLARS, null].map(p => {
      const g = activeGoals.filter(x => (p ? x.pillar === p : !PILLARS.includes(x.pillar)));
      return {
        p: p ? cap(p) : 'Other / unset',
        m: onboarded.filter(x => (p ? x.pillar === p : !x.pillar || !PILLARS.includes(x.pillar))).length,
        g: g.filter(x => x.status !== 'done').length, on: g.filter(x => x.status === 'ontrack').length,
        risk: g.filter(x => x.status === 'atrisk' || x.status === 'behind').length, done: g.filter(x => x.status === 'done').length,
        w: wins.filter(x => (p ? x.pillar === p : !x.pillar || !PILLARS.includes(x.pillar))).length,
      };
    }),
  };

  const titles: Record<ReportType, string> = {
    scorecard: 'Leadership scorecard', attendance: 'Attendance report', members: 'Members & growth',
    goals: 'Goals & milestones', devotion: 'Devotion report',
  };
  const sheets: Record<ReportType, Sheet[]> = {
    scorecard: [summarySheet, pillarSheet, sessionsSheet],
    attendance: [sessionsSheet, attendanceByMemberSheet],
    members: [membersSheet],
    goals: [goalsSheet],
    devotion: [devotionSheet],
  };
  return { title: titles[type], periodLabel: label, generatedAt, sheets: sheets[type] };
}
