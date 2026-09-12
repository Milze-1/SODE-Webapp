'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient, getAuthUser } from '@/lib/supabase';

export interface NotificationRow {
  id: string; type: string; message: string; reference_id: string | null;
  created_at: string; read_at: string | null;
}

export const NOTIFICATION_LINKS: Record<string, string> = {
  session_created:    '/member/attendance',
  session_live:       '/member/attendance',
  session_reminder:   '/member/attendance',
  form_published:     '/member/forms',
  learning_published: '/member/learning',
  devotion_reminder:  '/member/devotion',
  goal_reminder:      '/member/goals',
  milestone_overdue:  '/member/goals',
};

// Shared in-app notification state (backed by the `reminders` table) for the
// member app — one Supabase realtime subscription per mounted consumer.
// Kept intentionally small (fetched once, patched via realtime INSERT) since
// the list is capped and members rarely have more than a handful unread.
export function useNotifications() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (mid: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('reminders')
      .select('id,type,message,reference_id,created_at,read_at')
      .eq('member_id', mid)
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const user = await getAuthUser();
      if (!user || cancelled) { setLoading(false); return; }
      const { data: member } = await supabase.from('members').select('id').eq('auth_id', user.id).maybeSingle();
      if (!member || cancelled) { setLoading(false); return; }
      setMemberId(member.id);
      await load(member.id);
      if (cancelled) return;

      channel = supabase
        .channel(`member-notifications-${member.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reminders', filter: `member_id=eq.${member.id}` },
          payload => setItems(prev => [payload.new as NotificationRow, ...prev]))
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [load]);

  const unread = items.filter(i => !i.read_at).length;

  const markAllRead = async () => {
    if (!memberId) return;
    const unreadIds = items.filter(i => !i.read_at).map(i => i.id);
    if (unreadIds.length === 0) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(i => (i.read_at ? i : { ...i, read_at: now })));
    await createClient().from('reminders').update({ read_at: now }).in('id', unreadIds);
  };

  return { memberId, items, unread, loading, markAllRead };
}

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
