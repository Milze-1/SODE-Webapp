import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';
import { normalizePhone } from '@/lib/whatsapp';
import { enqueueWhatsApp } from '@/lib/whatsapp-queue';
import { membersByPhone, describeMessage, notifyAdminsOfMessage } from '@/lib/whatsapp-inbox';

// OpenWA webhook (registered automatically when WhatsApp is connected).
// - Every direct message to the SODE number lands in the inbox
//   (whatsapp_messages) and admins get a push when a conversation newly
//   needs a reply.
// - STOP turns off WhatsApp messages for that member (consent_contact =
//   false), START turns them back on; those are answered automatically.
// Every delivery is verified with X-OpenWA-Signature (HMAC-SHA256 of the raw body).
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

interface IncomingData {
  id?: string; from?: string; chatId?: string; body?: string; type?: string;
  fromMe?: boolean; isGroup?: boolean; isStatusBroadcast?: boolean;
  senderPhone?: string | null; contact?: { pushName?: string; name?: string };
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verified(raw, request.headers.get('x-openwa-signature'))) return new Response('Invalid signature', { status: 401 });

  const payload = JSON.parse(raw) as { event?: string; data?: unknown };
  if (payload.event !== 'message.received' || !payload.data) return Response.json({ ok: true });

  const d = payload.data as IncomingData;
  const chatId = d.chatId ?? d.from ?? '';
  if (d.fromMe || d.isGroup || d.isStatusBroadcast || chatId.endsWith('@broadcast') || chatId.endsWith('@newsletter')) {
    return Response.json({ ok: true });
  }

  // Sender phone: senderPhone (privacy-id senders) or the digits of a …@c.us id
  const phone = normalizePhone(d.senderPhone ?? (chatId.endsWith('@c.us') ? chatId.split('@')[0] : null));
  const contact = phone ?? chatId;
  if (!contact) return Response.json({ ok: true });

  const db = createAdminClient();
  const member = phone ? (await membersByPhone(db)).get(phone) ?? null : null;
  const body = describeMessage(d.type, d.body);
  const text = (d.body ?? '').trim();
  const wantsStop = STOP.test(text), wantsStart = START.test(text);

  // Did this conversation already have unread messages? (only alert on the first)
  const { count: unreadBefore } = await db.from('whatsapp_messages').select('id', { count: 'exact', head: true })
    .eq('contact', contact).eq('direction', 'in').is('read_at', null);

  const { error: insertError } = await db.from('whatsapp_messages').upsert({
    contact,
    phone,
    chat_id: chatId,
    member_id: member?.id ?? null,
    direction: 'in',
    body,
    msg_type: d.type ?? 'text',
    sender_name: d.contact?.pushName ?? d.contact?.name ?? null,
    provider_message_id: d.id ?? null,
    // STOP / START are handled automatically — nothing to answer
    read_at: wantsStop || wantsStart ? new Date().toISOString() : null,
  }, { onConflict: 'provider_message_id', ignoreDuplicates: true });
  if (insertError) console.error('[whatsapp webhook] inbox insert failed:', insertError.message);

  if (!wantsStop && !wantsStart) {
    if (!insertError && !unreadBefore) {
      await notifyAdminsOfMessage(db, member?.name ?? d.contact?.pushName ?? (phone ? `+${phone}` : 'a contact'), body, contact)
        .catch(e => console.error('[whatsapp webhook] admin push failed:', e));
    }
    return Response.json({ ok: true });
  }

  if (!phone) return Response.json({ ok: true, matched: 0 });
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
