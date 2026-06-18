import { NextResponse } from 'next/server';
import { sendBulkEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { goalId, goalTitle, pillar, deadline, adminName, memberEmails } = body as {
      goalId: string;
      goalTitle: string;
      pillar: string;
      deadline: string | null;
      adminName: string;
      memberEmails: string[];
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
    const pillarLabel = pillar.charAt(0).toUpperCase() + pillar.slice(1);
    const deadlineStr = deadline
      ? new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'No deadline set';

    const recipients = memberEmails.map(e => ({ name: '', email: e }));

    const { sent, failed } = await sendBulkEmail(
      recipients,
      `New community goal: ${goalTitle}`,
      () => emailWrapper(`
        <h2 style="margin:0 0 6px;font-size:19px;color:#1a1a2e;">New community goal</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 18px;">${adminName} published a new goal for you.</p>
        <div style="background:#f5f5f7;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 4px;letter-spacing:.08em;">${pillarLabel}</p>
          <p style="font-size:17px;font-weight:800;color:#1a1a2e;margin:0 0 6px;">${goalTitle}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;">Deadline: ${deadlineStr}</p>
        </div>
        <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
          Log in to view your goal and track your progress alongside the community.
        </p>
        ${ctaButton('View community goals', `${appUrl}/member/goals`)}
      `),
    );

    console.log(`[notify/community-goal] goalId:${goalId} sent:${sent} failed:${failed}`);
    return NextResponse.json({ ok: true, channel: 'email', sent, failed });
  } catch (err) {
    console.error('[notify/community-goal] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
