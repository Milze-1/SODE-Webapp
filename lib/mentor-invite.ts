// Applies a pending external-mentor invite when the invitee registers.
// Server-only (uses the service-role client).
//
// Idempotent: only acts on invites with status = 'pending', so it is safe to
// call from both the client-driven /api/referral/on-register path and the
// auth callback without double-applying.

import { createAdminClient } from '@/lib/supabase-server';

export async function applyMentorInvite(email: string, memberId: string): Promise<boolean> {
  if (!email || !memberId) return false;

  const db = createAdminClient();

  const { data: invite } = await db
    .from('mentor_invites')
    .select('id, pillar, mentor_capacity')
    .ilike('email', email.trim())
    .eq('status', 'pending')
    .maybeSingle();

  if (!invite) return false;

  const now = new Date().toISOString();

  const { data: member } = await db
    .from('members')
    .select('id, pillar')
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return false;

  const { error: memberError } = await db
    .from('members')
    .update({
      is_mentor: true,
      mentor_capacity: invite.mentor_capacity ?? 3,
      // Keep any pillar the member already chose; otherwise use the invite's
      ...(member.pillar ? {} : invite.pillar ? { pillar: invite.pillar } : {}),
      updated_at: now,
    })
    .eq('id', memberId);

  if (memberError) {
    console.error('[mentor-invite] Failed to flag member as mentor:', memberError);
    return false;
  }

  const { error: inviteError } = await db
    .from('mentor_invites')
    .update({ status: 'accepted', accepted_member_id: memberId, accepted_at: now, updated_at: now })
    .eq('id', invite.id);

  if (inviteError) {
    console.error('[mentor-invite] Member flagged, but invite status update failed:', inviteError);
  }

  console.log('[mentor-invite] Applied mentor invite for:', email, '→ member:', memberId);
  return true;
}
