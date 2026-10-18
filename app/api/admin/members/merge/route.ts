import { createClient, createAdminClient } from '@/lib/supabase-server';

// Merge a duplicate member account into the one the person actually uses.
//
// POST { keepId, dropId, dryRun?, deleteLogin? }
//   dryRun      → returns what would move (row counts per table), changes nothing
//   otherwise   → re-points every row referencing dropId to keepId, merges the
//                 profile/points, then deletes the dropped member (and, if
//                 deleteLogin, its login so they can't sign back in to an
//                 empty account).
//
// There are no multi-statement transactions over PostgREST, so each step is
// idempotent: if anything fails part-way, running the merge again finishes it.

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Every column in the live schema that references members.id (read from the
// PostgREST schema). Tables with member_id as primary key are handled below.
const REFS: [table: string, column: string][] = [
  ['attendance_records', 'member_id'], ['goals', 'member_id'], ['goal_steps', 'member_id'],
  ['goal_updates', 'member_id'], ['wins', 'member_id'], ['wins', 'verified_by'],
  ['devotion_checkins', 'member_id'], ['devotion_journal', 'member_id'], ['devotion_plans', 'member_id'],
  ['bible_reading_plans', 'member_id'], ['form_responses', 'member_id'], ['course_completions', 'member_id'],
  ['course_completions', 'verified_by'], ['learning_completions', 'member_id'], ['check_ins', 'member_id'],
  ['check_ins', 'leader_id'], ['point_events', 'member_id'], ['points_log', 'member_id'],
  ['mentor_pairings', 'mentor_id'], ['mentor_pairings', 'mentee_id'], ['mentor_invites', 'accepted_member_id'],
  ['advocacy_posts', 'created_by'], ['advocacy_shares', 'member_id'], ['invitations', 'inviter_id'],
  ['invitations', 'invited_member_id'], ['invitations', 'registered_user_id'], ['invites', 'inviter_id'],
  ['invites', 'invited_member_id'], ['cells', 'leader_id'], ['cell_members', 'member_id'],
  ['reminders', 'member_id'], ['push_subscriptions', 'member_id'], ['referral_codes', 'member_id'],
  ['member_community_goals', 'member_id'], ['forms', 'created_by'],
];

// Profile answers copied onto the kept account when it has none
const PROFILE_FIELDS = [
  'whatsapp', 'life_stage', 'department', 'pillar', 'industry', 'career_stage', 'strength_area', 'mountains',
  'leadership_role', 'business_status', 'business_industry', 'business_description', 'business_employees',
  'three_year_goal', 'support_needed', 'leaderboard_name',
] as const;

const MANAGE_ROLES = new Set(['super_admin', 'director', 'data_ops_lead']);

async function countRefs(db: SupabaseAdmin, memberId: string) {
  const out: Record<string, number> = {};
  await Promise.all(REFS.map(async ([t, c]) => {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true }).eq(c, memberId);
    if (!error && count) out[`${t}.${c}`] = count;
  }));
  return out;
}

