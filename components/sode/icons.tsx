import type { CSSProperties, ReactNode } from "react";

// ─── Icon paths (Lucide-style, 24px, 2px round stroke) ───────────────────────

const ICONS: Record<string, ReactNode> = {
  home: <><path d="M3.5 11 12 3.5 20.5 11"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.75 20v-5.5h4.5V20"/></>,
  target: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></>,
  userplus: <><circle cx="9.5" cy="8" r="4"/><path d="M2.5 20.5c0-4 3.4-6 7-6 1.3 0 2.5.25 3.5.7"/><path d="M18 13.5v6M15 16.5h6"/></>,
  trophy: <><path d="M7 4.5h10v3.5a5 5 0 0 1-10 0V4.5Z"/><path d="M7 5.5H4.2V7A2.8 2.8 0 0 0 7 9.8"/><path d="M17 5.5h2.8V7A2.8 2.8 0 0 1 17 9.8"/><path d="M12 13v3.5"/><path d="M8.5 20.5c0-1.8 1.5-2.7 3.5-2.7s3.5.9 3.5 2.7"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4 3.6-6 7.5-6s7.5 2 7.5 6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  minus: <><path d="M5 12h14"/></>,
  check: <><path d="M5 12.5 10 17 19 7"/></>,
  x: <><path d="M6 6l12 12M18 6 6 18"/></>,
  chevronright: <><path d="m9 5 7 7-7 7"/></>,
  chevronleft: <><path d="m15 5-7 7 7 7"/></>,
  chevrondown: <><path d="m6 9 6 6 6-6"/></>,
  arrowleft: <><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></>,
  arrowup: <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></>,
  arrowdown: <><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></>,
  arrowupright: <><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>,
  trendingup: <><path d="m3 16 5-5 4 4 7-8"/><path d="M16 7h5v5"/></>,
  trendingdown: <><path d="m3 8 5 5 4-4 7 8"/><path d="M16 17h5v-5"/></>,
  sprout: <><path d="M12 21v-7.5"/><path d="M12 13.5c0-3.1-2.1-5.1-6.2-5.1.1 3.1 2.2 5.1 6.2 5.1Z"/><path d="M12 11.6c0-2.6 2-4.4 5.3-4.4 0 2.6-2.1 4.4-5.3 4.4Z"/></>,
  briefcase: <><rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 13h18"/></>,
  store: <><path d="M4.2 9 5.5 4.2h13L19.8 9"/><path d="M4 9a2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.7 0"/><path d="M5 11.5V20h14v-8.5"/><path d="M9.5 20v-4.5h5V20"/></>,
  compass: <><circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/></>,
  calendarclock: <><path d="M21 10V6.5A2.5 2.5 0 0 0 18.5 4h-13A2.5 2.5 0 0 0 3 6.5v12A2.5 2.5 0 0 0 5.5 21H11"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/><circle cx="17.5" cy="17" r="4"/><path d="M17.5 15.4V17l1.2 1"/></>,
  mappin: <><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  bookopen: <><path d="M12 6.2C10.3 5.1 7.6 4.6 5 4.6V18c2.6 0 5.3.5 7 1.6"/><path d="M12 6.2C13.7 5.1 16.4 4.6 19 4.6V18c-2.6 0-5.3.5-7 1.6"/><path d="M12 6.2v13.4"/></>,
  sparkles: <><path d="M12 3.2 13.7 8 18.5 9.7 13.7 11.4 12 16.2 10.3 11.4 5.5 9.7 10.3 8 12 3.2Z"/><path d="M18.6 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z"/></>,
  share: <><circle cx="18" cy="5.5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="18.5" r="2.8"/><path d="m8.5 13.4 7 3.7M15.5 6.9l-7 3.7"/></>,
  bell: <><path d="M6 9.5a6 6 0 0 1 12 0c0 4.8 2 6 2 6H4s2-1.2 2-6Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></>,
  flame: <><path d="M12 3c1.1 3 5 4.2 5 8.8a5 5 0 0 1-10 0c0-2 .9-3.2 2-4.2.1 1.6 1 2.2 1.6 2.2C10.2 8.8 11 5.8 12 3Z"/></>,
  info: <><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.8h.01"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></>,
  download: <><path d="M12 3.5v12"/><path d="m7 11 5 5 5-5"/><path d="M4.5 20.5h15"/></>,
  filter: <><path d="M3.5 5.5h17l-6.7 7.6v5.4l-3.6 2v-7.4L3.5 5.5Z"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1M18.9 18.9l-2.1-2.1M7.2 7.2 5.1 5.1"/></>,
  users: <><circle cx="9" cy="8.5" r="3.6"/><path d="M2.6 20c0-3.6 3-5.6 6.4-5.6s6.4 2 6.4 5.6"/><path d="M16 5.2a3.6 3.6 0 0 1 0 6.6"/><path d="M17.7 14.6c2.4.5 3.8 2.4 3.8 5.4"/></>,
  shieldcheck: <><path d="M12 3 5 5.8v5c0 5 3 7.2 7 9 4-1.8 7-4 7-9v-5L12 3Z"/><path d="m9 11.8 2.2 2.2L15 10"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="m4 7 8 5.5L20 7"/></>,
  phone: <><path d="M5 3.5h3.6l1.8 4.5-2.5 1.7a11.5 11.5 0 0 0 4.9 4.9l1.7-2.5 4.5 1.8V18a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3 5.7 2 2 0 0 1 5 3.5Z"/></>,
  message: <><path d="M21 11.4A8 8 0 0 1 9.5 18.6L3.5 20.5l1.9-5.6A8 8 0 1 1 21 11.4Z"/></>,
  camera: <><path d="M4 8.5h2.8L8.2 6h7.6l1.4 2.5H20a1.2 1.2 0 0 1 1.2 1.2v8.6A1.2 1.2 0 0 1 20 19.5H4a1.2 1.2 0 0 1-1.2-1.2V9.7A1.2 1.2 0 0 1 4 8.5Z"/><circle cx="12" cy="13.5" r="3.4"/></>,
  link: <><path d="m9 15 6-6"/><path d="M10.5 6.5 12 5a4 4 0 0 1 5.7 5.7L16.2 12"/><path d="M13.5 17.5 12 19a4 4 0 0 1-5.7-5.7L7.8 12"/></>,
  heart: <><path d="M12 20C7.2 16.2 3.5 13.2 3.5 9.3a4 4 0 0 1 7.3-2.3 4 4 0 0 1 7.3 2.3c0 3.9-3.7 6.9-8.1 10.7Z"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.3 2"/></>,
  zap: <><path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z"/></>,
  copy: <><rect x="9" y="9" width="11.5" height="11.5" rx="2.2"/><path d="M5 15.5V5.5a2 2 0 0 1 2-2h8"/></>,
  star: <><path d="m12 3.2 2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.5l6-.8L12 3.2Z"/></>,
  flag: <><path d="M5 21V4"/><path d="M5 4.5h11l-2 3 2 3H5"/></>,
  pencil: <><path d="M14 5.5l4.5 4.5"/><path d="M4 20l1-4.2L16 4.8a1.6 1.6 0 0 1 2.3 0l1 1a1.6 1.6 0 0 1 0 2.3L8.2 19 4 20Z"/></>,
  pluscircle: <><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2v7.6M8.2 12h7.6"/></>,
  grid: <><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  lock: <><rect x="4.5" y="11" width="15" height="9.5" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  globe: <><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.6 2.4 14.4 0 17M12 3.5c-2.4 2.6-2.4 14.4 0 17"/></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
  refresh: <><path d="M20 11A8 8 0 0 0 6.3 6.3L3.5 9"/><path d="M3.5 4.5V9H8"/><path d="M4 13a8 8 0 0 0 13.7 4.7L20.5 15"/><path d="M20.5 19.5V15H16"/></>,
  gift: <><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5"/><path d="M12 8.5V20"/><path d="M12 8.5C12 6 10.5 4.5 8.8 4.5S6 6 8 8.5h4ZM12 8.5C12 6 13.5 4.5 15.2 4.5S18 6 16 8.5h-4Z"/></>,
  logout: <><path d="M9 3.5H5.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2H9"/><path d="m15.5 16 5-4-5-4"/><path d="M20.5 12H9"/></>,
  play: <><path d="M5.5 5.5v13L19 12 5.5 5.5Z"/></>,
  eyeoff: <><path d="M17.2 17.2A9 9 0 0 1 12 19c-6 0-9.5-7-9.5-7a16 16 0 0 1 4.3-5.2"/><path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c6 0 9.5 7 9.5 7a15 15 0 0 1-1.7 2.6"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/><path d="M3.5 3.5l17 17"/></>,
  trash: <><path d="M4 6.5h16"/><path d="M8 6.5V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M6 6.5l1 13h10l1-13"/><path d="M10 10.5v5M14 10.5v5"/></>,
  morehorizontal: <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M4.5 8v11.5h15V8"/><path d="M10 12.5h4"/></>,
  arrowright: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  alertcircle: <><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4"/><circle cx="12" cy="16.5" r=".6" fill="currentColor" stroke="none"/></>,
};

