import { createAdminClient } from '@/lib/supabase-server';
import { sendBulkEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  // Sessions starting in ~24 hours
  const { data: sessions } = await db
    .from('sessions')
    .select('id, title, location, scheduled_at')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)
    .eq('is_live', false);

  if (!sessions || sessions.length === 0) {
    console.log('[cron/session-reminders] No sessions in next 24h window');
    return Response.json({ sent: 0, message: 'No sessions in window' });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
  let totalSent = 0;

  for (const session of sessions as { id: string; title: string; location: string | null; scheduled_at: string }[]) {
    const sessionTime = new Date(session.scheduled_at).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    // Get all onboarded members
    const { data: members } = await db
      .from('members')
      .select('id, name, email')
      .eq('onboarding_complete', true);

    const recipients = (members ?? []) as { id: string; name: string; email: string }[];
    if (!recipients.length) continue;

    const { sent } = await sendBulkEmail(
      recipients,
      `Reminder: ${session.title} is tomorrow`,
      r => emailWrapper(`
        <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${r.name},</p>
        <h2 style="margin:0 0 16px;font-size:19px;color:#1a1a2e;">Session reminder 🔔</h2>
        <div style="background:#f5f5f7;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <p style="font-weight:800;font-size:16px;margin:0 0 6px;color:#1a1a2e;">${session.title}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;">${sessionTime}${session.location ? ` · ${session.location}` : ''}</p>
        </div>
        <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
          Don&apos;t forget to check in when you arrive — your attendance earns points!
        </p>
        ${ctaButton('Check in at the session', `${appUrl}/member/attendance`)}
      `),
    );

    totalSent += sent;
    console.log(`[cron/session-reminders] Session "${session.title}": ${sent} reminders sent`);
  }

  return Response.json({ sent: totalSent, sessions: sessions.length });
}
