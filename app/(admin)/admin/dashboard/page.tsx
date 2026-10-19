'use client';
import { useCallback, useEffect, useState } from 'react';
import { Icon, pillarOf } from '@/components/sode/icons';
import { Avatar, PillarChip, ProgressRing, StatusPill, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, AdminSearch, LineChart, KpiCard, type Kpi, CyclePill } from '@/components/admin/chrome';
import { useGrowthCycle, cycleMonth } from '@/lib/cycle';

// Team scorecard — every KPI computed from live data by /api/admin/kpis
// (lib/kpis-server.ts). Manual KPIs and targets are editable in the drawer.

const PILLARS = [
  { key: 'spiritual', name: 'Spiritual', icon: 'sprout' },
  { key: 'career', name: 'Career & Calling', icon: 'briefcase' },
  { key: 'business', name: 'Business', icon: 'store' },
  { key: 'character', name: 'Character', icon: 'compass' },
];

interface Contributor { id: string; name: string; detail: string; status: 'done' | 'ontrack' | 'atrisk' | 'behind' }
type LiveKpi = Kpi & { contributorsTitle: string; contributors: Contributor[] };

function KpiDrawer({ k, onClose, onSaved, notify }: { k: LiveKpi | null; onClose: () => void; onSaved: () => void; notify: (m: string, kind?: string) => void }) {
  const [tgt, setTgt] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (k) { setTgt(String(k.tgt)); setValue(k.cur != null ? String(k.cur) : ''); } }, [k]);
  if (!k) return null;
  const p = pillarOf(k.pillar);
  const color = k.pillar === 'overall' ? 'var(--navy)' : p.color;

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { id: k.id };
    if (Number(tgt) !== k.tgt) body.tgt = Number(tgt);
    if (k.manual) body.value = value.trim() === '' ? null : Number(value);
    const res = await fetch('/api/admin/kpis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) as { error?: string } : {};
    setSaving(false);
    if (!res?.ok) { notify(json.error ?? 'Could not save.', 'error'); return; }
    notify('Saved');
    onSaved();
  };

  const ids = k.contributors.map(c => c.id);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.32)', animation: 'sode-fade .18s ease' }} />
      <div style={{ position: 'relative', width: 420, maxWidth: '92%', background: 'var(--bg)', height: '100%', boxShadow: '-12px 0 40px rgba(20,29,58,.16)', display: 'flex', flexDirection: 'column', animation: 'sode-drawer .26s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {k.pillar !== 'overall' && <div style={{ marginBottom: 8 }}><PillarChip pillar={k.pillar} size="sm" /></div>}
            <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{k.title}</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{k.cur ?? '—'}{k.cur != null && k.unit === '%' ? '%' : ''}</span>
              <span className="tnum" style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>/ {k.tgt}{k.unit === '%' ? '%' : ` ${k.unit}`} target</span>
              {k.status !== 'pending' && <StatusPill status={k.status as 'ontrack' | 'atrisk' | 'behind'} size="sm" />}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flex: 'none' }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {k.trend.length >= 2 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>6-month trend</div>
              <div className="card card-pad" style={{ marginBottom: 18 }}>
                <LineChart data={k.trend} color={color} w={356} h={150} />
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 9, padding: '12px 13px', borderRadius: 'var(--r-sm)', background: 'var(--navy-tint)', marginBottom: 18 }}>
            <Icon name="info" size={17} stroke={2} color="var(--navy)" />
            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}><b>Source:</b> {k.source}. {k.asof}. Owned by {k.owner}.</div>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>{k.manual ? 'Update this KPI' : 'Target'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: k.manual ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 10 }}>
            {k.manual && (
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Latest value
                <input className="input" type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="—" style={{ width: '100%', marginTop: 4 }} />
              </label>
            )}
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Target
              <input className="input" type="number" min={1} value={tgt} onChange={e => setTgt(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          </div>
          <button onClick={save} disabled={saving || !(Number(tgt) > 0)} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>{saving ? 'Saving…' : 'Save'}</button>

          {k.contributors.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{k.contributorsTitle} ({k.contributors.length}{k.contributors.length >= 40 ? '+' : ''})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {k.contributors.map((c, i) => (
                  <div key={c.id + i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}>
                    <Avatar name={c.name} size={32} tone="grey" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.detail}</div>
                    </div>
                    <StatusPill status={c.status} size="sm" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {ids.length > 0 && (
          <div style={{ padding: 16, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
            <a href={`/admin/messages?members=${Array.from(new Set(ids)).join(',')}`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none' }}>
              <Icon name="message" size={17} color="#fff" /> Message these members
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  const cycle = useGrowthCycle();
  const [filter, setFilter] = useState('all');
  const [selId, setSelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kpis, setKpis] = useState<LiveKpi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const notify = useCallback((msg: string, kind?: string) => { setToast({ msg, kind, icon: kind === 'error' ? 'x' : 'check' }); setTimeout(() => setToast(null), 3000); }, []);

  const load = useCallback(() => {
    fetch('/api/admin/kpis')
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j as { kpis: LiveKpi[] }; })
      .then(j => { setKpis(j.kpis); setError(null); })
      .catch(e => setError((e as Error).message || 'Could not load the scorecard.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const all = kpis ?? [];
  const sel = all.find(k => k.id === selId) ?? null;
  const q = search.trim().toLowerCase();
  const shown = all.filter(k => (filter === 'all' || k.pillar === filter) && (!q || k.title.toLowerCase().includes(q)));
  const measured = all.filter(k => k.status !== 'pending');
  const counts = {
    on: measured.filter(k => k.status === 'ontrack').length,
    at: measured.filter(k => k.status === 'atrisk').length,
    be: measured.filter(k => k.status === 'behind').length,
  };
  const health = measured.length ? Math.round((counts.on / measured.length) * 100) : 0;
  const month = cycleMonth(cycle);

  const exportPack = () => {
    const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [['Title', 'Pillar', 'Current', 'Target', 'Unit', 'Status', 'Owner', 'As of', 'Source'],
      ...all.map(k => [k.title, k.pillar, k.cur ?? '', k.tgt, k.unit, k.status, k.owner, k.asof, k.source])];
    const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `scorecard-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdminTopbar
        title="Team Scorecard"
        subtitle={cycle.label}
        actions={
          <>
            <CyclePill />
            <AdminSearch value={search} onChange={setSearch} placeholder="Search KPIs…" />
            <button onClick={exportPack} disabled={!kpis} className="btn btn-primary btn-sm">
              <Icon name="download" size={16} color="#fff" /> Export
            </button>
          </>
        }
      />
      <AdminBody>
        {error && <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fee2e2', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div className="card card-pad" style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--navy)', color: '#fff', border: 'none' }}>
            <ProgressRing value={month / cycle.months} size={56} stroke={6} color="#fff" track="rgba(255,255,255,.22)">
              <span className="tnum" style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{month}/{cycle.months}</span>
            </ProgressRing>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Cycle health</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>
                {!kpis ? 'Loading…' : `${health}% of measured KPIs on track`}
              </div>
            </div>
          </div>
          {([
            { n: counts.on, l: 'On track', s: 'ontrack' },
            { n: counts.at, l: 'At risk', s: 'atrisk' },
            { n: counts.be, l: 'Behind', s: 'behind' },
          ] as const).map((c, i) => (
            <div key={i} className="card card-pad" style={{ width: 124, flex: 'none' }}>
              <div style={{ marginBottom: 8 }}><StatusPill status={c.s} size="sm" /></div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{kpis ? c.n : '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>KPIs {c.l.toLowerCase()}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterChip active={filter === 'all'} label="All pillars" onClick={() => setFilter('all')} />
          {PILLARS.map(p => (
            <FilterChip key={p.key} active={filter === p.key} label={p.name} icon={p.icon} onClick={() => setFilter(p.key)} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
          {!kpis && !error && Array.from({ length: 6 }).map((_, i) => <div key={i} className="card" style={{ height: 150, background: 'var(--surface-2)' }} />)}
          {shown.map(k => <KpiCard key={k.id} k={k} onClick={() => setSelId(k.id)} />)}
        </div>
      </AdminBody>

      <KpiDrawer k={sel} onClose={() => setSelId(null)} onSaved={load} notify={notify} />
      <Toast toast={toast} />
    </>
  );
}
