export function personalizeMessage(template: string, member: { name: string }): string {
  return template.replaceAll('{{name}}', member.name);
}

// Thin helper — send to many recipients with a delay to stay under Termii's rate limits
export async function sendBulkWhatsApp(
  recipients: { name: string; whatsapp: string }[],
  buildMessage: (r: { name: string; whatsapp: string }) => string,
  delayMs = 150,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const ok = await sendWhatsApp(r.whatsapp, buildMessage(r));
    if (ok) sent++; else failed++;
    if (delayMs > 0) await new Promise(res => setTimeout(res, delayMs));
  }
  return { sent, failed };
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!process.env.TERMII_API_KEY) {
    console.log('[WhatsApp skipped — no key]', { phone, message });
    return false;
  }
  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        from: 'SODE',
        sms: message,
        type: 'plain',
        channel: 'whatsapp',
        api_key: process.env.TERMII_API_KEY,
      }),
    });
    const result = await response.json();
    console.log('[WhatsApp sent]', result);
    return true;
  } catch (error) {
    console.error('[WhatsApp error]', error);
    return false;
  }
}
