import { requireAdmin } from '@/lib/admin-auth';
import { sendWhatsApp, sendWhatsAppChat, sendWhatsAppImage, whatsappProvider, normalizePhone } from '@/lib/whatsapp';
import { signedMediaUrl, signedMediaUrls, isOurMediaPath } from '@/lib/whatsapp-media';
import { personalize } from '@/lib/message-fields';
import { loadPersonalizeData } from '@/lib/message-fields-server';
import { listConversations, unreadCount, logOutbound, membersByPhone, type InboxMessage } from '@/lib/whatsapp-inbox';

export const dynamic = 'force-dynamic';

// GET                 → { conversations, unread }
// GET ?count=1        → { unread }            (sidebar badge)
// GET ?contact=…      → { messages, member }  (opens the thread: marks it read)
export async function GET(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const url = new URL(request.url);

  if (url.searchParams.get('count')) return Response.json({ unread: await unreadCount(a.db) });

  const contact = url.searchParams.get('contact');
  if (!contact) {
    const [conversations, unread] = await Promise.all([listConversations(a.db), unreadCount(a.db)]);
    return Response.json({ conversations, unread });
  }

  // Everyone you can start a chat with (search in the inbox)
  if (contact === '*members') {
    const { data: ms } = await a.db.from('members').select('id, name, whatsapp, consent_contact')
      .eq('onboarding_complete', true).not('whatsapp', 'is', null).order('name');
    const members = ((ms ?? []) as { id: string; name: string; whatsapp: string; consent_contact: boolean }[])
      .map(m => ({ id: m.id, name: m.name, contact: normalizePhone(m.whatsapp), consent_contact: m.consent_contact }))
      .filter(m => m.contact);
    return Response.json({ members });
  }

  const { data } = await a.db.from('whatsapp_messages')
    .select('*')
    .eq('contact', contact).order('created_at', { ascending: false }).limit(200);
  const rows = ((data ?? []) as InboxMessage[]).reverse();
  // Photos: short-lived links for the page to show
  const links = await signedMediaUrls(a.db, rows.map(m => m.media_path ?? '').filter(Boolean)).catch(() => new Map<string, string>());
  const messages = rows.map(m => ({ ...m, media_url: m.media_path ? links.get(m.media_path) ?? null : null }));

  if (url.searchParams.get('markRead') !== '0') {
    await a.db.from('whatsapp_messages').update({ read_at: new Date().toISOString() })
      .eq('contact', contact).eq('direction', 'in').is('read_at', null);
  }

  // A brand-new chat has no messages yet: find the member by number
  const memberId = messages.find(m => m.member_id)?.member_id
    ?? (/^\d{10,15}$/.test(contact) ? (await membersByPhone(a.db)).get(contact)?.id : undefined);
  let member: { id: string; name: string; whatsapp: string | null; consent_contact: boolean } | null = null;
  if (memberId) {
    const { data: m } = await a.db.from('members').select('id, name, whatsapp, consent_contact').eq('id', memberId).maybeSingle();
    member = m as typeof member;
  }
  return Response.json({ messages, member });
}

// POST { contact, body, media_path? } → reply now (not queued: it's a 1-to-1 answer).
// With media_path (from /api/admin/whatsapp/media) the image is sent and the text is its caption.
export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { contact, body, media_path } = await request.json().catch(() => ({})) as { contact?: string; body?: string; media_path?: string };
  const text = body?.trim() ?? '';
  const mediaPath = isOurMediaPath(media_path) ? media_path : null;
  if (!contact || (!text && !mediaPath)) return Response.json({ error: 'Write a message or attach an image first.' }, { status: 400 });
  if (text.length > 4000) return Response.json({ error: 'Message is too long (max 4,000 characters).' }, { status: 400 });
  if (!whatsappProvider()) return Response.json({ error: 'WhatsApp is not set up yet — connect it first.' }, { status: 400 });

  // Reply to the chat they wrote from (works for hidden-number senders too)
  const { data: last } = await a.db.from('whatsapp_messages').select('phone, chat_id, member_id')
    .eq('contact', contact).order('created_at', { ascending: false }).limit(20);
  const rows = (last ?? []) as { phone: string | null; chat_id: string | null; member_id: string | null }[];
  const phone = rows.find(r => r.phone)?.phone ?? (/^\d{10,15}$/.test(contact) ? contact : null);
  const chatId = rows.find(r => r.chat_id)?.chat_id ?? (phone ? `${phone}@c.us` : null);
  if (!chatId && !phone) return Response.json({ error: 'No WhatsApp address for this conversation.' }, { status: 400 });
  const memberId = rows.find(r => r.member_id)?.member_id ?? (phone ? (await membersByPhone(a.db)).get(phone)?.id ?? null : null);

  // Starting a conversation (they haven't written in): only with members who
  // allow WhatsApp messages — someone who replied STOP isn't messaged first.
  const { count: inbound } = await a.db.from('whatsapp_messages').select('id', { count: 'exact', head: true })
    .eq('contact', contact).eq('direction', 'in');
  if (!inbound) {
    if (!memberId) return Response.json({ error: 'You can only start a chat with a member.' }, { status: 400 });
    const { data: m } = await a.db.from('members').select('consent_contact').eq('id', memberId).maybeSingle();
    if (!(m as { consent_contact?: boolean } | null)?.consent_contact) {
      return Response.json({ error: 'This member has WhatsApp alerts switched off (or replied STOP), so you can’t message them first. You can still reply if they write in.' }, { status: 403 });
    }
  }

  // {{first_name}} etc. work here too, filled from the member's record
  let finalText = text;
  if (text.includes('{{') && memberId) {
    const m = (await loadPersonalizeData(a.db, [memberId])).get(memberId);
    if (m) finalText = personalize(text, m);
  }

  let r;
  if (mediaPath) {
    const link = await signedMediaUrl(a.db, mediaPath);
    if (!link) return Response.json({ error: 'That image could not be found — attach it again.' }, { status: 400 });
    r = await sendWhatsAppImage(chatId ?? `${phone}@c.us`, link, finalText);
  } else {
    r = chatId ? await sendWhatsAppChat(chatId, finalText) : await sendWhatsApp(phone!, finalText);
  }
  if (!r.ok) return Response.json({ error: r.error ?? 'Could not send' }, { status: 502 });

  await logOutbound(a.db, { contact, phone: phone ?? contact, chatId, body: finalText, memberId, providerMessageId: r.messageId, sentBy: a.userId, mediaPath });
  // Answering a conversation clears it from "needs reply"
  await a.db.from('whatsapp_messages').update({ read_at: new Date().toISOString() })
    .eq('contact', contact).eq('direction', 'in').is('read_at', null);
  return Response.json({ ok: true });
}

// PATCH { contact, unread: true } → mark a conversation as needing a reply again
export async function PATCH(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { contact, unread } = await request.json().catch(() => ({})) as { contact?: string; unread?: boolean };
  if (!contact) return Response.json({ error: 'contact required' }, { status: 400 });
  if (unread) {
    const { data } = await a.db.from('whatsapp_messages').select('id').eq('contact', contact).eq('direction', 'in')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data) await a.db.from('whatsapp_messages').update({ read_at: null }).eq('id', (data as { id: string }).id);
  } else {
    await a.db.from('whatsapp_messages').update({ read_at: new Date().toISOString() })
      .eq('contact', contact).eq('direction', 'in').is('read_at', null);
  }
  return Response.json({ ok: true });
}
