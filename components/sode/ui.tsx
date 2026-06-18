"use client";

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Icon, pillarOf } from "@/components/sode/icons";

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  name?: string;
  size?: number;
  tone?: "navy" | "soft" | "grey";
  img?: string;
  style?: CSSProperties;
}

export function Avatar({ name = "", size = 40, tone = "navy", img, style }: AvatarProps) {
  const initials =
    name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "·";
  const tones = {
    navy: { bg: "var(--navy)", fg: "#fff" },
    soft: { bg: "var(--navy-tint-2)", fg: "var(--navy)" },
    grey: { bg: "var(--surface-2)", fg: "var(--ink-2)" },
  };
  const t = tones[tone] ?? tones.navy;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none",
        background: t.bg, color: t.fg, display: "flex", alignItems: "center",
        justifyContent: "center", fontWeight: 700, fontSize: size * 0.36,
        letterSpacing: ".01em", overflow: "hidden", ...style,
      }}
    >
      {img
        ? <img src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials}
    </div>
  );
}

// ─── PillarChip ───────────────────────────────────────────────────────────────

interface PillarChipProps {
  pillar: string;
  size?: "sm" | "md";
  solid?: boolean;
}

export function PillarChip({ pillar, size = "md", solid = false }: PillarChipProps) {
  const p = pillarOf(pillar);
  const sm = size === "sm";
  if (solid) {
    return (
      <span className="chip" style={{ background: p.color, color: "#fff", fontWeight: 600 }}>
        <Icon name={p.icon} size={sm ? 12 : 14} stroke={2.2} />
        {p.short}
      </span>
    );
  }
  return (
    <span className="chip" style={{ height: sm ? 22 : 26, fontSize: sm ? 11 : 12, paddingLeft: 7 }}>
      <span style={{ display: "inline-flex", color: p.color }}>
        <Icon name={p.icon} size={sm ? 12 : 14} stroke={2.2} />
      </span>
      {p.short}
    </span>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

interface ProgressRingProps {
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  delay?: number;
}

export function ProgressRing({
  value = 0, size = 52, stroke = 5,
  color = "var(--navy)", track = "var(--surface-2)",
  children, delay = 120,
}: ProgressRingProps) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children != null
          ? children
          : <span className="tnum" style={{ fontSize: size * 0.28, fontWeight: 700 }}>{Math.round(value * 100)}</span>}
      </div>
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value?: number;
  color?: string;
  height?: number;
  track?: string;
  delay?: number;
}

export function ProgressBar({
  value = 0, color = "var(--navy)", height = 8,
  track = "var(--surface-2)", delay = 120,
}: ProgressBarProps) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ background: track, borderRadius: 999, height, overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: "100%",
        background: color, borderRadius: 999,
        transition: "width 1s cubic-bezier(.22,1,.36,1)",
      }} />
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

type GoalStatus = "done" | "ontrack" | "atrisk" | "behind";

interface StatusPillProps {
  status?: GoalStatus;
  size?: "sm" | "md";
}

export function StatusPill({ status = "ontrack", size = "md" }: StatusPillProps) {
  const map: Record<GoalStatus, { label: string; icon: string; bg: string; fg: string; border?: string }> = {
    done:    { label: "Done",     icon: "check",        bg: "var(--navy)",        fg: "#fff" },
    ontrack: { label: "On track", icon: "trendingup",   bg: "var(--navy-tint-2)", fg: "var(--navy)" },
    atrisk:  { label: "At risk",  icon: "minus",        bg: "var(--surface-2)",   fg: "var(--ink-2)" },
    behind:  { label: "Behind",   icon: "trendingdown", bg: "#fff",               fg: "var(--muted)", border: "1px solid var(--line-2)" },
  };
  const s = map[status] ?? map.ontrack;
  const sm = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, height: sm ? 22 : 25,
      padding: sm ? "0 9px 0 7px" : "0 11px 0 8px", borderRadius: 999,
      background: s.bg, color: s.fg, border: s.border ?? "none",
      fontSize: sm ? 11 : 12, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap",
    }}>
      <Icon name={s.icon} size={sm ? 12 : 13} stroke={2.4} /> {s.label}
    </span>
  );
}

// ─── PointsBadge ──────────────────────────────────────────────────────────────

interface PointsBadgeProps {
  value: number;
  size?: "sm" | "md";
  onClick?: () => void;
}

export function PointsBadge({ value, size = "md", onClick }: PointsBadgeProps) {
  const sm = size === "sm";
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: sm ? 4 : 6, height: sm ? 26 : 32,
      padding: sm ? "0 10px 0 8px" : "0 13px 0 10px", borderRadius: 999,
      background: "var(--navy-tint)", color: "var(--navy)", fontWeight: 700,
      boxShadow: "inset 0 0 0 1px rgba(30,42,82,.10)",
    }}>
      <Icon name="zap" size={sm ? 13 : 16} stroke={2.4} />
      <span className="tnum" style={{ fontSize: sm ? 13 : 15 }}>{value.toLocaleString()}</span>
      {!sm && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--navy-600)", marginLeft: -1 }}>pts</span>}
    </button>
  );
}

