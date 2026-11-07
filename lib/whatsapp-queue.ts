import { createAdminClient } from '@/lib/supabase-server';
import { sendWhatsApp, sendWhatsAppImage, whatsappProvider, getOpenWaSession, normalizePhone, type SendResult } from '@/lib/whatsapp';
import { signedMediaUrl } from '@/lib/whatsapp-media';
import { logOutbound } from '@/lib/whatsapp-inbox';

// Paced WhatsApp delivery. Messages are queued (whatsapp_queue) and sent by
// /api/cron/tick a few per minute with random gaps, so a broadcast to any
// number of members neither times out nor looks like a burst to WhatsApp.
// Each row is claimed atomically ('pending' → 'sending') so overlapping
// ticks can never double-send.

type DB = ReturnType<typeof createAdminClient>;

const PER_TICK = Math.max(1, Math.min(10, Number(process.env.WHATSAPP_PER_MINUTE) || 4));
const GAP_MS: [number, number] = [3_000, 6_000];
const MAX_ATTEMPTS = 3;

export interface QueueItem { memberId: string | null; phone: string; body: string; mediaPath?: string | null }

export async function enqueueWhatsApp(db: DB, groupMessageId: string | null, items: QueueItem[]): Promise<number> {
  const rows = items
    .map(i => ({ ...i, phone: normalizePhone(i.phone) }))
    .filter((i): i is QueueItem & { phone: string } => !!i.phone)
    .map(i => ({ group_message_id: groupMessageId, member_id: i.memberId, phone: i.phone, body: i.body, ...(i.mediaPath ? { media_path: i.mediaPath } : {}) }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('whatsapp_queue').insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

async function refreshBroadcastCounts(db: DB, groupMessageId: string) {
  const count = async (status: string) =>
    (await db.from('whatsapp_queue').select('id', { count: 'exact', head: true }).eq('group_message_id', groupMessageId).eq('status', status)).count ?? 0;
  const [sent, failed, pending, sending] = await Promise.all([count('sent'), count('failed'), count('pending'), count('sending')]);
  await db.from('group_messages').update({ sent_count: sent, failed_count: failed, pending_count: pending + sending }).eq('id', groupMessageId);
}

export async function processWhatsAppQueue(): Promise<{ sent: number; failed: number; skipped?: string } | null> {
  const provider = whatsappProvider();
  if (!provider) return null;
  const db = createAdminClient();

  // Recover rows left 'sending' by a tick that died mid-send (>10 min)
  await db.from('whatsapp_queue').update({ status: 'pending' })
    .eq('status', 'sending').lt('send_after', new Date(Date.now() - 10 * 60_000).toISOString());

  const { data: due } = await db.from('whatsapp_queue').select('id')
    .eq('status', 'pending').lte('send_after', new Date().toISOString())
    .order('created_at').limit(PER_TICK);
  if (!due?.length) return null;

  let sessionId: string | undefined;
  if (provider === 'openwa') {
    try {
      const s = await getOpenWaSession();
      if (!s || s.status !== 'ready') return { sent: 0, failed: 0, skipped: `WhatsApp not connected (${s?.status ?? 'no session'})` };
      sessionId = s.id;
    } catch (e) {
      return { sent: 0, failed: 0, skipped: (e as Error).message };
    }
  }

  let sent = 0, failed = 0;
  const touched = new Set<string>();
  for (let i = 0; i < due.length; i++) {
    // Claim the row; another tick may already have it
    const { data: claimed } = await db.from('whatsapp_queue')
      .update({ status: 'sending', send_after: new Date().toISOString() })
      .eq('id', due[i].id).eq('status', 'pending')
      .select('*').maybeSingle();
    if (!claimed) continue;

    // With an image: a fresh link for the gateway, the text as its caption
    let r: SendResult;
    if (claimed.media_path) {
      const link = await signedMediaUrl(db, claimed.media_path).catch(() => null);
      r = link
        ? await sendWhatsAppImage(`${claimed.phone}@c.us`, link, claimed.body, sessionId)
        : { ok: false, provider, error: 'Attached image is missing from storage' };
    } else {
      r = await sendWhatsApp(claimed.phone, claimed.body, sessionId);
    }
    // Paused, not failed: the gateway's daily limit for a young number (429) or
    // the number being disconnected (409). Put it back without using up an
    // attempt, hold everything else waiting, and stop this round.
    const paused = !r.ok && /OpenWA 429|Daily allowance|OpenWA 409|not connected|not ready/i.test(r.error ?? '');
    if (paused) {
      const limit = /429|Daily allowance/i.test(r.error ?? '');
      const until = new Date(Date.now() + (limit ? 60 : 5) * 60_000).toISOString();
      await db.from('whatsapp_queue').update({ status: 'pending', last_error: r.error ?? null, send_after: until }).eq('id', claimed.id);
      await db.from('whatsapp_queue').update({ send_after: until }).eq('status', 'pending').lt('send_after', until);
      if (claimed.group_message_id) touched.add(claimed.group_message_id);
      break;
    }

    const attempts = (claimed.attempts ?? 0) + 1;
    if (r.ok) {
      sent++;
      await db.from('whatsapp_queue').update({ status: 'sent', attempts, sent_at: new Date().toISOString(), provider: r.provider, provider_message_id: r.messageId ?? null, last_error: null }).eq('id', claimed.id);
      await logOutbound(db, { phone: claimed.phone, body: claimed.body, memberId: claimed.member_id, providerMessageId: r.messageId, mediaPath: claimed.media_path ?? null });
    } else if (attempts < MAX_ATTEMPTS) {
      // retry later with backoff: 5 min, then 30 min
      await db.from('whatsapp_queue').update({ status: 'pending', attempts, last_error: r.error ?? null, send_after: new Date(Date.now() + (attempts === 1 ? 5 : 30) * 60_000).toISOString() }).eq('id', claimed.id);
    } else {
      failed++;
      await db.from('whatsapp_queue').update({ status: 'failed', attempts, last_error: r.error ?? null, provider: r.provider }).eq('id', claimed.id);
    }
    if (claimed.group_message_id) touched.add(claimed.group_message_id);
    if (i < due.length - 1) await new Promise(res => setTimeout(res, GAP_MS[0] + Math.random() * (GAP_MS[1] - GAP_MS[0])));
  }
  for (const id of Array.from(touched)) await refreshBroadcastCounts(db, id);
  return { sent, failed };
}

export async function cancelBroadcast(db: DB, groupMessageId: string): Promise<number> {
  const { data } = await db.from('whatsapp_queue').update({ status: 'cancelled' })
    .eq('group_message_id', groupMessageId).eq('status', 'pending').select('id');
  await refreshBroadcastCounts(db, groupMessageId);
  return data?.length ?? 0;
}
