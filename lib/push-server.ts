import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase-server';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Sends a push notification to every subscribed device across all members.
// Dead subscriptions (410 Gone / 404 Not Found — the browser or user revoked
// permission) are deleted as they're discovered, keeping the table clean.
export async function sendPushToAllMembers(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const db = createAdminClient();
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth');

  const rows = (subs ?? []) as SubscriptionRow[];
  if (rows.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(rows.map(async row => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        body,
      );
      sent++;
    } catch (err) {
      failed++;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) staleIds.push(row.id);
      else console.error('[push] send failed:', status, (err as Error).message);
    }
  }));

  if (staleIds.length > 0) {
    await db.from('push_subscriptions').delete().in('id', staleIds);
  }

  return { sent, failed };
}
