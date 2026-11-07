import { requireAdmin } from '@/lib/admin-auth';
import { resolveAudienceMembers, type FormAudience } from '@/lib/forms-audience';
import { whatsappProvider, OPT_OUT_FOOTER } from '@/lib/whatsapp';
import { personalize } from '@/lib/message-fields';
import { loadPersonalizeData } from '@/lib/message-fields-server';
import { isOurMediaPath } from '@/lib/whatsapp-media';
import { enqueueWhatsApp, cancelBroadcast, cancelQueued, cancelAllPending, refreshBroadcastCounts } from '@/lib/whatsapp-queue';

// Queue a WhatsApp broadcast. Sending happens a few messages per minute via
// /api/cron/tick (lib/whatsapp-queue.ts), so any audience size works and the
// pace stays human. Only members who opted in to WhatsApp are included.
export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;

  const { message, audience, media_path } = await request.json().catch(() => ({})) as { message?: string; audience?: FormAudience; media_path?: string };
  const mediaPath = isOurMediaPath(media_path) ? media_path : null;
  if (!message?.trim() && !mediaPath) return Response.json({ error: 'Write a message or attach an image.' }, { status: 400 });
  const text = message?.trim() ?? '';
  if (text.length > 3800) return Response.json({ error: 'Message is too long (max 3,800 characters).' }, { status: 400 });
  if (!audience) return Response.json({ error: 'Audience is required' }, { status: 400 });
  if (!whatsappProvider()) return Response.json({ error: 'WhatsApp is not set up yet — connect it first.' }, { status: 400 });

  const members = await resolveAudienceMembers(a.db, audience);
  if (members.length === 0) {
    return Response.json({ error: 'No members in this audience have a WhatsApp number and WhatsApp alerts switched on.' }, { status: 400 });
  }

  const { data: gm, error } = await a.db.from('group_messages').insert({
    sender_id: a.userId,
    body: text || '📷 Photo',
    ...(mediaPath ? { media_path: mediaPath } : {}),
    audience,
    channel: 'whatsapp',
    recipient_count: members.length,
    sent_count: 0,
    failed_count: 0,
    pending_count: members.length,
  }).select('id').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Each person gets their own copy, filled from their record ({{first_name}}, {{cell}}, …)
  const details = await loadPersonalizeData(a.db, members.map(m => m.id));
  const queued = await enqueueWhatsApp(a.db, gm.id, members.map(m => ({
    memberId: m.id,
    phone: m.whatsapp,
    body: (text ? personalize(text, details.get(m.id) ?? m) : '') + OPT_OUT_FOOTER,
    mediaPath,
  })));
  if (queued !== members.length) {
    await a.db.from('group_messages').update({ recipient_count: queued, pending_count: queued }).eq('id', gm.id);
  }

  const perMinute = Math.max(1, Math.min(10, Number(process.env.WHATSAPP_PER_MINUTE) || 4));
  return Response.json({ ok: true, id: gm.id, queued, skipped: members.length - queued, minutes: Math.ceil(queued / perMinute) });
}

// Recent broadcasts with live progress
// ?people=1 → every member with a WhatsApp number plus their personalisation
//             details, for the compose preview and "missing value" warnings
export async function GET(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  if (new URL(request.url).searchParams.get('people')) {
    const { data: ms } = await a.db.from('members').select('id, consent_contact, pillar')
      .eq('onboarding_complete', true).not('whatsapp', 'is', null).order('name');
    const base = (ms ?? []) as { id: string; consent_contact: boolean; pillar: string | null }[];
    const [details, { data: cms }] = await Promise.all([
      loadPersonalizeData(a.db, base.map(m => m.id)),
      a.db.from('cell_members').select('member_id, cell_id'),
    ]);
    const cellIds = new Map<string, string[]>();
    for (const cm of (cms ?? []) as { member_id: string; cell_id: string }[]) {
      cellIds.set(cm.member_id, [...(cellIds.get(cm.member_id) ?? []), cm.cell_id]);
    }
    const people = base.map(m => ({ ...details.get(m.id), id: m.id, consent_contact: m.consent_contact, pillar: m.pillar, cell_ids: cellIds.get(m.id) ?? [] }))
      .filter(p => p.name);
    return Response.json({ people });
  }
  // ?recipients=<broadcast id> → who it goes to, with each person's status
  const rid = new URL(request.url).searchParams.get('recipients');
  if (rid) {
    const { data: rows } = await a.db.from('whatsapp_queue')
      .select('id, member_id, phone, status, last_error, sent_at, send_after, attempts')
      .eq('group_message_id', rid).order('created_at').limit(2000);
    const list = (rows ?? []) as { id: string; member_id: string | null; phone: string; status: string; last_error: string | null; sent_at: string | null; send_after: string; attempts: number }[];
    const ids = Array.from(new Set(list.map(r => r.member_id).filter((x): x is string => !!x)));
    const names = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: ms } = await a.db.from('members').select('id, name').in('id', ids.slice(i, i + 200));
      for (const m of (ms ?? []) as { id: string; name: string }[]) names.set(m.id, m.name);
    }
    return Response.json({ recipients: list.map(r => ({ ...r, name: (r.member_id && names.get(r.member_id)) || `+${r.phone}` })) });
  }

  const { data } = await a.db.from('group_messages').select('*').order('created_at', { ascending: false }).limit(20);
  const history = (data ?? []) as { id: string; pending_count?: number }[];
  // Keep "waiting" honest for broadcasts still in progress
  const live = history.filter(h => (h.pending_count ?? 0) > 0);
  if (live.length) {
    await Promise.all(live.map(h => refreshBroadcastCounts(a.db, h.id)));
    const { data: fresh } = await a.db.from('group_messages').select('*').in('id', live.map(h => h.id));
    const byId = new Map(((fresh ?? []) as { id: string }[]).map(f => [f.id, f]));
    return Response.json({ history: history.map(h => byId.get(h.id) ?? h), queue: await pendingTotal(a.db) });
  }
  return Response.json({ history, queue: await pendingTotal(a.db) });
}

async function pendingTotal(db: Parameters<typeof cancelBroadcast>[0]): Promise<number> {
  const { count } = await db.from('whatsapp_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  return count ?? 0;
}

// Cancel messages that haven't gone out yet:
//   { id }        → the rest of one broadcast
//   { queue_id }  → one person's message
//   { all: true } → everything still waiting, every broadcast
// Messages already sent stay sent.
export async function DELETE(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { id, queue_id, all } = await request.json().catch(() => ({})) as { id?: string; queue_id?: string; all?: boolean };
  if (id) return Response.json({ ok: true, cancelled: await cancelBroadcast(a.db, id) });
  if (queue_id) return Response.json({ ok: true, cancelled: await cancelQueued(a.db, queue_id) });
  if (all) return Response.json({ ok: true, cancelled: await cancelAllPending(a.db) });
  return Response.json({ error: 'Nothing to cancel' }, { status: 400 });
}
