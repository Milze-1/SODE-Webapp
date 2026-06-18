'use client';
import { useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Segmented } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel } from '@/components/admin/chrome';

const REPORTS = [
  { k: 'monthly', t: 'Monthly Scorecard', d: 'KPI snapshot + trends for the month', icon: 'grid' },
  { k: 'quarterly', t: 'Quarterly Review pack', d: 'Deep-dive across all four pillars', icon: 'bookopen' },
  { k: 'annual', t: 'Annual Impact Report', d: 'The full year — how far the room climbed', icon: 'trendingup' },
  { k: 'csv', t: 'Per-pillar CSVs', d: 'Raw data export by pillar', icon: 'download' },
] as const;

type ReportKey = typeof REPORTS[number]['k'];
type Phase = 'configure' | 'generating' | 'ready';

export default function ReportsPage() {
  const [sel, setSel] = useState<ReportKey>('monthly');
  const [phase, setPhase] = useState<Phase>('configure');
  const [fmt, setFmt] = useState('PDF');
  const r = REPORTS.find(x => x.k === sel)!;

  const gen = () => {
    setPhase('generating');
    setTimeout(() => setPhase('ready'), 1400);
  };

  return (
    <>
      <AdminTopbar title="Reports & Export" subtitle="Generate leadership packs" />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Report type list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REPORTS.map(rp => {
              const active = sel === rp.k;
              return (
                <button key={rp.k} onClick={() => { setSel(rp.k); setPhase('configure'); }} className="card" style={{ textAlign: 'left', padding: 16, display: 'flex', alignItems: 'center', gap: 13, border: active ? '1.5px solid var(--navy)' : '1px solid var(--line)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: active ? 'var(--navy)' : 'var(--surface-2)', color: active ? '#fff' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name={rp.icon} size={21} stroke={2} color={active ? '#fff' : 'var(--navy)'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{rp.t}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{rp.d}</div>
                  </div>
                  {active && <Icon name="check" size={20} color="var(--navy)" stroke={2.4} />}
                </button>
              );
            })}
          </div>

          {/* Export panel */}
          <Panel title={r.t}>
            {phase === 'configure' && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Period</div>
                <div style={{ marginBottom: 16 }}>
                  <Segmented options={['This month', 'This quarter', 'This year']} value="This month" onChange={() => {}} size="sm" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Format</div>
                <div style={{ marginBottom: 18 }}>
                  <Segmented options={['PDF', 'CSV', 'Slides']} value={fmt} onChange={setFmt} size="sm" />
                </div>
                <button onClick={gen} className="btn btn-primary btn-block btn-lg">
                  <Icon name="download" size={18} color="#fff" /> Generate {fmt}
                </button>
              </>
            )}
            {phase === 'generating' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: 48, height: 48, margin: '0 auto', borderRadius: '50%', border: '4px solid var(--surface-2)', borderTopColor: 'var(--navy)', animation: 'sode-spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 16 }}>Generating {r.t}…</div>
              </div>
            )}
            {phase === 'ready' && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, background: 'var(--navy-tint)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={28} stroke={2.4} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>Your {fmt} is ready</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>SODE_{r.k}_Jun2026.{fmt.toLowerCase()}</div>
                <button className="btn btn-primary" style={{ marginTop: 16 }}>
                  <Icon name="download" size={17} color="#fff" /> Download
                </button>
                <button onClick={() => setPhase('configure')} className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>
                  Generate another
                </button>
              </div>
            )}
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}
