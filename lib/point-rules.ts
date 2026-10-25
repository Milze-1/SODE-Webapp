'use client';

import { useEffect, useState } from 'react';

// Live point values from point_rules (via /api/points/rules). Inactive rules
// are absent, i.e. worth 0. Use this instead of hard-coding "+N pts".
let cached: Record<string, number> | null = null;

export function usePointRules(): Record<string, number> | null {
  const [rules, setRules] = useState<Record<string, number> | null>(cached);
  useEffect(() => {
    if (cached) return;
    let on = true;
    fetch('/api/points/rules')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j?.rules) { cached = j.rules; if (on) setRules(j.rules); } })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  return rules;
}
