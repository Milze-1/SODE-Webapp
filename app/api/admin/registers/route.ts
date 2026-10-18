import { requireAdmin } from '@/lib/admin-auth';

// Live data for the Cells page's other registers, and verification.
// GET ?tab=business|leadership|certificates
// POST { kind: 'business' | 'certificate', id, verified }

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', director: 'Director', spiritual_lead: 'Spiritual Lead', career_lead: 'Career Lead',
  business_lead: 'Business Lead', member_care_lead: 'Member Care Lead', data_ops_lead: 'Data Ops Lead',
  business_dev: 'Business Dev', external_mentor: 'External Mentor',
};
const ROLE_PILLAR: Record<string, string> = { spiritual_lead: 'spiritual', career_lead: 'career', business_lead: 'business' };

export async function GET(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const tab = new URL(request.url).searchParams.get('tab');

  if (tab === 'business') {
    const full = await a.db.from('members')
      .select('id,name,email,whatsapp,business_status,business_industry,business_description,business_employees,business_verified_at')
      .not('business_status', 'is', null).neq('business_status', 'No business interest currently').order('name');
    // Before migration 019 the verification column doesn't exist — still list
    const res = full.error
      ? await a.db.from('members').select('id,name,email,whatsapp,business_status,business_industry,business_description,business_employees')
          .not('business_status', 'is', null).neq('business_status', 'No business interest currently').order('name')
      : full;
    return Response.json({ rows: res.data ?? [], canVerify: !full.error });
  }

  if (tab === 'leadership') {
    const [{ data: roles }, { data: cells }, { data: mentors }] = await Promise.all([
      a.db.from('user_roles').select('user_id,role,created_at').neq('role', 'member'),
      a.db.from('cells').select('name,leader_id,pillar').not('leader_id', 'is', null),
      a.db.from('members').select('id,name,email,pillar,created_at').eq('is_mentor', true),
    ]);
    const authIds = ((roles ?? []) as { user_id: string }[]).map(r => r.user_id);
    const leaderIds = ((cells ?? []) as { leader_id: string }[]).map(c => c.leader_id);
    const [{ data: byAuth }, { data: byId }] = await Promise.all([
      authIds.length ? a.db.from('members').select('id,auth_id,name,email,pillar').in('auth_id', authIds) : Promise.resolve({ data: [] }),
      leaderIds.length ? a.db.from('members').select('id,name,email,pillar').in('id', leaderIds) : Promise.resolve({ data: [] }),
    ]);
    type P = { id: string; auth_id?: string; name: string; email: string; pillar: string | null };
    const auth: Record<string, P> = Object.fromEntries(((byAuth ?? []) as P[]).map(m => [m.auth_id!, m]));
    const ids: Record<string, P> = Object.fromEntries(((byId ?? []) as P[]).map(m => [m.id, m]));
    const rows = [
      ...((roles ?? []) as { user_id: string; role: string; created_at: string }[]).map(r => ({
        name: auth[r.user_id]?.name ?? '(no member profile)', email: auth[r.user_id]?.email ?? null,
        role: ROLE_LABEL[r.role] ?? r.role, pillar: ROLE_PILLAR[r.role] ?? auth[r.user_id]?.pillar ?? null, since: r.created_at,
      })),
      ...((cells ?? []) as { name: string; leader_id: string; pillar: string | null }[]).map(c => ({
        name: ids[c.leader_id]?.name ?? '—', email: ids[c.leader_id]?.email ?? null,
        role: `Cell Lead · ${c.name}`, pillar: c.pillar ?? ids[c.leader_id]?.pillar ?? null, since: null,
      })),
      ...((mentors ?? []) as { name: string; email: string; pillar: string | null; created_at: string }[]).map(m => ({
        name: m.name, email: m.email, role: 'Mentor', pillar: m.pillar, since: null,
      })),
    ].sort((x, y) => x.name.localeCompare(y.name));
    return Response.json({ rows });
  }

  if (tab === 'certificates') {
    const { data: done, error } = await a.db.from('course_completions')
      .select('id,member_id,course_id,completed_at,certificate_url,verified').order('completed_at', { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const list = (done ?? []) as { member_id: string; course_id: string | null }[];
    const [{ data: people }, { data: courses }] = await Promise.all([
      list.length ? a.db.from('members').select('id,name').in('id', Array.from(new Set(list.map(d => d.member_id)))) : Promise.resolve({ data: [] }),
      list.length ? a.db.from('learning_content').select('id,title').in('id', Array.from(new Set(list.map(d => d.course_id).filter(Boolean) as string[]))) : Promise.resolve({ data: [] }),
    ]);
    const name = Object.fromEntries(((people ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]));
    const title = Object.fromEntries(((courses ?? []) as { id: string; title: string }[]).map(c => [c.id, c.title]));
    return Response.json({
      rows: ((done ?? []) as { id: string; member_id: string; course_id: string | null; completed_at: string; certificate_url: string | null; verified: boolean | null }[])
        .map(d => ({ ...d, member: name[d.member_id] ?? '—', course: (d.course_id && title[d.course_id]) || 'Course' })),
    });
  }

  return Response.json({ error: 'Unknown tab' }, { status: 400 });
}

export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { kind, id, verified } = await request.json().catch(() => ({})) as { kind?: string; id?: string; verified?: boolean };
  if (!id || (kind !== 'business' && kind !== 'certificate')) return Response.json({ error: 'Bad request' }, { status: 400 });

  const { data: me } = await a.db.from('members').select('id').eq('auth_id', a.userId).maybeSingle();
  const { error } = kind === 'business'
    ? await a.db.from('members').update({
        business_verified_at: verified ? new Date().toISOString() : null,
        business_verified_by: verified ? a.userId : null,
      }).eq('id', id)
    : await a.db.from('course_completions').update({ verified: !!verified, verified_by: verified ? me?.id ?? null : null }).eq('id', id);
  if (error) {
    const missing = /business_verified/.test(error.message);
    return Response.json({ error: missing ? 'Run migration 019 in Supabase to enable business verification.' : error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
