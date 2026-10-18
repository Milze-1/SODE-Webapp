// Growth cycle maths shared by client and server (see lib/cycle.ts for the
// client hook and app/api/admin/cycle for editing).

export interface GrowthCycle {
  label: string;   // e.g. "2026 Growth Cycle"
  start: string;   // YYYY-MM-DD
  months: number;  // length, usually 12
}

export const DEFAULT_CYCLE: GrowthCycle = { label: '2026 Growth Cycle', start: '2026-01-01', months: 12 };

// 1-based month within the cycle, clamped to [1, months]
export function cycleMonth(c: GrowthCycle, now = new Date()): number {
  const s = new Date(c.start + 'T00:00:00');
  const m = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth()) + 1;
  return Math.max(1, Math.min(c.months, m));
}

export const cycleLabelMonth = (c: GrowthCycle, now = new Date()) => `Month ${cycleMonth(c, now)} of ${c.months}`;
