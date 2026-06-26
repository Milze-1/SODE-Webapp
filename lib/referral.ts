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
  const normalizedEmail = email?.trim().toLowerCase() || '';

  console.log('[referral] processReferralOnRegister called', { email: normalizedEmail, newMemberId, refCode });

  try {
    let inviterId: string | null = null;
    let invitationId: string | null = null;

    // METHOD 1: Referral link — look up by code (higher priority than email)
    if (refCode) {
      const { data: refRecord, error: refErr } = await db
        .from('referral_codes')
        .select('member_id')
        .eq('code', refCode.toUpperCase())
        .maybeSingle();

      console.log('[referral] METHOD 1 refCode lookup:', {
        code: refCode.toUpperCase(),
        found: !!refRecord,
        error: refErr?.message ?? null,
        inviterId: refRecord?.member_id,
      });

      if (refRecord?.member_id) {
        inviterId = refRecord.member_id as string;

        // Find or create an invitation record for this referral link signup
        const { data: existingInv } = await db
          .from('invitations')
          .select('id, stage')
          .ilike('email', normalizedEmail)
          .eq('inviter_id', inviterId)
          .maybeSingle();

        if (existingInv) {
          invitationId = existingInv.id as string;
          console.log('[referral] found existing invitation via refCode+email:', invitationId);
        } else {
          const { data: newInv } = await db
            .from('invitations')
            .insert({
              inviter_id: inviterId,
              email: normalizedEmail,
              stage: 'sent',
              invited_member_id: newMemberId,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .maybeSingle();
          invitationId = (newInv?.id as string | undefined) ?? null;
          console.log('[referral] created new invitation for refCode signup:', invitationId);
        }
      }
    }

    // METHOD 2: Email invitation fallback
    if (!inviterId) {
      const { data: invitation, error: invErr } = await db
        .from('invitations')
        .select('id, inviter_id, stage')
        .ilike('email', normalizedEmail)
        .not('stage', 'in', '("registered","first_attended","active","joined")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[referral] METHOD 2 email lookup:', {
        email: normalizedEmail,
        found: !!invitation,
        error: invErr?.message ?? null,
        stage: invitation?.stage,
        inviterId: invitation?.inviter_id,
        invitationId: invitation?.id,
      });

      if (invitation) {
        inviterId = invitation.inviter_id as string;
        invitationId = invitation.id as string;
      }
    }

    if (!inviterId) {
      console.log('[referral] No inviter found — skipping points award');
      return;
    }

    // Update invitation to registered stage
    if (invitationId) {
      const { error: updateErr } = await db
        .from('invitations')
        .update({
          stage: 'registered',
          stage_updated_at: new Date().toISOString(),
          invited_member_id: newMemberId,
        })
        .eq('id', invitationId);
      console.log('[referral] invitation stage → registered:', { invitationId, error: updateErr?.message ?? null });
    }

    // Idempotency: skip if points already awarded for this referral
    const { data: existing } = await db
      .from('point_events')
      .select('id')
      .eq('member_id', inviterId)
      .eq('rule_key', 'referral_joined')
      .eq('ref_id', newMemberId)
      .maybeSingle();

    if (existing) {
      console.log('[referral] referral_joined already awarded — skipping');
      return;
    }

    // Get rule
    const { data: rule } = await db
      .from('point_rules')
      .select('points')
      .eq('rule_key', 'referral_joined')
      .eq('is_active', true)
      .single();

    if (!rule) {
      console.error('[referral] referral_joined rule not found or inactive');
      return;
    }

    const pts = rule.points as number;

    // Insert point event
    const { error: eventErr } = await db.from('point_events').insert({
      member_id: inviterId,
      rule_key: 'referral_joined',
      points: pts,
      ref_table: 'members',
      ref_id: newMemberId,
      note: `Referral registered: ${normalizedEmail}`,
    });

    if (eventErr) {
      console.error('[referral] point_events insert error:', JSON.stringify(eventErr));
      return;
    }

    // Update members.points
    const { data: inviterRow } = await db.from('members').select('points').eq('id', inviterId).single();
    await db.from('members').update({ points: (inviterRow?.points || 0) + pts }).eq('id', inviterId);

    // Upsert balance (read current so we increment correctly)
    const { data: balance } = await db
      .from('user_points_balance')
      .select('total_points, this_month_points')
      .eq('member_id', inviterId)
      .maybeSingle();

    await db.from('user_points_balance').upsert({
      member_id: inviterId,
      total_points: (balance?.total_points ?? 0) + pts,
      this_month_points: (balance?.this_month_points ?? 0) + pts,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' });

    console.log('[referral] Awarded', pts, 'pts for referral_joined to inviter', inviterId);

    // Award member_joined points to the new member for joining via referral
    await awardPointsToMember(db, newMemberId, 'member_joined', inviterId, 'Joined SODE via referral');

    // Notify inviter
    const { data: inviter } = await db.from('members').select('name, email').eq('id', inviterId).single();
    const { data: newMemberData } = await db.from('members').select('name').eq('id', newMemberId).single();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';

    if (inviter?.email) {
      sendEmail({
        to: inviter.email as string,
        subject: `${(newMemberData?.name as string | undefined) ?? 'Someone'} joined SODE! 🎉`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1e2a52;padding:32px;text-align:center;">
              <p style="color:white;font-size:20px;font-weight:800;margin:0;">Daniels &amp; Esthers</p>
            </div>
            <div style="padding:32px;">
              <h2>Your referral joined! 🎉</h2>
              <p>Hi ${(inviter.name as string | undefined) ?? 'there'},</p>
              <p>${(newMemberData?.name as string | undefined) ?? 'Someone'} just registered on SODE using your invitation.</p>
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
  } catch (err) {
    console.error('[Referral] Unexpected error in processReferralOnRegister:', err);
  }
}

export async function processReferralOnAttendance(memberId: string): Promise<void> {
  const db = getAdminClient();

  try {
    // Find invitation not yet at the final milestone
    const { data: invitation, error: invErr } = await db
      .from('invitations')
      .select('*')
      .eq('invited_member_id', memberId)
      .not('stage', 'eq', 'five_meetings')
      .maybeSingle();

    console.log('[Referral] attendance invitation:', !!invitation, 'error:', invErr?.message ?? null);
    if (!invitation) return;

    const { count } = await db
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId);

    const n = count ?? 0;
    console.log('[Referral] attendance count:', n);

    if (n >= 5) {
      // Ensure first-meeting was also awarded if we jumped straight here
      if (invitation.stage === 'registered') {
        await awardPointsToMember(db, invitation.inviter_id as string, 'referral_attended', memberId, 'Referral attended first session');
      }
      await awardPointsToMember(db, invitation.inviter_id as string, 'referral_five_meetings', memberId, 'Referral attended 5 sessions');
      await db.from('invitations').update({ stage: 'five_meetings', stage_updated_at: new Date().toISOString() }).eq('id', invitation.id);
      console.log('[Referral] Milestone: five_meetings');
    } else if (n >= 1 && invitation.stage === 'registered') {
      await awardPointsToMember(db, invitation.inviter_id as string, 'referral_attended', memberId, 'Referral attended first session');
      await db.from('invitations').update({ stage: 'first_attended', stage_updated_at: new Date().toISOString() }).eq('id', invitation.id);
      console.log('[Referral] Milestone: first_attended');
    }
  } catch (err) {
    console.error('[Referral] Error in processReferralOnAttendance:', err);
  }
}
