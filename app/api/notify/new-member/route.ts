import { NextResponse } from 'next/server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, whatsapp, registered_at } = body as {
      name: string;
      email: string;
      whatsapp: string;
      registered_at: string;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
    const registeredAt = new Date(registered_at).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
    const notifyEmail = process.env.SODE_NOTIFY_EMAIL ?? '';

    // 1. Welcome email to new member
    const welcomeResult = await sendEmail({
      to: email,
      subject: 'Welcome to the School of Daniels & Esthers 🎉',
      html: emailWrapper(`
        <h2 style="margin:0 0 6px;font-size:20px;color:#1a1a2e;">Welcome, ${name}!</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">We&apos;re glad you&apos;re here.</p>
        <p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 16px;">
          You&apos;ve just joined a community committed to growing in faith, career, and marketplace impact.
          Complete your profile to get personalised goals, connect with a mentor, and start earning points on your growth journey.
        </p>
        ${ctaButton('Complete your profile', `${appUrl}/member/onboarding`)}
        <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
          Questions? Reply to this email or reach us on WhatsApp.
        </p>
      `),
    });

    // 2. Team notification
    const teamResult = notifyEmail
      ? await sendEmail({
          to: notifyEmail,
          subject: `New member: ${name}`,
          html: emailWrapper(`
            <h2 style="margin:0 0 14px;font-size:18px;color:#1a1a2e;">New member registered</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:7px 0;color:#6b7280;width:110px;">Name</td><td style="padding:7px 0;font-weight:600;">${name}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280;">Email</td><td style="padding:7px 0;"><a href="mailto:${email}" style="color:#1a1a2e;">${email}</a></td></tr>
              <tr><td style="padding:7px 0;color:#6b7280;">WhatsApp</td><td style="padding:7px 0;">${whatsapp ?? '—'}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280;">Registered</td><td style="padding:7px 0;">${registeredAt}</td></tr>
            </table>
            ${ctaButton('View in admin dashboard', `${appUrl}/admin/members`)}
          `),
        })
      : { ok: true, channel: 'console' as const };

    console.log('[notify/new-member] welcome:', welcomeResult.channel, '| team:', teamResult.channel);
    return NextResponse.json({ ok: true, welcome: welcomeResult, team: teamResult });
  } catch (err) {
    console.error('[notify/new-member] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
