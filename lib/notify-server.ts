import { createAdminClient } from '@/lib/supabase-server';
import { sendPushToAllMembers, sendPushToMembers } from '@/lib/push-server';

// Notification types shown in the member notification bell (components/member/NotificationBell.tsx)
// and used to route a tap to the right screen (see LINKS in that file).
export type NotificationType =
  | 'session_created' | 'session_live' | 'session_reminder'
  | 'form_published'
  | 'learning_published'
  | 'devotion_reminder'
  | 'goal_reminder' | 'milestone_overdue';

interface NotifyOptions {
  type: NotificationType;
  message: string;
  title?: string;
  url?: string;
  referenceId?: string;
}

// Writes one in-app reminder row per member + sends a push to their devices.
// Server-only (uses the service-role client to bypass RLS on insert).
export async function notifyMembers(memberIds: string[], opts: NotifyOptions): Promise<{ notified: number }> {
  const ids = Array.from(new Set(memberIds));
  if (ids.length === 0) return { notified: 0 };

  const db = createAdminClient();
  const now = new Date().toISOString();
  await db.from('reminders').insert(ids.map(memberId => ({
    member_id: memberId,
    type: opts.type,
    reference_id: opts.referenceId ?? null,
    message: opts.message,
    scheduled_at: now,
    sent_at: now,
    channel: 'push',
  })));

  await sendPushToMembers(ids, { title: opts.title ?? 'SODE', body: opts.message, url: opts.url });
  return { notified: ids.length };
}

// Same as notifyMembers, but targets every onboarded member. Used for
// broadcast-style events (new session, new learning content) where there's
// no smaller audience to compute.
export async function notifyAllMembers(opts: NotifyOptions): Promise<{ notified: number }> {
  const db = createAdminClient();
  const { data: members } = await db.from('members').select('id').eq('onboarding_complete', true);
  const ids = ((members ?? []) as { id: string }[]).map(m => m.id);
  if (ids.length === 0) return { notified: 0 };

  const now = new Date().toISOString();
  await db.from('reminders').insert(ids.map(memberId => ({
    member_id: memberId,
    type: opts.type,
    reference_id: opts.referenceId ?? null,
    message: opts.message,
    scheduled_at: now,
    sent_at: now,
    channel: 'push',
  })));

  await sendPushToAllMembers({ title: opts.title ?? 'SODE', body: opts.message, url: opts.url });
  return { notified: ids.length };
}
