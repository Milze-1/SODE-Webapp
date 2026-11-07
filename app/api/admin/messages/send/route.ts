import { requireAdmin } from '@/lib/admin-auth';
import { resolveAudienceMembers, type FormAudience } from '@/lib/forms-audience';
import { whatsappProvider, OPT_OUT_FOOTER } from '@/lib/whatsapp';
import { personalize } from '@/lib/message-fields';
import { loadPersonalizeData } from '@/lib/message-fields-server';
import { isOurMediaPath } from '@/lib/whatsapp-media';
import { enqueueWhatsApp, cancelBroadcast } from '@/lib/whatsapp-queue';

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
  const { data } = await a.db.from('group_messages').select('*').order('created_at', { ascending: false }).limit(20);
  return Response.json({ history: data ?? [] });
}

// Stop the rest of a broadcast: { id }
export async function DELETE(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  return Response.json({ ok: true, cancelled: await cancelBroadcast(a.db, id) });
}
