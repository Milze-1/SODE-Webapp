import { createClient, createAdminClient } from '@/lib/supabase-server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

// "Request account deletion" — previously only showed a toast, so nothing
// ever reached the team. Emails the SODE team (SODE_NOTIFY_EMAIL) with the
// member's details and sends the member a confirmation. Deletion itself is
// done by an admin from the Members screen.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data: member } = await db.from('members').select('id, name, email, whatsapp, created_at').eq('auth_id', user.id).maybeSingle();
  if (!member) return Response.json({ error: 'Member not found' }, { status: 404 });

  const teamEmail = process.env.SODE_NOTIFY_EMAIL;
  if (!teamEmail) {
    console.error('[deletion-request] SODE_NOTIFY_EMAIL not set — request from', member.id);
    return Response.json({ error: 'We could not send your request right now. Please email connect@thesode.org.' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.thesode.org';
  const esc = (s: string | null) => (s ?? '—').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

  const team = await sendEmail({
    to: teamEmail,
    subject: `Account deletion request — ${member.name}`,
    html: emailWrapper(`
      <h2 style="margin:0 0 14px;font-size:18px;">Account deletion request</h2>
      <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Member:</strong> ${esc(member.name)}</p>
      <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Email:</strong> ${esc(member.email ?? user.email ?? null)}</p>
      <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>WhatsApp:</strong> ${esc(member.whatsapp)}</p>
      <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 8px;"><strong>Member ID:</strong> ${member.id}</p>
      <p style="font-size:13.5px;color:#6b7280;line-height:1.6;margin:12px 0 0;">Confirm with the member, then delete them from Admin → Members.</p>
      ${ctaButton('Open Members', `${appUrl}/admin/members`)}
    `),
  });
  if (!team.ok) return Response.json({ error: 'We could not send your request right now. Please email connect@thesode.org.' }, { status: 502 });

  const to = member.email ?? user.email;
  if (to) {
    await sendEmail({
      to,
      subject: 'We received your account deletion request',
      html: emailWrapper(`
        <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${esc(member.name)},</p>
        <p style="font-size:14px;color:#374151;line-height:1.65;margin:0 0 12px;">
          We've received your request to delete your SODE account. A member of the team will confirm with you
          before anything is removed. If you didn't make this request, reply to this email or contact connect@thesode.org.
        </p>
      `),
    }).catch(() => { /* confirmation is best-effort */ });
  }

  return Response.json({ ok: true });
}
