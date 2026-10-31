import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';
import { normalizePhone } from '@/lib/whatsapp';
import { enqueueWhatsApp } from '@/lib/whatsapp-queue';

// OpenWA webhook (registered automatically when WhatsApp is connected).
// Handles opt-out/in replies: STOP turns off WhatsApp messages for that
// member (consent_contact = false), START turns them back on. Every delivery
// is verified with X-OpenWA-Signature (HMAC-SHA256 of the raw body).
export const dynamic = 'force-dynamic';

const STOP = /^\s*(stop|unsubscribe|stop all|cancel|quit|end)\s*[.!]?\s*$/i;
const START = /^\s*(start|unstop|subscribe|resume)\s*[.!]?\s*$/i;

function verified(raw: string, header: string | null): boolean {
  const secret = process.env.OPENWA_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verified(raw, request.headers.get('x-openwa-signature'))) return new Response('Invalid signature', { status: 401 });

  const payload = JSON.parse(raw) as { event?: string; data?: Record<string, unknown> };
  if (payload.event !== 'message.received' || !payload.data) return Response.json({ ok: true });

  const d = payload.data as { from?: string; body?: string; fromMe?: boolean; isGroup?: boolean; senderPhone?: string | null };
  if (d.fromMe || d.isGroup || !d.body) return Response.json({ ok: true });
  const wantsStop = STOP.test(d.body), wantsStart = START.test(d.body);
  if (!wantsStop && !wantsStart) return Response.json({ ok: true });

  // Sender phone: senderPhone (privacy-id senders) or the digits of `from`
  const phone = normalizePhone(d.senderPhone ?? (d.from ?? '').split('@')[0]);
  if (!phone) return Response.json({ ok: true });

  const db = createAdminClient();
  const { data: members } = await db.from('members').select('id, whatsapp').not('whatsapp', 'is', null);
  const matches = ((members ?? []) as { id: string; whatsapp: string }[]).filter(m => normalizePhone(m.whatsapp) === phone);
  if (matches.length === 0) return Response.json({ ok: true, matched: 0 });

  await db.from('members').update({ consent_contact: wantsStart }).in('id', matches.map(m => m.id));
  if (wantsStop) {
    // Don't send anything else that was already queued for them
    await db.from('whatsapp_queue').update({ status: 'cancelled' }).in('member_id', matches.map(m => m.id)).eq('status', 'pending');
  }
  // Confirmation is sent directly (bypassing the opt-in filter on purpose)
  await enqueueWhatsApp(db, null, [{
    memberId: matches[0].id,
    phone,
    body: wantsStop
      ? "You won't get WhatsApp messages from SODE any more. Reply START anytime to turn them back on."
      : "You're back on SODE WhatsApp updates. Reply STOP anytime to stop them.",
  }]);
  return Response.json({ ok: true, matched: matches.length, consent: wantsStart });
}
