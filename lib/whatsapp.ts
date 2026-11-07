// WhatsApp sending. Uses OpenWA (self-hosted gateway — deploy/openwa/README.md)
// when OPENWA_URL + OPENWA_API_KEY are set, otherwise Termii.
//
// OpenWA links a real WhatsApp number (QR scan) and is not Meta's official
// API: only message members who opted in, keep volume paced (see
// lib/whatsapp-queue.ts), and use a dedicated number.

import { createAdminClient } from '@/lib/supabase-server';

// Fills {{first_name}}, {{cell}}, {{department|fallback}}, … — see lib/message-fields.ts
export { personalize as personalizeMessage } from '@/lib/message-fields';

export const OPT_OUT_FOOTER = '\n\n_Reply STOP to stop these messages._';

// Nigerian-first normalisation to international digits: 0803… → 234803…
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  else if (d.length === 10 && /^[789]/.test(d)) d = '234' + d;
  d = d.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function whatsappProvider(): 'openwa' | 'termii' | null {
  if (process.env.OPENWA_URL && process.env.OPENWA_API_KEY) return 'openwa';
  if (process.env.TERMII_API_KEY) return 'termii';
  return null;
}

// ── OpenWA ──────────────────────────────────────────────────────────────────

const OPENWA_SESSION_NAME = 'sode';

async function openwa(path: string, init: RequestInit = {}): Promise<Response> {
  const base = process.env.OPENWA_URL!.replace(/\/+$/, '');
  return fetch(`${base}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.OPENWA_API_KEY!, ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
}

export interface OpenWaSession { id: string; name: string; status: string; phone: string | null; pushName: string | null; lastError?: string | null; restriction?: unknown }

// The session id is remembered in app_settings.openwa_session; created on first use.
export async function getOpenWaSession(create = false): Promise<OpenWaSession | null> {
  const db = createAdminClient();
  const { data: s } = await db.from('app_settings').select('value').eq('key', 'openwa_session').maybeSingle();
  const storedId = (s?.value as { id?: string } | null)?.id;
  if (storedId) {
    const r = await openwa(`/sessions/${encodeURIComponent(storedId)}`);
    if (r.ok) return await r.json() as OpenWaSession;
    if (r.status !== 404) throw new Error(`OpenWA ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  // Find by name, else create
  const list = await openwa('/sessions');
  if (!list.ok) throw new Error(`OpenWA ${list.status}: ${(await list.text()).slice(0, 200)}`);
  let session = ((await list.json()) as OpenWaSession[]).find(x => x.name === OPENWA_SESSION_NAME) ?? null;
  if (!session && create) {
    const r = await openwa('/sessions', { method: 'POST', body: JSON.stringify({ name: OPENWA_SESSION_NAME }) });
    if (!r.ok) throw new Error(`OpenWA ${r.status}: ${(await r.text()).slice(0, 200)}`);
    session = await r.json() as OpenWaSession;
  }
  if (session) {
    await db.from('app_settings').upsert({ key: 'openwa_session', value: { id: session.id }, updated_at: new Date().toISOString() });
  }
  return session;
}

export async function openWaStart(sessionId: string) {
  const r = await openwa(`/sessions/${encodeURIComponent(sessionId)}/start`, { method: 'POST' });
  if (!r.ok && r.status !== 409) throw new Error(`OpenWA ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function openWaQr(sessionId: string): Promise<string | null> {
  const r = await openwa(`/sessions/${encodeURIComponent(sessionId)}/qr`);
  if (!r.ok) return null;
  const j = await r.json() as { qrCode?: string };
  return j.qrCode ?? null;
}

export async function openWaLogout(sessionId: string) {
  await openwa(`/sessions/${encodeURIComponent(sessionId)}/logout`, { method: 'POST' });
}

// Register our webhook — incoming messages (inbox, STOP / START), connection
// status, and delivery/read receipts (message.ack → ticks in the inbox).
// An older registration missing an event is updated in place.
const WEBHOOK_EVENTS = ['message.received', 'session.status', 'message.ack'];

export async function openWaEnsureWebhook(sessionId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.thesode.org';
  const secret = process.env.OPENWA_WEBHOOK_SECRET;
  if (!secret) return;
  const url = `${appUrl.replace(/\/+$/, '')}/api/whatsapp/webhook`;
  const base = `/sessions/${encodeURIComponent(sessionId)}/webhooks`;
  const list = await openwa(base);
  const existing = list.ok ? ((await list.json()) as { id: string; url: string; events?: string[] }[]) : [];
  const ours = existing.find(w => w.url === url);
  if (ours) {
    if (WEBHOOK_EVENTS.every(e => ours.events?.includes(e))) return;
    await openwa(`${base}/${encodeURIComponent(ours.id)}`, {
      method: 'PUT', body: JSON.stringify({ events: Array.from(new Set([...(ours.events ?? []), ...WEBHOOK_EVENTS])) }),
    });
    return;
  }
  await openwa(base, { method: 'POST', body: JSON.stringify({ url, events: WEBHOOK_EVENTS, secret }) });
}

// ── Send ────────────────────────────────────────────────────────────────────

export interface SendResult { ok: boolean; provider: string | null; messageId?: string; error?: string }

// Send to an exact WhatsApp chat id (OpenWA only). Inbox replies use this so a
// sender whose number WhatsApp hides (an …@lid privacy id) can still be answered.
export async function sendWhatsAppChat(chatId: string, message: string, sessionId?: string): Promise<SendResult> {
  if (whatsappProvider() !== 'openwa') return { ok: false, provider: whatsappProvider(), error: 'Replying needs the OpenWA gateway' };
  try {
    const sid = sessionId ?? (await getOpenWaSession())?.id;
    if (!sid) return { ok: false, provider: 'openwa', error: 'WhatsApp is not connected' };
    const r = await openwa(`/sessions/${encodeURIComponent(sid)}/messages/send-text`, {
      method: 'POST', body: JSON.stringify({ chatId, text: message.slice(0, 4096) }),
    });
    if (!r.ok) return { ok: false, provider: 'openwa', error: `OpenWA ${r.status}: ${(await r.text()).slice(0, 300)}` };
    const j = await r.json().catch(() => ({})) as { messageId?: string };
    return { ok: true, provider: 'openwa', messageId: j.messageId };
  } catch (e) {
    return { ok: false, provider: 'openwa', error: (e as Error).message };
  }
}

// Send an image (OpenWA fetches it from a short-lived link). The text rides as
// the caption; WhatsApp captions stop at 1,024 characters, so a longer text
// follows as its own message.
const CAPTION_MAX = 1024;
export async function sendWhatsAppImage(chatId: string, imageUrl: string, text: string, sessionId?: string): Promise<SendResult> {
  if (whatsappProvider() !== 'openwa') return { ok: false, provider: whatsappProvider(), error: 'Sending images needs the OpenWA gateway' };
  try {
    const sid = sessionId ?? (await getOpenWaSession())?.id;
    if (!sid) return { ok: false, provider: 'openwa', error: 'WhatsApp is not connected' };
    const caption = text.trim();
    const fits = caption.length <= CAPTION_MAX;
    const r = await openwa(`/sessions/${encodeURIComponent(sid)}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url: imageUrl, ...(fits && caption ? { caption } : {}) }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) return { ok: false, provider: 'openwa', error: `OpenWA ${r.status}: ${(await r.text()).slice(0, 300)}` };
    const j = await r.json().catch(() => ({})) as { messageId?: string };
    if (!fits) {
      const t = await sendWhatsAppChat(chatId, caption, sid);
      if (!t.ok) return { ...t, error: `Image sent, but the text failed: ${t.error}` };
    }
    return { ok: true, provider: 'openwa', messageId: j.messageId };
  } catch (e) {
    return { ok: false, provider: 'openwa', error: (e as Error).message };
  }
}

