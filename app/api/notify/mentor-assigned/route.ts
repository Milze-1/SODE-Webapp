import { NextResponse } from 'next/server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { menteeName, menteeEmail, mentorName, pillar } = body as {
      menteeName: string;
      menteeEmail: string;
      mentorName: string;
      pillar: string | null;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
    const pillarLine = pillar
      ? `<p style="font-size:13.5px;color:#6b7280;margin:0 0 16px;">Pillar: <strong style="color:#1a1a2e;">${pillar.charAt(0).toUpperCase() + pillar.slice(1)}</strong></p>`
      : '';

    const result = await sendEmail({
      to: menteeEmail,
      subject: `You've been matched with a mentor — ${mentorName}`,
      html: emailWrapper(`
        <h2 style="margin:0 0 6px;font-size:19px;color:#1a1a2e;">You have a mentor! 🎉</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 18px;">Hi ${menteeName},</p>
        <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 14px;">
          We&apos;ve matched you with <strong>${mentorName}</strong> as your SODE mentor.
          They&apos;re here to walk alongside you in your growth journey.
        </p>
        ${pillarLine}
        <div style="background:#f5f5f7;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <p style="font-weight:700;font-size:15px;margin:0 0 4px;color:#1a1a2e;">${mentorName}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;">Your assigned SODE mentor</p>
        </div>
        <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 4px;">
          Reach out to them through the platform or connect at the next session.
        </p>
        ${ctaButton('View my mentorship', `${appUrl}/member/mentorship`)}
      `),
    });

    console.log('[notify/mentor-assigned] result:', result.channel, 'to:', menteeEmail);
    return NextResponse.json({ ok: result.ok });
  } catch (err) {
    console.error('[notify/mentor-assigned] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
