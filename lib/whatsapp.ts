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
