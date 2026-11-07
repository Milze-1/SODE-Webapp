'use client';
import { useCallback, useEffect, useState } from 'react';

// Everyone a broadcast goes to, with where each message is — and a way to
// cancel the ones that haven't gone out yet (one by one, or all at once).

interface Recipient {
  id: string; name: string; phone: string; status: string;
  last_error: string | null; sent_at: string | null; send_after: string;
}

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending:   { label: 'Waiting',   bg: '#fffbeb', fg: '#92400e' },
  sending:   { label: 'Sending…',  bg: '#eff6ff', fg: '#1d4ed8' },
  sent:      { label: 'Sent',      bg: '#ecfdf5', fg: '#047857' },
  failed:    { label: 'Failed',    bg: '#fef2f2', fg: '#b91c1c' },
  cancelled: { label: 'Cancelled', bg: 'var(--bg)', fg: 'var(--muted)' },
};

const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function BroadcastRecipients({ broadcastId, onChanged }: { broadcastId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<Recipient[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/messages/send?recipients=${encodeURIComponent(broadcastId)}`).catch(() => null);
    if (r?.ok) setRows(((await r.json()) as { recipients: Recipient[] }).recipients);
  }, [broadcastId]);

  const waiting = rows?.filter(r => r.status === 'pending').length ?? 0;
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [waiting, load]);

  const cancel = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    await fetch('/api/admin/messages/send', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    await load();
    onChanged();
    setBusy(null);
  };

  if (!rows) return <div style={{ padding: 14, fontSize: 12.5, color: 'var(--muted)' }}>Loading recipients…</div>;
  if (rows.length === 0) return <div style={{ padding: 14, fontSize: 12.5, color: 'var(--muted)' }}>No recipients recorded for this message.</div>;

  const counts = rows.reduce<Record<string, number>>((c, r) => { c[r.status] = (c[r.status] ?? 0) + 1; return c; }, {});
  const shown = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  return (
    <div style={{ padding: '12px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {['all', 'pending', 'sent', 'failed', 'cancelled'].filter(k => k === 'all' || counts[k]).map(k => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: filter === k ? 'var(--navy)' : 'var(--surface)', color: filter === k ? '#fff' : 'var(--ink-2)', border: filter === k ? '1px solid var(--navy)' : '1px solid var(--line-2)' }}>
            {k === 'all' ? `All ${rows.length}` : `${STATUS[k].label} ${counts[k]}`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {waiting > 0 && (
          <button type="button" disabled={busy !== null} className="btn btn-sm"
            onClick={() => { if (window.confirm(`Cancel the ${waiting} message${waiting === 1 ? '' : 's'} that haven't gone out yet? Messages already sent stay sent.`)) cancel({ id: broadcastId }, 'all'); }}
            style={{ height: 28, fontSize: 12, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            {busy === 'all' ? 'Cancelling…' : `Cancel ${waiting} unsent`}
          </button>
        )}
      </div>

      <div className="slim-scroll" style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 10, background: 'var(--surface)' }}>
        {shown.map(r => {
          const s = STATUS[r.status] ?? STATUS.pending;
          const later = r.status === 'pending' && new Date(r.send_after).getTime() > Date.now() + 60_000;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={r.status === 'failed' ? r.last_error ?? undefined : undefined}>
                  {r.status === 'sent' && r.sent_at ? `Sent ${time(r.sent_at)}`
                    : later ? `Paused — next try ${time(r.send_after)}`
                    : r.status === 'failed' ? (r.last_error ?? 'Could not send').replace(/^OpenWA \d+: /, '').slice(0, 90)
                    : `+${r.phone}`}
                </div>
              </div>
              <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.fg, flex: 'none' }}>{s.label}</span>
              {r.status === 'pending' && (
                <button type="button" disabled={busy !== null} onClick={() => cancel({ queue_id: r.id }, r.id)}
                  className="btn btn-ghost btn-sm" title={`Don't send to ${r.name}`} style={{ height: 26, padding: '0 9px', fontSize: 11.5, flex: 'none' }}>
                  {busy === r.id ? '…' : 'Cancel'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
