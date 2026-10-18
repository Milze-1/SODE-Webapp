'use client';
import { useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Segmented } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel } from '@/components/admin/chrome';

// Live-data reports, built by /api/admin/reports (lib/reports-server.ts).
const REPORTS = [
  { k: 'scorecard', t: 'Leadership scorecard', d: 'Headline numbers, pillar breakdown and sessions', icon: 'grid' },
  { k: 'attendance', t: 'Attendance', d: 'Turnout per session and per member', icon: 'calendarclock' },
  { k: 'members', t: 'Members & growth', d: 'Every member with their activity this period', icon: 'users' },
  { k: 'goals', t: 'Goals & milestones', d: 'All active goals with progress and status', icon: 'target' },
  { k: 'devotion', t: 'Devotion', d: 'Days completed per member', icon: 'heart' },
] as const;

const PERIODS = [
  { k: 'month', l: 'This month' }, { k: 'quarter', l: 'This quarter' },
  { k: 'year', l: 'This year' }, { k: 'cycle', l: 'This cycle' },
] as const;

const FORMATS = [
  { k: 'xlsx', l: 'Excel' }, { k: 'csv', l: 'CSV' }, { k: 'html', l: 'Printable / PDF' },
] as const;

type ReportKey = typeof REPORTS[number]['k'];

export default function ReportsPage() {
  const [sel, setSel] = useState<ReportKey>('scorecard');
  const [period, setPeriod] = useState<string>('This month');
  const [fmt, setFmt] = useState<string>('Excel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = REPORTS.find(x => x.k === sel)!;

  const generate = async () => {
    const p = PERIODS.find(x => x.l === period)!.k;
    const f = FORMATS.find(x => x.l === fmt)!.k;
    const url = `/api/admin/reports?type=${sel}&period=${p}&format=${f}`;
    setError(null);
    if (f === 'html') { window.open(url, '_blank', 'noopener'); return; }
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Could not generate the report.'); }
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `SODE-report.${f}`;
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl; a.download = name; a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminTopbar title="Reports & Export" subtitle="Live data, ready for leadership" />
      <AdminBody>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REPORTS.map(rp => {
              const active = sel === rp.k;
              return (
                <button key={rp.k} onClick={() => { setSel(rp.k); setError(null); }} className="card" style={{ textAlign: 'left', padding: 16, display: 'flex', alignItems: 'center', gap: 13, border: active ? '1.5px solid var(--navy)' : '1px solid var(--line)' }}>
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

          <Panel title={r.t}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Period</div>
            <div style={{ marginBottom: 16 }}>
              <Segmented options={PERIODS.map(x => x.l)} value={period} onChange={setPeriod} size="sm" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 9 }}>Format</div>
            <div style={{ marginBottom: 8 }}>
              <Segmented options={FORMATS.map(x => x.l)} value={fmt} onChange={setFmt} size="sm" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 16px' }}>
              {fmt === 'Excel' ? 'One workbook with a tab per section.'
                : fmt === 'CSV' ? 'The main table only — good for Google Sheets.'
                : 'Opens in a new tab — use Print / Save as PDF.'}
            </p>
            <button onClick={generate} disabled={busy} className="btn btn-primary btn-block btn-lg">
              <Icon name="download" size={18} color="#fff" /> {busy ? 'Building report…' : fmt === 'Printable / PDF' ? 'Open printable report' : `Download ${fmt}`}
            </button>
            {error && <div style={{ marginTop: 12, fontSize: 13, color: '#c53030', fontWeight: 600 }}>{error}</div>}
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}
