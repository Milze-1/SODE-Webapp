import { createClient, createAdminClient } from '@/lib/supabase-server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

// Invite an external mentor.
//
// The invitee is NOT added to `members` here. We store a pending row in
// `mentor_invites` and email them a registration link. When they register,
// the invite is applied (see lib/mentor-invite.ts) and only then do they
// appear in the members list — already flagged as a mentor.
//
// If the email already belongs to a registered member, we simply flag that
// member as a mentor instead of sending an invite.

const ADMIN_ROLES = new Set([
  'super_admin', 'director', 'spiritual_lead', 'career_lead', 'business_lead',
  'member_care_lead', 'data_ops_lead', 'business_dev', 'external_mentor',
]);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role));
  if (!isAdmin) return { user: null, error: Response.json({ error: 'Admin access required' }, { status: 403 }) };
  return { user, error: null };
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await request.json() as {
    name?: string;
    email?: string;
    pillar?: string | null;
    capacity?: number | null;
  };

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const pillar = body.pillar || null;
  const capacity = Number(body.capacity) || 3;

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Valid name and email are required' }, { status: 400 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  // Already a registered member? Just flag them as a mentor.
  const { data: existingMember } = await db
    .from('members')
    .select('id, name, auth_id, is_mentor, pillar')
    .ilike('email', email)
    .maybeSingle();

  if (existingMember) {
    if (existingMember.is_mentor) {
      return Response.json({ ok: true, outcome: 'already_mentor', memberName: existingMember.name });
    }
    const { error } = await db
      .from('members')
      .update({
        is_mentor: true,
        mentor_capacity: capacity,
        ...(existingMember.pillar ? {} : pillar ? { pillar } : {}),
        updated_at: now,
      })
      .eq('id', existingMember.id);
    if (error) {
      console.error('[invite-mentor] Failed to flag existing member:', error);
      return Response.json({ error: 'Could not update member' }, { status: 500 });
    }
    return Response.json({ ok: true, outcome: 'existing_member_promoted', memberName: existingMember.name });
  }

  // Upsert the pending invite (re-inviting the same email refreshes + resends)
  const { data: existingInvite } = await db
    .from('mentor_invites')
    .select('id')
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  let inviteError = null;
  if (existingInvite) {
    ({ error: inviteError } = await db
      .from('mentor_invites')
      .update({ name, pillar, mentor_capacity: capacity, invited_by: user!.id, updated_at: now })
      .eq('id', existingInvite.id));
  } else {
    ({ error: inviteError } = await db
      .from('mentor_invites')
      .insert({ name, email, pillar, mentor_capacity: capacity, invited_by: user!.id, status: 'pending' }));
  }

  if (inviteError) {
    console.error('[invite-mentor] Failed to store invite:', inviteError);
    return Response.json({ error: 'Could not create invite' }, { status: 500 });
  }

  // Send the invitation email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
  const result = await sendEmail({
    to: email,
    subject: `You've been invited to mentor at SODE`,
    html: emailWrapper(`
      <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${name},</p>
      <h2 style="margin:0 0 16px;font-size:19px;color:#1a1a2e;">You&apos;ve been invited to be a mentor at the School of Daniels &amp; Esthers</h2>
      <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 14px;">
        SODE is a community for young professionals committed to growing in faith, career,
        and marketplace impact. We&apos;d love for you to walk alongside our members as a mentor.
      </p>
      <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 4px;">
        Create your account with this email address (<strong>${email}</strong>) to get started —
        you&apos;ll be set up as a mentor automatically.
      </p>
      ${ctaButton('Accept invitation &amp; register', `${appUrl}/register`)}
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        If you weren&apos;t expecting this, you can safely ignore this email.
      </p>
    `),
  });

  if (!result.ok) {
    console.error('[invite-mentor] Invite stored but email failed to send to:', email);
    return Response.json({ ok: false, outcome: 'invite_saved_email_failed', error: 'Invite saved, but the email could not be sent. Try resending.' }, { status: 502 });
  }

  console.log('[invite-mentor] Invite sent to:', email, 'via', result.channel);
  return Response.json({ ok: true, outcome: 'invited' });
}