// ─── Stat ─────────────────────────────────────────────────────────────────────

interface StatProps {
  value: ReactNode;
  label: string;
  sub?: string;
  align?: "left" | "center" | "right";
}

export function Stat({ value, label, sub, align = "left" }: StatProps) {
  return (
    <div style={{ textAlign: align }}>
      <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─── SectionHead ──────────────────────────────────────────────────────────────

interface SectionHeadProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHead({ title, action, onAction }: SectionHeadProps) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>{title}</h3>
      {action && (
        <button onClick={onAction} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", display: "inline-flex", alignItems: "center", gap: 2 }}>
          {action}<Icon name="chevronright" size={14} stroke={2.4} />
        </button>
      )}
    </div>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  dim?: boolean;
}

export function Sheet({ open, onClose, title, children, footer, dim = true }: SheetProps) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      {dim && (
        <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(17,20,28,.40)", animation: "sode-fade .2s ease" }} />
      )}
      <div style={{
        position: "relative", width: "100%", maxHeight: "92%", background: "var(--bg)",
        borderRadius: "22px 22px 0 0", boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column",
        animation: "sode-up .28s cubic-bezier(.22,1,.36,1)", overflow: "hidden",
      }}>
        <div style={{ padding: "10px 0 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line-2)" }} />
        </div>
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px 6px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>{title}</h2>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div className="noscroll" style={{ overflowY: "auto", padding: "4px 18px 18px" }}>{children}</div>
        {footer && (
          <div style={{ padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export interface ToastData {
  kind?: "offline" | "success" | string;
  icon?: string;
  msg: string;
  points?: number;
}

interface ToastProps {
  toast: ToastData | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;
  const offline = toast.kind === "offline";
  return (
    <div style={{ position: "absolute", left: 14, right: 14, bottom: 86, zIndex: 60, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 9, maxWidth: "100%",
        padding: "11px 16px", borderRadius: 14,
        background: offline ? "#fff" : "var(--navy)",
        color: offline ? "var(--ink)" : "#fff",
        boxShadow: "var(--sh-pop)", border: offline ? "1px solid var(--line-2)" : "none",
        fontSize: 13.5, fontWeight: 600, animation: "sode-rise .25s ease",
      }}>
        <Icon name={offline ? "refresh" : (toast.icon ?? "check")} size={17} stroke={2.4} color={offline ? "var(--navy)" : "#fff"} />
        <span>{toast.msg}</span>
        {toast.points != null && <span className="tnum" style={{ fontWeight: 800, marginLeft: 2 }}>+{toast.points}</span>}
      </div>
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

export function Confetti() {
  const pieces = Array.from({ length: 16 });
  const cols = ["var(--navy)", "var(--navy-500)", "var(--p-business)", "var(--p-character)", "var(--ink-2)"];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((_, i) => {
        const left = (i * 6.3 + (i % 3) * 4) % 100;
        const delay = (i % 5) * 0.08;
        const dur = 1.1 + (i % 4) * 0.25;
        const sz = 6 + (i % 3) * 2;
        const rd = i % 2 ? "50%" : "2px";
        return (
          <span key={i} style={{
            position: "absolute", top: "-6%", left: `${left}%`, width: sz, height: sz, borderRadius: rd,
            background: cols[i % cols.length], opacity: 0.9,
            animation: `sode-confetti ${dur}s ${delay}s cubic-bezier(.3,.7,.4,1) forwards`,
          }} />
        );
      })}
    </div>
  );
}

// ─── Celebrate ────────────────────────────────────────────────────────────────

interface CelebrateData {
  title: string;
  sub?: string;
  points?: number;
  cta?: string;
  secondary?: { label: string; icon?: string; onClick?: () => void };
}

interface CelebrateProps {
  data: CelebrateData | null;
  onClose: () => void;
}

export function Celebrate({ data, onClose }: CelebrateProps) {
  if (!data) return null;
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28,
      background: "rgba(245,246,248,.86)", backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)", animation: "sode-fade .2s ease",
    }}>
      <Confetti />
      <div style={{ animation: "sode-pop .5s cubic-bezier(.22,1.4,.4,1)" }}>
        <Image src="/images/sode-primary-logo.png" alt="SODE" width={120} height={84} className="object-contain" />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginTop: 22 }}>{data.title}</h2>
      <p style={{ fontSize: 15, color: "var(--muted)", marginTop: 8, maxWidth: 260, lineHeight: 1.5 }}>{data.sub}</p>
      {data.points != null && (
        <div style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999, background: "var(--navy)", color: "#fff", fontWeight: 800 }}>
          <Icon name="zap" size={18} stroke={2.4} color="#fff" />
          <span className="tnum" style={{ fontSize: 17 }}>+{data.points} points</span>
        </div>
      )}
      <button className="btn btn-primary btn-lg" style={{ marginTop: 28, minWidth: 200 }} onClick={onClose}>
        {data.cta ?? "Amen — continue"}
      </button>
      {data.secondary && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 10, minWidth: 200 }}
          onClick={() => { onClose(); data.secondary?.onClick?.(); }}
        >
          {data.secondary.icon && <Icon name={data.secondary.icon} size={17} stroke={2.2} />}
          {data.secondary.label}
        </button>
      )}
    </div>
  );
}

