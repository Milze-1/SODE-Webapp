import { createClient, createAdminClient } from '@/lib/supabase-server';

// Saves "Complete your profile" answers for the signed-in member.
//
// Runs server-side with the service role (scoped to the caller's own row)
// because the browser-side update was failing for some members on the
// "Work & strengths" step, with only a generic error to show for it. Only the
// profile fields below can be written through here.

const LIFE_STAGES = new Set(['student', 'professional', 'entrepreneur', 'between_roles', 'employed', 'other']);

const TEXT_FIELDS = [
  'department', 'industry', 'career_stage', 'business_status', 'business_industry',
  'business_description', 'business_employees', 'three_year_goal', 'support_needed',
] as const;
const ARRAY_FIELDS = ['mountains', 'strength_area', 'leadership_role'] as const;
const BOOL_FIELDS = ['is_leader', 'has_business'] as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Your session has expired — please sign in again.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { fields?: Record<string, unknown>; finish?: boolean } | null;
  const fields = body?.fields ?? {};
  const patch: Record<string, unknown> = {};

  if ('life_stage' in fields) {
    const v = fields.life_stage;
    if (v !== null && (typeof v !== 'string' || !LIFE_STAGES.has(v))) return Response.json({ error: 'Invalid life stage.' }, { status: 400 });
    patch.life_stage = v;
  }
  for (const k of TEXT_FIELDS) {
    if (!(k in fields)) continue;
    const v = fields[k];
    if (v !== null && typeof v !== 'string') return Response.json({ error: `Invalid ${k}.` }, { status: 400 });
    patch[k] = typeof v === 'string' ? (v.trim().slice(0, 2000) || null) : null;
  }
  for (const k of ARRAY_FIELDS) {
    if (!(k in fields)) continue;
    const v = fields[k];
    if (v !== null && !(Array.isArray(v) && v.every(x => typeof x === 'string'))) return Response.json({ error: `Invalid ${k}.` }, { status: 400 });
    const clean = Array.isArray(v) ? (v as string[]).map(x => x.trim().slice(0, 200)).filter(Boolean).slice(0, 20) : [];
    patch[k] = clean.length ? clean : null;
  }
  for (const k of BOOL_FIELDS) {
    if (k in fields) patch[k] = fields[k] === true;
  }
  if (Array.isArray(patch.mountains) && (patch.mountains as string[]).length > 2) {
    return Response.json({ error: 'Choose up to 2 mountains.' }, { status: 400 });
  }
  if (body?.finish) {
    patch.profile_complete = true;
    patch.profile_completed_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) return Response.json({ ok: true });

  const db = createAdminClient();
  const { data, error } = await db.from('members').update(patch).eq('auth_id', user.id).select('id');
  if (error) {
    console.error('[profile/save] update failed:', error.code, error.message, error.details);
    return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });
  }
  if (!data?.length) return Response.json({ error: 'No member profile found for this account.' }, { status: 404 });
  return Response.json({ ok: true });
}