// ─── Icon component ───────────────────────────────────────────────────────────

export interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 22,
  stroke = 2,
  color,
  className,
  style,
}: IconProps) {
  const inner = ICONS[name] ?? ICONS.info;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {inner}
    </svg>
  );
}

// ─── Brand mark ───────────────────────────────────────────────────────────────

export interface BrandMarkProps {
  size?: number;
  radius?: number;
  navy?: string;
  on?: string;
}

export function BrandMark({
  size = 40,
  radius,
  navy = "#1e2a52",
  on = "#fff",
}: BrandMarkProps) {
  const r = radius != null ? radius : size * 0.28;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="0" y="0" width="48" height="48" rx={r} fill={navy} />
      <path d="M24 36V21" stroke={on} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M24 23.5c0-6-4.2-9.8-12-9.8.2 6 4.4 9.8 12 9.8Z" fill="none" stroke={on} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M24 20.2c0-5 4-8.2 10.2-8.2 0 5-4.2 8.2-10.2 8.2Z" fill="none" stroke={on} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 36c2.5-3 6-4.5 10-4.5s7.5 1.5 10 4.5" stroke={on} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.55" />
    </svg>
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────

export interface WordmarkProps {
  color?: string;
  sub?: string;
  center?: boolean;
  scale?: number;
}

export function Wordmark({
  color = "var(--ink)",
  sub = "var(--muted)",
  center = false,
  scale = 1,
}: WordmarkProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontSize: 9.5 * scale,
          letterSpacing: ".22em",
          fontWeight: 700,
          color: sub,
          textTransform: "uppercase",
        }}
      >
        The School Of
      </span>
      <span
        style={{
          fontSize: 19 * scale,
          fontWeight: 800,
          color,
          letterSpacing: "-.01em",
          marginTop: 2 * scale,
        }}
      >
        Daniels &amp; Esthers
      </span>
    </div>
  );
}

