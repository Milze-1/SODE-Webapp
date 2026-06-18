export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailResult {
  ok: boolean;
  channel: 'email' | 'console';
  error?: string;
}

const FROM = () => `SODE <${process.env.SODE_FROM_EMAIL ?? 'onboarding@resend.dev'}>`;
const isConfigured = () => {
  const key = process.env.RESEND_API_KEY;
  return !!key && key !== 'your_resend_api_key_here';
};

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  if (!isConfigured()) {
    const recipients = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    console.log(`[email] Resend not configured — would send "${payload.subject}" to ${recipients}`);
    return { ok: true, channel: 'console' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

    const { error } = await resend.emails.send({
      from: FROM(),
      to: recipients,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });

    if (error) {
      console.error(`[email] Resend error for "${payload.subject}":`, error);
      return { ok: false, channel: 'email', error: error.message };
    }

    return { ok: true, channel: 'email' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] Unexpected error for "${payload.subject}":`, msg);
    return { ok: false, channel: 'email', error: msg };
  }
}

// Thin helper — send to many recipients with a delay to stay under rate limits
export async function sendBulkEmail(
  recipients: { name: string; email: string }[],
  subject: string,
  buildHtml: (r: { name: string; email: string }) => string,
  delayMs = 100,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendEmail({ to: r.email, subject, html: buildHtml(r) });
    if (result.ok) sent++; else failed++;
    if (delayMs > 0) await new Promise(res => setTimeout(res, delayMs));
  }
  return { sent, failed };
}

// ─── Shared email templates ────────────────────────────────────────────────────

export function emailWrapper(content: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
  return `
    <div style="font-family:sans-serif;background:#f5f5f7;padding:32px 16px;min-height:100vh;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <div style="background:#1a1a2e;padding:24px 28px;">
          <p style="color:#fff;font-size:18px;font-weight:800;margin:0;letter-spacing:-.3px;">School of Daniels &amp; Esthers</p>
          <p style="color:rgba(255,255,255,.55);font-size:12px;margin:4px 0 0;">Growth Platform</p>
        </div>
        <div style="padding:28px 28px 24px;">
          ${content}
        </div>
        <div style="padding:16px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
          <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.5;">
            School of Daniels &amp; Esthers · Dominion City, Victoria Island, Lagos<br>
            <a href="${appUrl}" style="color:#9ca3af;">thesode.org</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

export function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-size:14px;font-weight:700;margin-top:16px;">${label} →</a>`;
}