// Bytes of a photo someone sent us (when the webhook didn't carry it inline)
export async function openWaDownloadMedia(chatId: string, messageId: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (whatsappProvider() !== 'openwa') return null;
  const sid = (await getOpenWaSession())?.id;
  if (!sid) return null;
  const r = await openwa(`/sessions/${encodeURIComponent(sid)}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/media`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) return null;
  const mime = (r.headers.get('content-type') ?? '').split(';')[0].trim();
  return { bytes: await r.arrayBuffer(), mime };
}

export async function sendWhatsApp(phone: string, message: string, sessionId?: string): Promise<SendResult> {
  const provider = whatsappProvider();
  const to = normalizePhone(phone);
  if (!to) return { ok: false, provider, error: `Invalid phone number: ${phone}` };

  if (provider === 'openwa') return sendWhatsAppChat(`${to}@c.us`, message, sessionId);

  if (provider === 'termii') {
    try {
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, from: 'SODE', sms: message, type: 'plain', channel: 'whatsapp', api_key: process.env.TERMII_API_KEY }),
      });
      const result = await response.json().catch(() => ({})) as { code?: string; message?: string; message_id?: string };
      // Termii answers 200 with an error message for many failures — check it
      if (!response.ok || (result.code && result.code !== 'ok')) return { ok: false, provider, error: result.message ?? `Termii ${response.status}` };
      return { ok: true, provider, messageId: result.message_id };
    } catch (e) {
      return { ok: false, provider, error: (e as Error).message };
    }
  }

  console.log('[WhatsApp skipped — no provider configured]', { to });
  return { ok: false, provider: null, error: 'No WhatsApp provider configured' };
}