// ─── Segmented ────────────────────────────────────────────────────────────────

type SegmentedOption = string | { value: string; label: string };

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
}

export function Segmented({ options, value, onChange, size = "md" }: SegmentedProps) {
  const sm = size === "sm";
  return (
    <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2, width: "100%" }}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: 1, height: sm ? 30 : 36, borderRadius: 999, fontSize: sm ? 12.5 : 13.5, fontWeight: 600,
            color: active ? "var(--ink)" : "var(--muted)",
            background: active ? "#fff" : "transparent",
            boxShadow: active ? "var(--sh-sm)" : "none",
            transition: "all .15s ease", whiteSpace: "nowrap",
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label?: string;
  hint?: string;
  children: ReactNode;
  saved?: boolean;
}

export function Field({ label, hint, children, saved }: FieldProps) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
          {saved && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Icon name="check" size={12} stroke={2.6} /> Saved
            </span>
          )}
        </div>
      )}
      {children}
      {hint && <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>{hint}</div>}
    </label>
  );
}

// ─── TextInput ────────────────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: "100%", height: 50, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)",
  background: "var(--surface)", padding: "0 14px", fontSize: 15, fontFamily: "var(--font)",
  color: "var(--ink)", outline: "none",
};

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  icon?: string;
}

export function TextInput({ value, onChange, placeholder, type = "text", multiline, rows = 3, icon }: TextInputProps) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ ...inputStyle, height: "auto", padding: "12px 14px", resize: "none", lineHeight: 1.45 }}
      />
    );
  }
  return (
    <div style={{ position: "relative" }}>
      {icon && (
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: icon ? 40 : 14 }}
      />
    </div>
  );
}

// ─── OptionChips ──────────────────────────────────────────────────────────────

type ChipOption = string | { value: string; label: string; icon?: string };

interface OptionChipsProps {
  options: ChipOption[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
  columns?: number;
}

export function OptionChips({ options, value, onChange, multi = false, columns }: OptionChipsProps) {
  const isSel = (v: string) => multi ? (value as string[]).includes(v) : value === v;
  const toggle = (v: string) => {
    if (multi) {
      const cur = (value as string[]) || [];
      onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    } else {
      onChange(v);
    }
  };
  return (
    <div style={{
      display: columns ? "grid" : "flex",
      gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : undefined,
      flexWrap: columns ? undefined : "wrap",
      gap: 8,
    }}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const ic = typeof o === "object" ? o.icon : undefined;
        const sel = isSel(v);
        return (
          <button key={v} onClick={() => toggle(v)} style={{
            display: "inline-flex", alignItems: "center",
            justifyContent: columns ? "flex-start" : "center",
            gap: 7, padding: "0 14px", height: 44, borderRadius: 999,
            fontSize: 14, fontWeight: 600,
            background: sel ? "var(--navy)" : "var(--surface)",
            color: sel ? "#fff" : "var(--ink)",
            border: sel ? "1px solid var(--navy)" : "1px solid var(--line-2)",
            transition: "all .14s ease",
          }}>
            {ic && <Icon name={ic} size={17} stroke={2.2} color={sel ? "#fff" : "var(--muted)"} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 46, height: 28, borderRadius: 999, padding: 3,
      background: on ? "var(--navy)" : "var(--line-2)",
      transition: "background .18s ease", flex: "none",
    }}>
      <span style={{
        display: "block", width: 22, height: 22, borderRadius: "50%",
        background: "#fff", boxShadow: "var(--sh-sm)",
        transform: on ? "translateX(18px)" : "none",
        transition: "transform .18s cubic-bezier(.22,1,.36,1)",
      }} />
    </button>
  );
}

// ─── StickyFooter ─────────────────────────────────────────────────────────────
// position: fixed so it stays above the on-screen keyboard on Android.
// Add padding-bottom to the scrollable sibling so content isn't hidden beneath it.

export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      padding: "12px 20px calc(14px + env(safe-area-inset-bottom))",
      background: "rgba(255,255,255,.94)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      borderTop: "1px solid var(--line)",
    }}>
      {children}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
}

export function EmptyState({ icon = "sprout", title, body, cta, onCta }: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding: "36px 24px" }}>
      <div style={{ width: 66, height: 66, borderRadius: 20, background: "var(--navy-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--navy)" }}>
        <Icon name={icon} size={30} stroke={1.9} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 16, letterSpacing: "-.01em" }}>{title}</h3>
      {body && (
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 7, lineHeight: 1.5, maxWidth: 270, marginLeft: "auto", marginRight: "auto" }}>
          {body}
        </p>
      )}
      {cta && (
        <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onCta}>
          <Icon name="plus" size={18} stroke={2.4} color="#fff" />
          {cta}
        </button>
      )}
    </div>
  );
}
