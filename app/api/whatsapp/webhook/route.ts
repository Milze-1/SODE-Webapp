import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';
import { normalizePhone, openWaDownloadMedia } from '@/lib/whatsapp';
import { storeMedia } from '@/lib/whatsapp-media';
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

// Delivery / read receipt for a message we sent → the ticks in the inbox.
// Only moves forward (sent → delivered → read), so a late receipt can't downgrade.
const ACK_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
async function handleAck(d: { messageId?: string; id?: string; status?: string }) {
  const id = d.messageId ?? d.id;
  const status = d.status;
  if (!id || !status || !(status in ACK_RANK || status === 'failed')) return Response.json({ ok: true });
  const db = createAdminClient();
  const lower = status === 'failed' ? ['sent'] : Object.keys(ACK_RANK).filter(k => ACK_RANK[k] < ACK_RANK[status]);
  const { error } = await db.from('whatsapp_messages').update({ delivery_status: status })
    .eq('provider_message_id', id).eq('direction', 'out')
    .or(`delivery_status.is.null${lower.length ? `,delivery_status.in.(${lower.join(',')})` : ''}`);
  if (error) console.error('[whatsapp webhook] ack update failed:', error.message);
  return Response.json({ ok: true });
}

interface IncomingData {
  id?: string; from?: string; chatId?: string; body?: string; type?: string;
  fromMe?: boolean; isGroup?: boolean; isStatusBroadcast?: boolean;
  senderPhone?: string | null; contact?: { pushName?: string; name?: string };
  media?: { mimetype?: string; data?: string; omitted?: boolean };
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verified(raw, request.headers.get('x-openwa-signature'))) return new Response('Invalid signature', { status: 401 });

  const payload = JSON.parse(raw) as { event?: string; data?: unknown };
  if (payload.event === 'message.ack' && payload.data) return handleAck(payload.data as { messageId?: string; id?: string; status?: string });
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
  // A redelivery of a message we already have: nothing to do
  if (d.id) {
    const { count } = await db.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('provider_message_id', d.id);
    if (count) return Response.json({ ok: true, duplicate: true });
  }
  const member = phone ? (await membersByPhone(db)).get(phone) ?? null : null;

  // A photo they sent: keep a copy so it shows in the inbox. Small ones come
  // inline; bigger ones are fetched from the gateway. Failure just leaves the
  // "📷 Photo" label.
  let mediaPath: string | null = null, mediaMime: string | null = null;
  if ((d.type === 'image' || d.type === 'sticker') && d.id) {
    try {
      let bytes: ArrayBuffer | Buffer | null = null, mime = d.media?.mimetype?.split(';')[0] ?? '';
      if (d.media?.data) bytes = Buffer.from(d.media.data, 'base64');
      else {
        const got = await openWaDownloadMedia(chatId, d.id);
        if (got) { bytes = got.bytes; mime = got.mime || mime; }
      }
      if (bytes && /^image\/(jpeg|png|webp|gif)$/.test(mime)) {
        mediaPath = await storeMedia(db, bytes, mime, 'in');
        mediaMime = mime;
      }
    } catch (e) {
      console.error('[whatsapp webhook] could not keep media:', (e as Error).message);
    }
  }
  const body = mediaPath ? (d.body ?? '').trim() : describeMessage(d.type, d.body);
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
    ...(mediaPath ? { media_path: mediaPath, media_mime: mediaMime } : {}),
    sender_name: d.contact?.pushName ?? d.contact?.name ?? null,
    provider_message_id: d.id ?? null,
    // STOP / START are handled automatically — nothing to answer
    read_at: wantsStop || wantsStart ? new Date().toISOString() : null,
  }, { onConflict: 'provider_message_id', ignoreDuplicates: true });
  if (insertError) console.error('[whatsapp webhook] inbox insert failed:', insertError.message);

  if (!wantsStop && !wantsStart) {
    if (!insertError && !unreadBefore) {
      await notifyAdminsOfMessage(db, member?.name ?? d.contact?.pushName ?? (phone ? `+${phone}` : 'a contact'), mediaPath ? `📷 ${body || 'Photo'}` : body, contact)
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
