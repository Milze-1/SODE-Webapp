import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

const getAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

async function awardPointsToMember(
  db: ReturnType<typeof getAdminClient>,
  memberId: string,
  ruleKey: string,
  refId: string,
  refNote: string,
): Promise<number> {
  // Idempotency: member_id + rule_key + ref_id
  const { data: existing } = await db
    .from('point_events')
    .select('id')
    .eq('member_id', memberId)
    .eq('rule_key', ruleKey)
    .eq('ref_id', refId)
    .maybeSingle();

  if (existing) {
    console.log('[Referral] Already awarded:', ruleKey, refId);
    return 0;
  }

  const { data: rule } = await db
    .from('point_rules')
    .select('*')
    .eq('rule_key', ruleKey)
    .eq('is_active', true)
    .single();

  if (!rule) {
    console.error('[Referral] Rule not found:', ruleKey);
    return 0;
  }

  const { error: eventErr } = await db.from('point_events').insert({
    member_id: memberId,
    rule_key: ruleKey,
    points: rule.points,
    ref_table: 'members',
    ref_id: refId,
    note: refNote,
  });

  if (eventErr) {
    console.error('[Referral] point_events insert error:', JSON.stringify(eventErr));
    return 0;
  }

  const { data: member } = await db.from('members').select('points').eq('id', memberId).single();
  await db
    .from('members')
    .update({ points: (member?.points || 0) + rule.points })
    .eq('id', memberId);

  const { data: balance } = await db
    .from('user_points_balance')
    .select('total_points, this_month_points')
    .eq('member_id', memberId)
    .maybeSingle();

  if (balance) {
    await db
      .from('user_points_balance')
      .update({
        total_points: (balance.total_points || 0) + rule.points,
        this_month_points: (balance.this_month_points || 0) + rule.points,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId);
  } else {
    await db.from('user_points_balance').insert({
      member_id: memberId,
      total_points: rule.points,
      this_month_points: rule.points,
      updated_at: new Date().toISOString(),
    });
  }

  console.log('[Referral] Awarded', rule.points, 'pts for', ruleKey, 'to member', memberId);
  return rule.points as number;
}

export async function processReferralOnRegister(
  email: string,
  newMemberId: string,
  refCode?: string | null,
): Promise<void> {
  const db = getAdminClient();

  console.log('[referral] processReferralOnRegister called', { email, newMemberId, refCode });

  try {
    let inviterId: string | null = null;

    // Path A: find invitation by email (case-insensitive), exclude already-processed stages
    const { data: invitation, error: invErr } = await db
      .from('invitations')
      .select('*')
      .ilike('email', email?.trim() || '')
      .not('stage', 'in', '("registered","first_attended","active","joined")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[referral] invitation lookup:', {
      found: !!invitation,
      error: invErr?.message ?? null,
      stage: invitation?.stage,
      inviterId: invitation?.inviter_id,
      invitationId: invitation?.id,
    });

    if (invitation) {
      inviterId = invitation.inviter_id as string;

      console.log('[referral] updating invitation stage...');
      const { error: updateErr } = await db
        .from('invitations')
        .update({
          stage: 'registered',
          stage_updated_at: new Date().toISOString(),
          invited_member_id: newMemberId,
        })
        .eq('id', invitation.id);

      console.log('[referral] invitation update result:', { error: updateErr?.message ?? null });
    } else if (refCode) {
      // Path B: referral link with ?ref=CODE
      const { data: refRecord, error: refErr } = await db
        .from('referral_codes')
        .select('*')
        .eq('code', refCode)
        .maybeSingle();

      console.log('[referral] refCode lookup:', {
        found: !!refRecord,
        error: refErr?.message ?? null,
        memberId: refRecord?.member_id,
      });;

      if (refRecord) {
        inviterId = refRecord.member_id as string;
      }
    }

    if (!inviterId) {
      console.log('[referral] No inviter found — skipping points award');
      return;
    }

    console.log('[referral] awarding points to inviter:', inviterId);
    const pts = await awardPointsToMember(
      db,
      inviterId,
      'referral_joined',
      newMemberId,
      `Referral registered: ${email}`,
    );

    // Email inviter
    if (pts > 0) {
      const { data: inviter } = await db.from('members').select('name, email').eq('id', inviterId).single();
      const { data: newMember } = await db.from('members').select('name').eq('id', newMemberId).single();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';

      if (inviter?.email) {
        sendEmail({
          to: inviter.email as string,
          subject: `${(newMember?.name as string | undefined) ?? 'Someone'} joined SODE! 🎉`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#1e2a52;padding:32px;text-align:center;">
                <p style="color:white;font-size:20px;font-weight:800;margin:0;">Daniels &amp; Esthers</p>
              </div>
              <div style="padding:32px;">
                <h2>Your referral joined! 🎉</h2>
                <p>Hi ${(inviter.name as string | undefined) ?? 'there'},</p>
                <p>${(newMember?.name as string | undefined) ?? 'Someone'} just registered on SODE using your invitation.</p>
                <p style="font-size:24px;font-weight:800;color:#1e2a52;">+${pts} points added to your account!</p>
                <a href="${appUrl}/member/invite"
                  style="display:inline-block;background:#1e2a52;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                  Invite more people →
                </a>
              </div>
            </div>
          `,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Referral] Unexpected error in processReferralOnRegister:', err);
  }
}

export async function processReferralOnAttendance(memberId: string): Promise<void> {
  const db = getAdminClient();

  try {
    const { data: invitation, error: invErr } = await db
      .from('invitations')
      .select('*')
      .eq('invited_member_id', memberId)
      .eq('stage', 'registered')
      .maybeSingle();

    console.log('[Referral] attendance invitation:', !!invitation, 'error:', invErr?.message ?? null);
    if (!invitation) return;

    const { count } = await db
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId);

    console.log('[Referral] attendance count:', count);
    if ((count ?? 0) !== 1) return;

    await awardPointsToMember(
      db,
      invitation.inviter_id as string,
      'referral_attended',
      memberId,
      'Referral attended first session',
    );

    await db
      .from('invitations')
      .update({
        stage: 'first_attended',
        stage_updated_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    console.log('[Referral] Attendance points awarded, stage → first_attended');
  } catch (err) {
    console.error('[Referral] Error in processReferralOnAttendance:', err);
  }
}
