'use client';
import { useState } from 'react';
import { Icon, pillarOf } from '@/components/sode/icons';
import { Avatar, PillarChip, ProgressRing, StatusPill } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, AdminSearch, LineChart, KpiCard, type Kpi, CyclePill } from '@/components/admin/chrome';
import { useKPIs } from '@/lib/hooks/useRealtimeData';

const PILLARS = [
  { key: 'spiritual', name: 'Spiritual', icon: 'sprout' },
  { key: 'career', name: 'Career & Calling', icon: 'briefcase' },
  { key: 'business', name: 'Business', icon: 'store' },
  { key: 'character', name: 'Character', icon: 'compass' },
];

const BASE_KPIS: Kpi[] = [
  { id: 'k1', pillar: 'overall', title: 'Membership growth', cur: 0, tgt: 400, unit: 'members', status: 'ontrack', owner: 'Director', asof: 'Live', source: 'Auto · registrations + referrals', trend: [248, 261, 274, 289, 298, 312], manual: false },
  { id: 'k2', pillar: 'overall', title: 'Average NPS', cur: 62, tgt: 70, unit: 'score', status: 'atrisk', owner: 'Data & Ops', asof: 'Jun 10', source: 'Quarterly pulse survey', trend: [54, 57, 59, 58, 61, 62], manual: false },
  { id: 'k3', pillar: 'spiritual', title: 'Devotion consistency', cur: 74, tgt: 80, unit: '%', status: 'ontrack', owner: 'P. Lead · Spiritual', asof: 'Jun 12', source: 'Self check-ins', trend: [60, 64, 66, 70, 72, 74], manual: false },
  { id: 'k4', pillar: 'spiritual', title: 'Cell attendance', cur: 68, tgt: 85, unit: '%', status: 'atrisk', owner: 'P. Lead · Spiritual', asof: 'Jun 09', source: 'Sheets sync', trend: [72, 70, 69, 71, 67, 68], manual: false },
  { id: 'k5', pillar: 'career', title: 'Certifications earned', cur: 0, tgt: 60, unit: 'certs', status: 'ontrack', owner: 'P. Lead · Career', asof: 'Live', source: 'Auto · course completions', trend: [22, 27, 31, 34, 38, 41], manual: false },
  { id: 'k6', pillar: 'career', title: 'Role placements', cur: 9, tgt: 25, unit: 'placed', status: 'behind', owner: 'P. Lead · Career', asof: 'Jun 08', source: 'Manual · self-report', trend: [4, 5, 6, 7, 8, 9], manual: true },
  { id: 'k7', pillar: 'business', title: 'Businesses registered', cur: 0, tgt: 24, unit: 'biz', status: 'ontrack', owner: 'P. Lead · Business', asof: 'Live', source: 'Auto · members with business', trend: [9, 11, 13, 15, 16, 18], manual: false },
  { id: 'k8', pillar: 'business', title: 'First paying customers', cur: null, tgt: 30, unit: 'biz', status: 'pending', owner: 'P. Lead · Business', asof: '—', source: 'Manual · awaiting update', trend: [], manual: true },
  { id: 'k9', pillar: 'character', title: 'Active mentor pairings', cur: 47, tgt: 55, unit: 'pairs', status: 'ontrack', owner: 'P. Lead · Character', asof: 'Jun 12', source: 'Mentorship console', trend: [30, 34, 38, 41, 44, 47], manual: false },
  { id: 'k10', pillar: 'character', title: 'Serving participation', cur: 58, tgt: 75, unit: '%', status: 'atrisk', owner: 'P. Lead · Character', asof: 'Jun 10', source: 'Department registers', trend: [50, 52, 55, 54, 57, 58], manual: false },
];

