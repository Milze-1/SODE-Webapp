import { createAdminClient } from '@/lib/supabase-server';
import { wantsEmail, wantsPush, type NotificationPrefs } from '@/lib/notification-prefs';

const CHUNK = 200; // keep `.in(...)` URLs a sane length

// Loads notification_prefs for the given members. Fails open: if the query
// errors (e.g. migration 015 not applied yet) everyone is treated as opted in,
// so a prefs problem can never silently stop all notifications.
export async function loadNotificationPrefs(memberIds: string[]): Promise<Map<string, NotificationPrefs>> {
  const prefs = new Map<string, NotificationPrefs>();
  const ids = Array.from(new Set(memberIds));
  if (ids.length === 0) return prefs;

  const db = createAdminClient();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await db
      .from('members')
      .select('id, notification_prefs')
      .in('id', ids.slice(i, i + CHUNK));
    if (error) {
      console.error('[notification-prefs] load failed, defaulting to all on:', error.message);
      return new Map();
    }
    for (const row of (data ?? []) as { id: string; notification_prefs: NotificationPrefs | null }[]) {
      prefs.set(row.id, row.notification_prefs ?? {});
    }
  }
  return prefs;
}

export async function filterPushRecipients(memberIds: string[], type: string): Promise<string[]> {
  const prefs = await loadNotificationPrefs(memberIds);
  return memberIds.filter(id => wantsPush(prefs.get(id), type));
}

export async function emailRecipientSet(memberIds: string[], type: string): Promise<Set<string>> {
  const prefs = await loadNotificationPrefs(memberIds);
  return new Set(memberIds.filter(id => wantsEmail(prefs.get(id), type)));
}
