'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';

// Admin → Members → "Merge with another account…"
// Pick the duplicate, preview both accounts side by side (what each holds and
// when each last signed in), choose which one to keep, then merge via
// /api/admin/members/merge.

interface Candidate { id: string; name: string; email: string | null }
interface Preview {
  id: string; name: string; email: string | null; whatsapp: string | null; created_at: string;
  profile_complete: boolean | null; points: number | null; last_sign_in_at: string | null;
  counts: Record<string, number>;
}

const COUNT_LABELS: [key: string, label: string][] = [
  ['attendance_records.member_id', 'Check-ins'], ['goals.member_id', 'Goals'], ['wins.member_id', 'Wins'],
  ['devotion_checkins.member_id', 'Devotion check-ins'], ['form_responses.member_id', 'Form responses'],
  ['point_events.member_id', 'Point events'], ['mentor_pairings.mentee_id', 'Mentor pairings'],
];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export default function MergeAccountsModal({ base, members, onClose, onMerged }: {
  base: Candidate;
  members: Candidate[];
  onClose: () => void;
  onMerged: (keptId: string, droppedId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [other, setOther] = useState<Candidate | null>(null);
  const [preview, setPreview] = useState<{ a: Preview; b: Preview } | null>(null);
  const [keepId, setKeepId] = useState<string | null>(null);
  const [deleteLogin, setDeleteLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => members.filter(m => m.id !== base.id && norm(m.name) === norm(base.name)), [members, base]);
  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    return members.filter(m => m.id !== base.id && (norm(m.name).includes(q) || (m.email ?? '').toLowerCase().includes(q))).slice(0, 8);
  }, [members, base, query]);

  // Load the side-by-side preview once a duplicate is chosen
  useEffect(() => {
    if (!other) { setPreview(null); return; }
    setError(null);
    fetch('/api/admin/members/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepId: base.id, dropId: other.id, dryRun: true }),
    })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j as { keep: Preview; drop: Preview }; })
      .then(j => {
        setPreview({ a: j.keep, b: j.drop });
        // Default: keep whichever login was used most recently
        const aSeen = j.keep.last_sign_in_at ? Date.parse(j.keep.last_sign_in_at) : 0;
        const bSeen = j.drop.last_sign_in_at ? Date.parse(j.drop.last_sign_in_at) : 0;
        setKeepId(bSeen > aSeen ? j.drop.id : j.keep.id);
      })
      .catch(e => setError((e as Error).message || 'Could not load the accounts.'));
  }, [other, base.id]);

  const merge = async () => {
    if (!preview || !keepId) return;
    const dropId = keepId === preview.a.id ? preview.b.id : preview.a.id;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/members/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepId, dropId, deleteLogin }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) as { error?: string } : {};
    setBusy(false);
    if (!res?.ok) { setError(json.error ?? 'Merge failed — try again.'); return; }
    onMerged(keepId, dropId);
  };

  const card = (p: Preview) => {
    const sel = keepId === p.id;
    return (
      <button key={p.id} type="button" onClick={() => setKeepId(p.id)} style={{
        flex: 1, minWidth: 0, textAlign: 'left', padding: 14, borderRadius: 12,
        border: sel ? '2px solid var(--navy)' : '1px solid var(--line-2)', background: sel ? 'var(--navy-tint)' : 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: sel ? 'var(--navy)' : 'var(--faint)' }}>
            {sel ? 'Keep this one' : 'Merge into the other'}
          </span>
          {sel && <Icon name="check" size={16} stroke={2.6} color="var(--navy)" />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email ?? 'No email'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>WhatsApp {p.whatsapp ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Last sign-in: <strong style={{ color: 'var(--ink-2)' }}>{fmt(p.last_sign_in_at)}</strong></div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Joined {fmt(p.created_at)} · {p.points ?? 0} pts · profile {p.profile_complete ? 'complete' : 'incomplete'}</div>
        {COUNT_LABELS.map(([k, label]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '2px 0' }}>
            <span style={{ color: 'var(--muted)' }}>{label}</span><span className="tnum" style={{ fontWeight: 700 }}>{p.counts[k] ?? 0}</span>
          </div>
        ))}
      </button>
    );
  };

  const kept = preview && keepId ? (keepId === preview.a.id ? preview.a : preview.b) : null;
  const dropped = preview && keepId ? (keepId === preview.a.id ? preview.b : preview.a) : null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={busy ? undefined : onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.55)' }} />
      <div style={{ position: 'relative', width: 620, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg)', borderRadius: 16, padding: 22, boxShadow: '0 20px 60px rgba(20,29,58,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon name="users" size={20} color="var(--navy)" />
          <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>Merge duplicate accounts</div>
          <button onClick={onClose} disabled={busy} aria-label="Close" style={{ color: 'var(--muted)' }}><Icon name="x" size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
          For someone who registered twice. Everything from one account — check-ins, goals, wins, devotion, forms, points — moves onto the other.
        </p>

        {!other && (
          <>
            {suggestions.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>Possible duplicates of {base.name}</div>
                {suggestions.map(m => (
                  <button key={m.id} type="button" onClick={() => setOther(m)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line-2)', background: 'var(--surface)', marginBottom: 6, textAlign: 'left' }}>
                    <Avatar name={m.name} size={28} tone="grey" />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{m.name} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {m.email ?? 'no email'}</span></span>
                    <Icon name="chevronright" size={16} color="var(--faint)" />
                  </button>
                ))}
              </div>
            )}
            <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Or search by name or email…" style={{ width: '100%' }} autoFocus />
            {results.map(m => (
              <button key={m.id} type="button" onClick={() => setOther(m)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <Avatar name={m.name} size={26} tone="grey" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {m.email ?? 'no email'}</span></span>
              </button>
            ))}
          </>
        )}

        {other && !preview && !error && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading both accounts…</div>}

        {preview && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Tap the account to keep — usually the one they sign in with now.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{card(preview.a)}{card(preview.b)}</div>
            {kept && dropped && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontSize: 12.5, lineHeight: 1.55 }}>
                Everything from <strong>{dropped.email ?? 'the other account'}</strong> moves to <strong>{kept.email ?? 'the kept account'}</strong>,
                points are added together, and empty profile answers are filled in. The duplicate account is then deleted.
                This can&apos;t be undone.
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={deleteLogin} onChange={e => setDeleteLogin(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Also remove the duplicate&apos;s login ({dropped?.email ?? '—'}), so they can&apos;t sign in to an empty account again</span>
            </label>
          </>
        )}

        {error && <div style={{ marginTop: 12, fontSize: 13, color: '#c53030', fontWeight: 600 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {other
            ? <button onClick={() => { setOther(null); setError(null); }} disabled={busy} className="btn btn-ghost">Back</button>
            : <button onClick={onClose} className="btn btn-ghost">Cancel</button>}
          <div style={{ flex: 1 }} />
          {preview && (
            <button onClick={merge} disabled={busy || !keepId} className="btn btn-primary">
              {busy ? 'Merging…' : 'Merge accounts'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