function KpiDrawer({ k, onClose }: { k: Kpi | null; onClose: () => void }) {
  if (!k) return null;
  const p = pillarOf(k.pillar);
  const color = k.pillar === 'overall' ? 'var(--navy)' : p.color;
  const contributors = [
    { name: 'Ada Obi', detail: 'Registered business · Jun 11', status: 'done' as const },
    { name: 'Emeka Nwosu', detail: 'In progress · 2 of 3', status: 'ontrack' as const },
    { name: 'Zara Bello', detail: 'No update in 3 weeks', status: 'atrisk' as const },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.32)', animation: 'sode-fade .18s ease' }} />
      <div style={{ position: 'relative', width: 400, maxWidth: '90%', background: 'var(--bg)', height: '100%', boxShadow: '-12px 0 40px rgba(20,29,58,.16)', display: 'flex', flexDirection: 'column', animation: 'sode-drawer .26s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {k.pillar !== 'overall' && <div style={{ marginBottom: 8 }}><PillarChip pillar={k.pillar} size="sm" /></div>}
            <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{k.title}</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{k.cur}{k.unit === '%' ? '%' : ''}</span>
              <span className="tnum" style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>/ {k.tgt} target</span>
              <StatusPill status={k.status as 'ontrack' | 'atrisk' | 'behind' | 'done'} size="sm" />
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flex: 'none' }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>6-month trend</div>
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <LineChart data={k.trend.length >= 2 ? k.trend : [0, 0]} color={color} w={356} h={150} />
          </div>
          <div style={{ display: 'flex', gap: 9, padding: '12px 13px', borderRadius: 'var(--r-sm)', background: 'var(--navy-tint)', marginBottom: 18 }}>
            <Icon name="info" size={17} stroke={2} color="var(--navy)" />
            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}><b>Source:</b> {k.source}. As of {k.asof}. Owned by {k.owner}.</div>
          </div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Contributing members</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contributors.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}>
                <Avatar name={c.name} size={32} tone="grey" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.detail}</div>
                </div>
                <StatusPill status={c.status} size="sm" />
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}><Icon name="message" size={17} /> Message segment</button>
          <button className="btn btn-primary" style={{ flex: 1 }}><Icon name="flag" size={16} color="#fff" /> Assign follow-up</button>
        </div>
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState<Kpi | null>(null);
  const [search, setSearch] = useState('');
  const live = useKPIs();

  const KPIS = BASE_KPIS.map(k => {
    if (k.id === 'k1') return { ...k, cur: live.loading ? k.cur : live.memberCount };
    if (k.id === 'k5') return { ...k, cur: live.loading ? k.cur : live.certCount };
    if (k.id === 'k7') return { ...k, cur: live.loading ? k.cur : live.bizCount };
    return k;
  });

  const shown = filter === 'all' ? KPIS : KPIS.filter(k => k.pillar === filter);
  const counts = {
    on: KPIS.filter(k => k.status === 'ontrack').length,
    at: KPIS.filter(k => k.status === 'atrisk').length,
    be: KPIS.filter(k => k.status === 'behind').length,
  };

  const exportPack = () => {
    const rows = [['Title', 'Pillar', 'Current', 'Target', 'Unit', 'Status', 'Owner', 'As of'], ...KPIS.map(k => [k.title, k.pillar, String(k.cur ?? '—'), String(k.tgt), k.unit, k.status, k.owner, k.asof])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'scorecard-jun2026.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdminTopbar
        title="Team Scorecard"
        subtitle="2026 Growth Cycle"
        actions={
          <>
            <CyclePill label="Month 4 of 12" />
            <AdminSearch value={search} onChange={setSearch} placeholder="Search members…" />
            <button onClick={exportPack} className="btn btn-primary btn-sm">
              <Icon name="download" size={16} color="#fff" /> Export
            </button>
          </>
        }
      />
      <AdminBody>
        {/* Cycle health + status counts */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div className="card card-pad" style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--navy)', color: '#fff', border: 'none' }}>
            <ProgressRing value={4 / 12} size={56} stroke={6} color="#fff" track="rgba(255,255,255,.22)">
              <span className="tnum" style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>33%</span>
            </ProgressRing>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Cycle health</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>On pace for the year</div>
            </div>
          </div>
          {([
            { n: counts.on, l: 'On track', s: 'ontrack' },
            { n: counts.at, l: 'At risk', s: 'atrisk' },
            { n: counts.be, l: 'Behind', s: 'behind' },
          ] as const).map((c, i) => (
            <div key={i} className="card card-pad" style={{ width: 124, flex: 'none' }}>
              <div style={{ marginBottom: 8 }}><StatusPill status={c.s} size="sm" /></div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{c.n}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>KPIs {c.l.toLowerCase()}</div>
            </div>
          ))}
        </div>

        {/* Pillar filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterChip active={filter === 'all'} label="All pillars" onClick={() => setFilter('all')} />
          {PILLARS.map(p => (
            <FilterChip key={p.key} active={filter === p.key} label={p.name} icon={p.icon} onClick={() => setFilter(p.key)} />
          ))}
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
          {shown.map(k => (
            <KpiCard key={k.id} k={k} onClick={() => k.status !== 'pending' && setSel(k)} />
          ))}
        </div>
      </AdminBody>

      <KpiDrawer k={sel} onClose={() => setSel(null)} />
    </>
  );
}
