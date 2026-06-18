import { createAdminClient } from '@/lib/supabase-server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

async function awardToInviter(
  db: ReturnType<typeof createAdminClient>,
  inviterMemberId: string,
  ruleKey: string,
  invitationId: string,
): Promise<number> {
  const { data: existingEvent } = await db.from('point_events')
    .select('id')
    .eq('member_id', inviterMemberId)
    .eq('rule_key', ruleKey)
    .eq('ref_table', 'invitations')
    .eq('ref_id', invitationId)
    .maybeSingle();

  if (existingEvent) {
    console.log('[referral] awardToInviter: already awarded, skipping');
    return 0;
  }

  const { data: rule } = await db.from('point_rules').select('points')
    .eq('rule_key', ruleKey).eq('is_active', true).maybeSingle();
  const pts: number = (rule?.points as number | undefined) ?? (ruleKey === 'referral_attended' ? 30 : 50);
  console.log('[referral] awardToInviter:', { ruleKey, pts, ruleFound: !!rule });

  const { data: inviterRow } = await db.from('members').select('points').eq('id', inviterMemberId).maybeSingle();

  const { error: insertErr } = await db.from('point_events').insert({
    member_id: inviterMemberId,
    rule_key: ruleKey,
    points: pts,
    ref_table: 'invitations',
    ref_id: invitationId,
  });
  if (insertErr) console.error('[referral] point_events insert error:', insertErr.message);

  await db.from('members').update({ points: (inviterRow?.points ?? 0) + pts }).eq('id', inviterMemberId);

  const { data: bal } = await db.from('user_points_balance').select('total_points, this_month_points')
    .eq('member_id', inviterMemberId).maybeSingle();
  const now = new Date().toISOString();
  const { error: upsertErr } = await db.from('user_points_balance').upsert({
    member_id: inviterMemberId,
    total_points: (bal?.total_points ?? 0) + pts,
    this_month_points: (bal?.this_month_points ?? 0) + pts,
    last_recalc_at: now,
    updated_at: now,
  }, { onConflict: 'member_id' });
  if (upsertErr) console.error('[referral] user_points_balance upsert error:', upsertErr.message);

  return pts;
}

export async function processReferralOnRegister({
  newMemberId,
  email,
  refCode,
}: {
  newMemberId: string;
  email: string;
  refCode?: string | null;
}): Promise<{ awarded: number; invitationId: string } | null> {
  const db = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';

  let inviterMemberId: string | null = null;
  let invitationId: string | null = null;

  // Path A: email matches a sent invitation (case-insensitive)
  const { data: emailInv, error: invErr } = await db.from('invitations')
    .select('id, inviter_id')
    .ilike('email', email)
    .in('stage', ['sent', 'opened'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('[referral] email lookup:', email, '→ found:', !!emailInv, 'error:', invErr?.message ?? null);

  if (emailInv) {
    inviterMemberId = emailInv.inviter_id as string;
    invitationId = emailInv.id as string;
    await db.from('invitations').update({
      stage: 'joined',
      invited_member_id: newMemberId,
      stage_updated_at: new Date().toISOString(),
    }).eq('id', invitationId);
  } else if (refCode) {
    // Path B: shared referral link with ?ref=CODE
    const { data: refRow, error: refErr } = await db.from('referral_codes').select('id, member_id').eq('code', refCode).maybeSingle();
    console.log('[referral] refCode lookup:', refCode, '→ found:', !!refRow, 'error:', refErr?.message ?? null);
    if (refRow) {
      inviterMemberId = refRow.member_id as string;
      const { data: newInv, error: newInvErr } = await db.from('invitations').insert({
        inviter_id: refRow.member_id,
        referral_code_id: refRow.id,
        email,
        stage: 'joined',
        invited_member_id: newMemberId,
        stage_updated_at: new Date().toISOString(),
      }).select('id').maybeSingle();
      if (newInvErr) console.error('[referral] invitations insert error:', newInvErr.message);
      invitationId = (newInv?.id as string | undefined) ?? null;
    }
  }

  console.log('[referral] inviter:', inviterMemberId, 'invitationId:', invitationId);
  if (!inviterMemberId || !invitationId) return null;

  const awarded = await awardToInviter(db, inviterMemberId, 'referral_joined', invitationId);

  // Email inviter
  if (awarded > 0) {
    const { data: newMember } = await db.from('members').select('name').eq('id', newMemberId).maybeSingle();
    const { data: inviter } = await db.from('members').select('name, email').eq('id', inviterMemberId).maybeSingle();
    if (inviter?.email) {
      sendEmail({
        to: inviter.email as string,
        subject: `${(newMember?.name as string | undefined) ?? 'Someone'} joined SODE! 🎉`,
        html: emailWrapper(`
          <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${(inviter.name as string | undefined) ?? 'there'},</p>
          <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a2e;">Your referral joined! 🎉</h2>
          <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 12px;">
            <strong>${(newMember?.name as string | undefined) ?? 'A new member'}</strong> just registered on SODE using your invitation.
          </p>
          <div style="background:#f0f4ff;border-radius:12px;padding:18px;margin-bottom:18px;text-align:center;">
            <p style="font-size:26px;font-weight:800;color:#1e2a52;margin:0;">+${awarded} points</p>
            <p style="font-size:13px;color:#6b7280;margin:6px 0 0;">added to your account</p>
          </div>
          <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
            Keep inviting — every person you bring in earns you points and grows the community.
          </p>
          ${ctaButton('Invite more people →', `${appUrl}/member/invite`)}
        `),
      }).catch(() => {});
    }
  }

  console.log(`[referral] on-register: inviter=${inviterMemberId} awarded=${awarded}`);
  return { awarded, invitationId };
}

export async function processReferralOnAttendance({
  inviteeMemberId,
}: {
  inviteeMemberId: string;
}): Promise<{ awarded: number } | null> {
  const db = createAdminClient();

  // Only applies when invitee has a 'joined' invitation (registered but not yet attended)
  const { data: inv, error: invErr } = await db.from('invitations')
    .select('id, inviter_id')
    .eq('invited_member_id', inviteeMemberId)
    .eq('stage', 'joined')
    .maybeSingle();

  console.log('[referral] attendance lookup for member:', inviteeMemberId, '→ found:', !!inv, 'error:', invErr?.message ?? null);
  if (!inv) return null;

  // Only on their VERY first attendance
  const { count } = await db.from('attendance_records')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', inviteeMemberId);

  console.log('[referral] attendance count:', count);
  if ((count ?? 0) !== 1) return null;

  const inviterMemberId = inv.inviter_id as string;
  const invitationId = inv.id as string;

  const awarded = await awardToInviter(db, inviterMemberId, 'referral_attended', invitationId);

  await db.from('invitations').update({
    stage: 'attended',
    stage_updated_at: new Date().toISOString(),
  }).eq('id', invitationId);

  console.log(`[referral] on-attendance: inviter=${inviterMemberId} awarded=${awarded}`);
  return { awarded };
}