// Re-point rows; rows that would duplicate one the kept account already has
// (unique constraints, e.g. both checked in to the same session) are dropped.
async function moveRefs(db: SupabaseAdmin, table: string, column: string, keepId: string, dropId: string) {
  const bulk = await db.from(table).update({ [column]: keepId }).eq(column, dropId);
  if (!bulk.error) return { moved: 'all', dropped: 0 };
  if (bulk.error.code === '42P01' || bulk.error.code === 'PGRST205') return { moved: 0, dropped: 0 }; // table absent
  if (bulk.error.code !== '23505') throw new Error(`${table}.${column}: ${bulk.error.message}`);

  const { data: rows, error } = await db.from(table).select('id').eq(column, dropId);
  if (error) throw new Error(`${table}.${column}: ${error.message}`);
  let dropped = 0;
  for (const r of (rows ?? []) as { id: string }[]) {
    const one = await db.from(table).update({ [column]: keepId }).eq('id', r.id);
    if (one.error?.code === '23505') { await db.from(table).delete().eq('id', r.id); dropped++; }
    else if (one.error) throw new Error(`${table}.${column}: ${one.error.message}`);
  }
  return { moved: (rows?.length ?? 0) - dropped, dropped };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data: myRoles } = await db.from('user_roles').select('role').eq('user_id', user.id);
  if (!(myRoles ?? []).some((r: { role: string }) => MANAGE_ROLES.has(r.role))) {
    return Response.json({ error: 'Only Super Admins, Directors and Data Ops can merge accounts.' }, { status: 403 });
  }

  const { keepId, dropId, dryRun, deleteLogin } = await request.json().catch(() => ({})) as {
    keepId?: string; dropId?: string; dryRun?: boolean; deleteLogin?: boolean;
  };
  if (!keepId || !dropId || keepId === dropId) return Response.json({ error: 'Choose two different accounts.' }, { status: 400 });

  const { data: pair } = await db.from('members').select('*').in('id', [keepId, dropId]);
  const keep = (pair ?? []).find(m => m.id === keepId) as Record<string, unknown> | undefined;
  const drop = (pair ?? []).find(m => m.id === dropId) as Record<string, unknown> | undefined;
  if (!keep || !drop) return Response.json({ error: 'One of the accounts no longer exists.' }, { status: 404 });
  if (drop.auth_id && drop.auth_id === user.id) return Response.json({ error: "You can't merge away the account you're signed in with." }, { status: 400 });

  if (dryRun) {
    const lastSignIn = async (authId: unknown) => {
      if (typeof authId !== 'string') return null;
      const { data } = await db.auth.admin.getUserById(authId);
      return data?.user?.last_sign_in_at ?? null;
    };
    const [keepCounts, dropCounts, keepSeen, dropSeen] = await Promise.all([
      countRefs(db, keepId), countRefs(db, dropId), lastSignIn(keep.auth_id), lastSignIn(drop.auth_id),
    ]);
    return Response.json({
      keep: { ...keep, counts: keepCounts, last_sign_in_at: keepSeen },
      drop: { ...drop, counts: dropCounts, last_sign_in_at: dropSeen },
    });
  }

  try {
    // 1. Re-point every reference
    const report: Record<string, unknown> = {};
    for (const [t, c] of REFS) {
      const r = await moveRefs(db, t, c, keepId, dropId);
      if (r.moved || r.dropped) report[`${t}.${c}`] = r;
    }

    // 2. Points balance (one row per member): add together
    const { data: balances } = await db.from('user_points_balance').select('*').in('member_id', [keepId, dropId]);
    const kb = (balances ?? []).find(b => b.member_id === keepId);
    const dbal = (balances ?? []).find(b => b.member_id === dropId);
    if (dbal) {
      if (kb) {
        await db.from('user_points_balance').update({
          total_points: (kb.total_points ?? 0) + (dbal.total_points ?? 0),
          this_month_points: (kb.this_month_points ?? 0) + (dbal.this_month_points ?? 0),
          updated_at: new Date().toISOString(),
        }).eq('member_id', keepId);
        await db.from('user_points_balance').delete().eq('member_id', dropId);
      } else {
        await db.from('user_points_balance').update({ member_id: keepId }).eq('member_id', dropId);
      }
    }

    // 3. Privacy prefs (one row per member): keep the kept account's
    const { data: prefs } = await db.from('user_privacy_prefs').select('member_id').in('member_id', [keepId, dropId]);
    if ((prefs ?? []).some(p => p.member_id === dropId)) {
      if ((prefs ?? []).some(p => p.member_id === keepId)) await db.from('user_privacy_prefs').delete().eq('member_id', dropId);
      else await db.from('user_privacy_prefs').update({ member_id: keepId }).eq('member_id', dropId);
    }

    // 4. Member record: fill gaps, combine points and flags
    const patch: Record<string, unknown> = {
      points: Number(keep.points ?? 0) + Number(drop.points ?? 0),
      onboarding_complete: !!(keep.onboarding_complete || drop.onboarding_complete),
      profile_complete: !!(keep.profile_complete || drop.profile_complete),
      is_mentor: !!(keep.is_mentor || drop.is_mentor),
      is_leader: !!(keep.is_leader || drop.is_leader),
      has_business: !!(keep.has_business || drop.has_business),
    };
    if (!keep.profile_completed_at && drop.profile_completed_at) patch.profile_completed_at = drop.profile_completed_at;
    for (const f of PROFILE_FIELDS) {
      const k = keep[f]; const d = drop[f];
      const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.filter(Boolean).length === 0);
      if (empty(k) && !empty(d)) patch[f] = d;
    }
    const { error: patchErr } = await db.from('members').update(patch).eq('id', keepId);
    if (patchErr) throw new Error(`members: ${patchErr.message}`);

    // 5. Back-office roles follow the person if the kept login has none
    if (drop.auth_id && keep.auth_id) {
      const { data: keepRoles } = await db.from('user_roles').select('role').eq('user_id', keep.auth_id);
      if (!(keepRoles ?? []).length) await db.from('user_roles').update({ user_id: keep.auth_id }).eq('user_id', drop.auth_id);
      else await db.from('user_roles').delete().eq('user_id', drop.auth_id);
    }

    // 6. Remove the duplicate (and its login)
    const { error: delErr } = await db.from('members').delete().eq('id', dropId);
    if (delErr) throw new Error(`delete duplicate: ${delErr.message}`);
    let loginRemoved = false;
    if (deleteLogin && typeof drop.auth_id === 'string') {
      const { error } = await db.auth.admin.deleteUser(drop.auth_id);
      loginRemoved = !error;
      if (error) console.error('[members/merge] login delete failed:', error.message);
    }

    await db.from('audit_log').insert({
      actor_id: user.id, action: 'member_merge', target_table: 'members', target_id: keepId,
      payload: { dropped_member_id: dropId, dropped_email: drop.email ?? null, moved: report, login_removed: loginRemoved },
    }).then(() => {}, () => {});

    return Response.json({ ok: true, moved: report, loginRemoved });
  } catch (e) {
    console.error('[members/merge] failed:', (e as Error).message);
    return Response.json({ error: `Merge stopped part-way: ${(e as Error).message}. Running it again will finish it.` }, { status: 500 });
  }
}