// ─── Pillars ──────────────────────────────────────────────────────────────────

export interface Pillar {
  key: string;
  name: string;
  short: string;
  icon: string;
  color: string;
  raw: string;
  verse: string;
}

export const PILLARS: Pillar[] = [
  {
    key: "spiritual",
    name: "Spiritual",
    short: "Spiritual",
    icon: "sprout",
    color: "var(--p-spiritual)",
    raw: "#1e2a52",
    verse: '"But Daniel resolved not to defile himself." — Daniel 1:8',
  },
  {
    key: "career",
    name: "Career & Calling",
    short: "Career",
    icon: "briefcase",
    color: "var(--p-career)",
    raw: "#3a4e86",
    verse: '"For such a time as this." — Esther 4:14',
  },
  {
    key: "business",
    name: "Business",
    short: "Business",
    icon: "store",
    color: "var(--p-business)",
    raw: "#5c6b8c",
    verse: '"Ten times better than all." — Daniel 1:20',
  },
  {
    key: "character",
    name: "Character",
    short: "Character",
    icon: "compass",
    color: "var(--p-character)",
    raw: "#828ba0",
    verse: '"Whoever is faithful in little…" — Luke 16:10',
  },
];

export function pillarOf(key: string): Pillar {
  return PILLARS.find((p) => p.key === key) ?? PILLARS[0];
}
