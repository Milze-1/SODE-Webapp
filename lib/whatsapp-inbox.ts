import { createAdminClient } from '@/lib/supabase-server';
import { normalizePhone } from '@/lib/whatsapp';
import { sendPushToMembers } from '@/lib/push-server';
import { hasAdminAccess, type Role } from '@/lib/roles';

// WhatsApp inbox: every message in or out of the linked SODE number is kept in
// whatsapp_messages (db/migrations/021_whatsapp_inbox.sql) so admins can see
// who wrote in and reply from Admin → Messages → Inbox. Server-only.

type DB = ReturnType<typeof createAdminClient>;

export interface InboxMessage {
  id: string;
  contact: string;
  phone: string | null;
  chat_id: string | null;
  member_id: string | null;
  direction: 'in' | 'out';
  body: string;
  msg_type: string;
  sender_name: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  contact: string;
  phone: string | null;
  member_id: string | null;
  name: string;
  last_body: string;
  last_direction: 'in' | 'out';
  last_at: string;
  unread: number;
}

// Members keyed by normalised phone, for matching a WhatsApp number to a person.
export async function membersByPhone(db: DB): Promise<Map<string, { id: string; name: string }>> {
  const { data } = await db.from('members').select('id, name, whatsapp').not('whatsapp', 'is', null);
  const map = new Map<string, { id: string; name: string }>();
  for (const m of (data ?? []) as { id: string; name: string; whatsapp: string }[]) {
    const p = normalizePhone(m.whatsapp);
    if (p && !map.has(p)) map.set(p, { id: m.id, name: m.name });
  }
  return map;
}

// Log a message the app sent. Never throws: a logging failure must not turn a
// delivered message into a "failed" one.
export async function logOutbound(db: DB, m: {
  phone: string; body: string; memberId?: string | null; chatId?: string | null;
  providerMessageId?: string | null; sentBy?: string | null; contact?: string;
}) {
  const { error } = await db.from('whatsapp_messages').insert({
    contact: m.contact ?? m.phone,
    phone: m.phone,
    chat_id: m.chatId ?? `${m.phone}@c.us`,
    member_id: m.memberId ?? null,
    direction: 'out',
    body: m.body,
    provider_message_id: m.providerMessageId || null,
    sent_by: m.sentBy ?? null,
    read_at: new Date().toISOString(),
  });
  if (error) console.error('[whatsapp-inbox] outbound log failed:', error.message);
}

// Text shown for a message with no caption (a photo, voice note, …)
export function describeMessage(type: string | undefined, body: string | undefined): string {
  if (body?.trim()) return body;
  const labels: Record<string, string> = {
    image: '📷 Photo', video: '🎬 Video', audio: '🎤 Voice note', ptt: '🎤 Voice note', voice: '🎤 Voice note',
    document: '📄 Document', sticker: 'Sticker', location: '📍 Location', contact: '👤 Contact', vcard: '👤 Contact',
  };
  return labels[type ?? ''] ?? `[${type ?? 'message'}]`;
}

// Push a "new WhatsApp message" alert to every admin with notifications on.
export async function notifyAdminsOfMessage(db: DB, who: string, preview: string, contact: string) {
  const { data: roles } = await db.from('user_roles').select('user_id, role');
  const adminUserIds = Array.from(new Set(((roles ?? []) as { user_id: string; role: Role }[])
    .filter(r => hasAdminAccess([r.role])).map(r => r.user_id)));
  if (adminUserIds.length === 0) return;
  const { data: admins } = await db.from('members').select('id').in('auth_id', adminUserIds);
  const ids = ((admins ?? []) as { id: string }[]).map(a => a.id);
  await sendPushToMembers(ids, {
    title: `WhatsApp from ${who}`,
    body: preview.length > 120 ? preview.slice(0, 117) + '…' : preview,
    url: `/admin/messages/inbox?c=${encodeURIComponent(contact)}`,
  });
}

// Conversations, newest first, with unread counts (inbound not yet opened).
export async function listConversations(db: DB): Promise<Conversation[]> {
  const { data } = await db.from('whatsapp_messages')
    .select('contact, phone, member_id, direction, body, sender_name, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as Pick<InboxMessage, 'contact' | 'phone' | 'member_id' | 'direction' | 'body' | 'sender_name' | 'read_at' | 'created_at'>[];

  const byContact = new Map<string, Conversation & { sender_name: string | null }>();
  for (const r of rows) {
    let c = byContact.get(r.contact);
    if (!c) {
      c = { contact: r.contact, phone: r.phone, member_id: r.member_id, name: '', last_body: r.body, last_direction: r.direction, last_at: r.created_at, unread: 0, sender_name: null };
      byContact.set(r.contact, c);
    }
    if (!c.member_id && r.member_id) c.member_id = r.member_id;
    if (!c.phone && r.phone) c.phone = r.phone;
    if (!c.sender_name && r.direction === 'in' && r.sender_name) c.sender_name = r.sender_name;
    if (r.direction === 'in' && !r.read_at) c.unread++;
  }

  const memberIds = Array.from(new Set(Array.from(byContact.values()).map(c => c.member_id).filter((x): x is string => !!x)));
  const names = new Map<string, string>();
  if (memberIds.length) {
    const { data: ms } = await db.from('members').select('id, name').in('id', memberIds);
    for (const m of (ms ?? []) as { id: string; name: string }[]) names.set(m.id, m.name);
  }
  return Array.from(byContact.values()).map(({ sender_name, ...c }) => ({
    ...c,
    name: (c.member_id && names.get(c.member_id)) || sender_name || (c.phone ? `+${c.phone}` : 'Unknown'),
  }));
}

export async function unreadCount(db: DB): Promise<{ messages: number; conversations: number }> {
  const { data } = await db.from('whatsapp_messages').select('contact')
    .eq('direction', 'in').is('read_at', null).limit(5000);
  const rows = (data ?? []) as { contact: string }[];
  return { messages: rows.length, conversations: new Set(rows.map(r => r.contact)).size };
}
