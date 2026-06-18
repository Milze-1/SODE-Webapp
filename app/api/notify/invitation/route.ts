import { NextResponse } from 'next/server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inviterName, inviteeName, inviteeEmail, message } = body as {
      inviterName: string;
      inviteeName: string | null;
      inviteeEmail: string;
      message: string;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
    const greeting = inviteeName ? `Hi ${inviteeName},` : 'Hi there,';

    const result = await sendEmail({
      to: inviteeEmail,
      subject: `${inviterName} invited you to SODE`,
      html: emailWrapper(`
        <p style="font-size:14px;color:#374151;margin:0 0 6px;">${greeting}</p>
        <h2 style="margin:0 0 16px;font-size:19px;color:#1a1a2e;">You&apos;ve been invited to the School of Daniels &amp; Esthers</h2>
        <div style="background:#f5f5f7;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0;font-style:italic;">&ldquo;${message}&rdquo;</p>
          <p style="font-size:12px;color:#6b7280;margin:8px 0 0;">— ${inviterName}</p>
        </div>
        <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 4px;">
          SODE is a community for young professionals committed to growing in faith, career, and marketplace impact.
        </p>
        ${ctaButton('Accept invitation &amp; join', `${appUrl}/register`)}
        <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
          If you&apos;re not interested, you can safely ignore this email.
        </p>
      `),
    });

    console.log('[notify/invitation] result:', result.channel, 'to:', inviteeEmail);
    return NextResponse.json({ ok: result.ok });
  } catch (err) {
    console.error('[notify/invitation] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
