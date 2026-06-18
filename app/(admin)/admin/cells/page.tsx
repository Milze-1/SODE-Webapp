'use client';
import { useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, Panel, THead, TRow } from '@/components/admin/chrome';

const REG = {
  business: {
    cols: ['Business', 'Owner', 'Stage', 'Verify'],
    template: '1.3fr 1fr 1fr .7fr',
    rows: [
      { a: "Ada's Kitchen", b: 'Ada Obi', stage: 'first-customer', v: true },
      { a: 'BrightCode', b: 'Emeka Nwosu', stage: 'registered', v: false },
      { a: 'Zee Fabrics', b: 'Zainab Bello', stage: 'idea', v: false },
    ],
  },
  cells: {
    cols: ['Cell', 'Lead', 'Members', 'Meets'],
    template: '1.2fr 1fr .7fr 1fr',
    rows: [
      { a: 'VI Central', b: 'Ada Obi', stage: '14', v: 'Tue 7pm' },
      { a: 'Lekki Phase 1', b: 'Tunde Bakare', stage: '11', v: 'Wed 7pm' },
      { a: 'Ikoyi', b: 'Grace U.', stage: '9', v: 'Thu 6pm' },
    ],
  },
  leadership: {
    cols: ['Leader', 'Role', 'Pillar', 'Since'],
    template: '1.3fr 1fr 1fr .7fr',
    rows: [
      { a: 'Sade Adeleke', b: 'Pillar Lead', stage: 'Spiritual', v: '2024' },
      { a: 'Tunde Bakare', b: 'Pillar Lead', stage: 'Career', v: '2023' },
      { a: 'Ada Obi', b: 'Cell Lead', stage: 'Business', v: '2025' },
    ],
  },
  certificates: {
    cols: ['Member', 'Course', 'Artifact', 'Verify'],
    template: '1.1fr 1.1fr .9fr .7fr',
    rows: [
      { a: 'Zainab Bello', b: 'Foundations of Faith', stage: 'certificate.pdf', v: true },
      { a: 'Emeka Nwosu', b: 'Excellence at Work', stage: 'cert-link', v: false },
      { a: 'David Mensah', b: 'Starting a Business', stage: 'photo.jpg', v: false },
    ],
  },
} as const;

type TabKey = keyof typeof REG;

export default function RegistersPage() {
  const [tab, setTab] = useState<TabKey>('business');
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const r = REG[tab];
  const verifyCol = tab === 'business' || tab === 'certificates';

  const verify = (key: string) => setVerified(s => new Set(s).add(key));

  return (
    <>
      <AdminTopbar
        title="Registers"
        subtitle="Verified records — guard against success theater"
        actions={
          <button className="btn btn-ghost btn-sm"><Icon name="download" size={16} /> Export</button>
        }
      />
      <AdminBody>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {([['business', 'Business Registry'], ['cells', 'Cells'], ['leadership', 'Leadership'], ['certificates', 'Certificates']] as const).map(([k, l]) => (
            <FilterChip key={k} active={tab === k} label={l} onClick={() => setTab(k)} />
          ))}
        </div>

        <Panel pad={false}>
          <THead cols={[...r.cols]} template={r.template} />
          {r.rows.map((row, i) => {
            const vkey = tab + i;
            const isV = (row.v === true) || verified.has(vkey);
            return (
              <TRow key={i} template={r.template}>
                <span style={{ fontWeight: 600 }}>{row.a}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={row.b} size={24} tone="grey" />
                  <span>{row.b}</span>
                </div>
                {verifyCol
                  ? <span style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{row.stage}</span>
                  : <span style={{ color: 'var(--muted)' }}>{row.stage}</span>}
                {verifyCol
                  ? (isV
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--navy)', fontWeight: 600, fontSize: 12.5 }}><Icon name="shieldcheck" size={16} /> Verified</span>
                    : <button onClick={() => verify(vkey)} className="btn btn-primary btn-sm" style={{ height: 30 }}>Verify</button>)
                  : <span style={{ color: 'var(--muted)' }}>{String(row.v)}</span>}
              </TRow>
            );
          })}
        </Panel>
      </AdminBody>
    </>
  );
}
