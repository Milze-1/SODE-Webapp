import { NextResponse } from 'next/server';
import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';

const ROLE_LABELS: Record<string, string> = {
  director:          'Director',
  spiritual_lead:    'Spiritual Lead',
  career_lead:       'Career Lead',
  business_lead:     'Business Lead',
  member_care_lead:  'Member Care Lead',
  data_ops_lead:     'Data Ops Lead',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, role, granted_by } = body as {
      name: string;
      email: string;
      role: string;
      granted_by: string;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
    const roleLabel = ROLE_LABELS[role] ?? role;

    const result = await sendEmail({
      to: email,
      subject: `You've been added as ${roleLabel} on SODE`,
      html: emailWrapper(`
        <h2 style="margin:0 0 6px;font-size:19px;color:#1a1a2e;">Welcome to the leadership team</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 18px;">Hi ${name},</p>
        <p style="font-size:14px;line-height:1.65;color:#374151;margin:0 0 16px;">
          <strong>${granted_by}</strong> has granted you <strong>${roleLabel}</strong> access on the SODE platform.
          You can now access the admin dashboard to manage your pillar.
        </p>
        <div style="background:#f5f5f7;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
          <p style="margin:0;font-size:13px;color:#6b7280;">Role: <strong style="color:#1a1a2e;">${roleLabel}</strong></p>
        </div>
        ${ctaButton('Sign in to admin dashboard', `${appUrl}/login`)}
        <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
          If you believe this was a mistake, contact the Director immediately.
        </p>
      `),
    });

    console.log('[notify/admin-access] result:', result.channel, 'to:', email);
    return NextResponse.json({ ok: result.ok });
  } catch (err) {
    console.error('[notify/admin-access] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
