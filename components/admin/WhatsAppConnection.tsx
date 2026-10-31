'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Panel } from '@/components/admin/chrome';

// Admin → Messages → WhatsApp connection (OpenWA). Shows whether the
// sending number is linked, and walks through linking it by QR.
interface Status {
  provider: 'openwa' | 'termii' | null; status: string; phone?: string | null; name?: string | null;
  error?: string; lastError?: string | null; restriction?: { kind?: string } | null;
  queue: { pending: number; failed: number }; perMinute: number;
}

const LABEL: Record<string, { text: string; tone: 'ok' | 'warn' | 'bad' }> = {
  ready: { text: 'Connected', tone: 'ok' },
  qr_ready: { text: 'Waiting for QR scan', tone: 'warn' },
  authenticating: { text: 'Linking…', tone: 'warn' },
  initializing: { text: 'Starting…', tone: 'warn' },
  created: { text: 'Not started', tone: 'warn' },
  no_session: { text: 'Not connected', tone: 'warn' },
  disconnected: { text: 'Disconnected', tone: 'bad' },
  action_required: { text: 'Action needed on the phone', tone: 'bad' },
  failed: { text: 'Failed', tone: 'bad' },
  unreachable: { text: 'Gateway unreachable', tone: 'bad' },
  not_configured: { text: 'Not set up', tone: 'bad' },
};

export default function WhatsAppConnection({ onStatus }: { onStatus?: (ready: boolean) => void }) {
  const [s, setS] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/whatsapp').catch(() => null);
    const j = r?.ok ? await r.json() as Status : null;
    setS(j);
    onStatus?.(!!j && j.status === 'ready');
    return j;
  }, [onStatus]);

  useEffect(() => { load(); return () => { if (poll.current) clearInterval(poll.current); }; }, [load]);

  const stopPolling = () => { if (poll.current) { clearInterval(poll.current); poll.current = null; } };

  const connect = async () => {
    setBusy(true); setErr(null);
    const r = await fetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) as { qr?: string | null; status?: string; error?: string } : {};
    setBusy(false);
    if (!r?.ok) { setErr(j.error ?? 'Could not reach the WhatsApp gateway.'); return; }
    setQr(j.qr ?? null);
    stopPolling();
    // Poll for a fresh QR / the linked state while pairing (QR codes rotate)
    poll.current = setInterval(async () => {
      const pr = await fetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'qr' }) }).catch(() => null);
      const pj = pr?.ok ? await pr.json() as { status: string; qr: string | null } : null;
      if (!pj) return;
      if (pj.status === 'ready') { stopPolling(); setQr(null); load(); }
      else if (pj.qr) setQr(pj.qr);
    }, 4000);
  };

  const disconnect = async () => {
    if (!window.confirm('Unlink this WhatsApp number? Queued messages will wait until a number is linked again.')) return;
    setBusy(true);
    await fetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) }).catch(() => null);
    setBusy(false);
    load();
  };

  if (!s) return <Panel title="WhatsApp connection"><div style={{ fontSize: 13, color: 'var(--muted)' }}>Checking…</div></Panel>;

  const label = LABEL[s.status] ?? { text: s.status, tone: 'warn' as const };
  const toneColor = label.tone === 'ok' ? '#166534' : label.tone === 'warn' ? '#92400e' : '#991b1b';
  const toneBg = label.tone === 'ok' ? '#dcfce7' : label.tone === 'warn' ? '#fef3c7' : '#fee2e2';

  return (
    <Panel title="WhatsApp connection">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: toneBg, color: toneColor }}>{label.text}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {s.provider === 'openwa' ? 'Via OpenWA' : s.provider === 'termii' ? 'Via Termii' : ''}
          {s.phone ? ` · +${s.phone}${s.name ? ` (${s.name})` : ''}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        {s.provider === 'openwa' && s.status !== 'ready' && (
          <button className="btn btn-primary btn-sm" onClick={connect} disabled={busy}>{busy ? 'Starting…' : qr ? 'Refresh QR' : 'Connect WhatsApp'}</button>
        )}
        {s.provider === 'openwa' && s.status === 'ready' && (
          <button className="btn btn-ghost btn-sm" onClick={disconnect} disabled={busy}>Disconnect</button>
        )}
      </div>

      {s.provider === null && (
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, margin: '12px 0 0' }}>
          WhatsApp sending isn&apos;t set up yet. Deploy the OpenWA gateway and add <code>OPENWA_URL</code>, <code>OPENWA_API_KEY</code> and <code>OPENWA_WEBHOOK_SECRET</code> to the app&apos;s environment — see <code>deploy/openwa/README.md</code>.
        </p>
      )}
      {s.status === 'unreachable' && <p style={{ fontSize: 12.5, color: '#991b1b', margin: '10px 0 0' }}>{s.error}</p>}
      {s.lastError && s.status !== 'ready' && <p style={{ fontSize: 12.5, color: '#991b1b', margin: '10px 0 0' }}>Last error: {s.lastError}</p>}
      {s.restriction && <p style={{ fontSize: 12.5, color: '#991b1b', margin: '10px 0 0' }}>WhatsApp has restricted this number. Pause broadcasts until it lifts.</p>}
      {err && <p style={{ fontSize: 12.5, color: '#991b1b', margin: '10px 0 0' }}>{err}</p>}

      {qr && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the gateway */}
          <img src={qr} alt="WhatsApp pairing QR code" width={220} height={220} style={{ borderRadius: 12, border: '1px solid var(--line-2)', background: '#fff' }} />
          <ol style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0, paddingLeft: 18, maxWidth: 320 }}>
            <li>On the phone with the SODE WhatsApp number, open WhatsApp.</li>
            <li>Go to <strong>Settings → Linked devices → Link a device</strong>.</li>
            <li>Scan this code. It refreshes automatically.</li>
          </ol>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
        <span><Icon name="clock" size={13} /> {s.queue.pending} waiting to send</span>
        {s.queue.failed > 0 && <span style={{ color: '#991b1b' }}>{s.queue.failed} failed</span>}
        <span>Pace: about {s.perMinute} per minute</span>
      </div>
    </Panel>
  );
}
