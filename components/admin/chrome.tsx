'use client';
import React, { Children } from 'react';
import { Icon } from '@/components/sode/icons';
import { ProgressBar, StatusPill, Avatar } from '@/components/sode/ui';

export function AdminTopbar({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: 60, flex: 'none', borderBottom: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px' }}>
      <div style={{ flex: 'none' }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {actions}
    </div>
  );
}

export function AdminBody({ children }: { children: React.ReactNode }) {
  // minHeight: 0 lets this flex child shrink below its content height so
  // overflowY: auto actually engages (otherwise tall pages get clipped with
  // no scroll on shorter laptop screens).
  return <div className="slim-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>{children}</div>;
}

export function Panel({ title, action, children, pad = true }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; pad?: boolean;
}) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</h3>
          {action}
        </div>
      )}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </div>
  );
}

export function FilterChip({ active, label, icon, onClick }: {
  active: boolean; label: string; icon?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: active ? 'var(--navy)' : 'var(--bg)', color: active ? '#fff' : 'var(--ink)', border: active ? 'none' : '1px solid var(--line-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {icon && <Icon name={icon} size={15} stroke={2.2} color={active ? '#fff' : 'var(--muted)'} />}
      {label}
    </button>
  );
}

export function CyclePill({ label = 'Month 4 of 12' }: { label?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 13px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 13, fontWeight: 600, cursor: 'default', whiteSpace: 'nowrap', flex: 'none', color: 'var(--ink)' }}>
      <Icon name="calendarclock" size={16} color="var(--muted)" /> {label} <Icon name="chevrondown" size={15} color="var(--muted)" />
    </div>
  );
}

export function AdminSearch({ value, onChange, placeholder = 'Search…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 13px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)', width: 220, flex: 'none' }}>
      <Icon name="search" size={15} color="var(--faint)" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', width: '100%' }}
      />
    </div>
  );
}

export function THead({ cols, template }: { cols: string[]; template: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: template, padding: '11px 16px', gap: 12, background: 'var(--surface)', borderBottom: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)', fontWeight: 700, alignItems: 'center' }}>
      {cols.map((c, i) => <div key={i}>{c}</div>)}
    </div>
  );
}

export function TRow({ children, template, onClick }: {
  children: React.ReactNode; template: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ display: 'grid', gridTemplateColumns: template, padding: '11px 16px', gap: 12, borderBottom: '1px solid var(--line)', background: 'transparent', cursor: onClick ? 'pointer' : 'default', fontSize: 13.5, color: 'var(--ink)', alignItems: 'center', transition: 'background .12s' }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {Children.map(children, (child, i) => (
        <div key={i} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child}</div>
      ))}
    </div>
  );
}

export function Spark({ data, color = 'var(--navy)', w = 96, h = 30 }: {
  data: number[]; color?: string; w?: number; h?: number;
}) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / rng) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
}

export function LineChart({ data, color = 'var(--navy)', w = 360, h = 150, labels }: {
  data: number[]; color?: string; w?: number; h?: number; labels?: string[];
}) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data) * 0.92, max = Math.max(...data) * 1.04, rng = max - min || 1;
  const x = (i: number) => 8 + (i / (data.length - 1)) * (w - 16);
  const y = (v: number) => h - 24 - ((v - min) / rng) * (h - 40);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${h - 24} L${x(0)} ${h - 24} Z`;
  const months = labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((t, i) => <line key={i} x1="8" x2={w - 8} y1={24 + t * (h - 48)} y2={24 + t * (h - 48)} stroke="var(--line)" strokeWidth="1" />)}
      <path d={area} fill={color} opacity="0.08" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
      {data.map((v, i) => <text key={'t' + i} x={x(i)} y={h - 7} fontSize="10" fill="var(--faint)" textAnchor="middle" fontFamily="var(--font)">{months[i]}</text>)}
    </svg>
  );
}

export function Bars({ data, color = 'var(--navy)', w = 360, h = 150, labels }: {
  data: number[]; color?: string; w?: number; h?: number; labels?: string[];
}) {
  const max = Math.max(...data) || 1;
  const bw = (w - 16) / data.length;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 34);
        return (
          <g key={i}>
            <rect x={8 + i * bw + bw * 0.18} y={h - 22 - bh} width={bw * 0.64} height={Math.max(bh, 2)} rx="4" fill={color} opacity={0.85} />
            {labels && <text x={8 + i * bw + bw / 2} y={h - 7} fontSize="10" fill="var(--faint)" textAnchor="middle" fontFamily="var(--font)">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

const PILLAR_META: Record<string, { color: string; icon: string }> = {
  spiritual: { color: 'var(--spiritual)', icon: 'sprout' },
  career: { color: 'var(--career)', icon: 'briefcase' },
  business: { color: 'var(--business)', icon: 'store' },
  character: { color: 'var(--character)', icon: 'compass' },
  overall: { color: 'var(--navy)', icon: 'grid' },
};

export interface Kpi {
  id: string; pillar: string; title: string; cur: number | null; tgt: number;
  unit: string; status: string; owner: string; asof: string; source: string;
  trend: number[]; manual: boolean;
}

export function KpiCard({ k, onClick }: { k: Kpi; onClick?: () => void }) {
  const p = PILLAR_META[k.pillar] ?? PILLAR_META.overall;
  const color = p.color;
  if (k.status === 'pending') {
    return (
      <div onClick={onClick} style={{ textAlign: 'left', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-2)', background: 'var(--surface)', padding: 16, minHeight: 150, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {k.pillar !== 'overall' && <span style={{ color }}><Icon name={p.icon} size={15} stroke={2.2} /></span>}
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{k.title}</span>
        </div>
        <div style={{ marginTop: 22, textAlign: 'center', color: 'var(--muted)' }}>
          <Icon name="clock" size={22} />
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>Awaiting update</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>Manual KPI · owner notified</div>
        </div>
      </div>
    );
  }
  const pct = k.cur != null ? k.cur / k.tgt : 0;
  return (
    <div onClick={onClick} className="card" style={{ textAlign: 'left', padding: 16, minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'box-shadow .15s, transform .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-md)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--sh-sm)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {k.pillar !== 'overall' && <span style={{ color, flex: 'none' }}><Icon name={p.icon} size={15} stroke={2.2} /></span>}
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em' }}>{k.title}</span>
          </div>
          <StatusPill status={k.status as 'ontrack' | 'atrisk' | 'behind' | 'done'} size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
          <span className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{k.cur}{k.unit === '%' ? '%' : ''}</span>
          <span className="tnum" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>/ {k.tgt}{k.unit === '%' ? '%' : ` ${k.unit}`}</span>
        </div>
        <div style={{ marginTop: 10 }}><ProgressBar value={pct} color={color} height={6} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar name={k.owner} size={20} tone="grey" />
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{k.asof}</span>
          {k.manual && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', padding: '1px 5px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--muted)' }}>MANUAL</span>}
        </div>
        <Spark data={k.trend} color={color} w={60} h={24} />
      </div>
    </div>
  );
}

export function Skeleton({ h = 48, r = 'var(--r-md)' }: { h?: number; r?: string }) {
  return <div style={{ height: h, borderRadius: r, background: 'rgba(0,0,0,0.07)' }} />;
}
