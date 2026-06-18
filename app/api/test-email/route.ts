import { sendEmail } from '@/lib/email';

export async function GET() {
  const result = await sendEmail({
    to: process.env.SODE_NOTIFY_EMAIL!,
    subject: 'SODE Platform — Email test ✓',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h2 style="color:#1e2a52;">Email is working! ✓</h2>
        <p>Resend is correctly configured for the SODE Growth Platform.</p>
        <p>From: ${process.env.SODE_FROM_EMAIL}</p>
        <p>Time: ${new Date().toISOString()}</p>
      </div>
    `,
  });
  return Response.json(result);
}
