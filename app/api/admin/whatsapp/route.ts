import { requireAdmin } from '@/lib/admin-auth';
import type { createAdminClient } from '@/lib/supabase-server';
import { whatsappProvider, getOpenWaSession, openWaStart, openWaQr, openWaLogout, openWaEnsureWebhook } from '@/lib/whatsapp';

// Admin → Messages → WhatsApp connection.
// GET  → provider, connection status, linked phone, queue totals
// POST { action: 'connect' } → create/start the OpenWA session; returns QR when pairing
// POST { action: 'qr' }      → current QR (poll while pairing)
// POST { action: 'disconnect' } → unlink the number
export const dynamic = 'force-dynamic';

async function queueStats(db: ReturnType<typeof createAdminClient>) {
  const c = async (status: string) => (await db.from('whatsapp_queue').select('id', { count: 'exact', head: true }).eq('status', status)).count ?? 0;
  const [pending, sending, failed] = await Promise.all([c('pending'), c('sending'), c('failed')]);
  return { pending: pending + sending, failed };
}

export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const provider = whatsappProvider();
  const queue = await queueStats(a.db).catch(() => ({ pending: 0, failed: 0 }));
  const perMinute = Math.max(1, Math.min(10, Number(process.env.WHATSAPP_PER_MINUTE) || 4));
  if (provider !== 'openwa') return Response.json({ provider, status: provider ? 'ready' : 'not_configured', queue, perMinute });
  try {
    const s = await getOpenWaSession();
    // Keeps the webhook's events current (e.g. read receipts added later)
    if (s?.status === 'ready') await openWaEnsureWebhook(s.id).catch(e => console.error('[whatsapp] webhook update failed:', (e as Error).message));
    return Response.json({ provider, status: s?.status ?? 'no_session', phone: s?.phone ?? null, name: s?.pushName ?? null, lastError: s?.lastError ?? null, restriction: s?.restriction ?? null, queue, perMinute });
  } catch (e) {
    return Response.json({ provider, status: 'unreachable', error: (e as Error).message, queue, perMinute });
  }
}

export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  if (whatsappProvider() !== 'openwa') return Response.json({ error: 'OpenWA is not configured (OPENWA_URL / OPENWA_API_KEY).' }, { status: 400 });
  const { action } = await request.json().catch(() => ({})) as { action?: string };
  try {
    if (action === 'connect') {
      const s = await getOpenWaSession(true);
      if (!s) throw new Error('Could not create a WhatsApp session');
      // Already waiting for a scan (e.g. after WhatsApp logged the number out): just show the QR
      let startError: string | null = null;
      if (s.status !== 'ready' && s.status !== 'qr_ready') {
        await openWaStart(s.id).catch(e => { startError = (e as Error).message; });
      }
      await openWaEnsureWebhook(s.id).catch(e => console.error('[whatsapp] webhook register failed:', (e as Error).message));
      const qr = s.status === 'ready' ? null : await openWaQr(s.id);
      if (!qr && startError && s.status !== 'ready') throw new Error(startError);
      return Response.json({ ok: true, status: s.status, qr });
    }
    if (action === 'qr') {
      const s = await getOpenWaSession();
      if (!s) return Response.json({ status: 'no_session', qr: null });
      return Response.json({ status: s.status, phone: s.phone, qr: s.status === 'ready' ? null : await openWaQr(s.id) });
    }
    if (action === 'disconnect') {
      const s = await getOpenWaSession();
      if (s) await openWaLogout(s.id);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
