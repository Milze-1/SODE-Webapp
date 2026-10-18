'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { DEFAULT_CYCLE, type GrowthCycle } from '@/lib/cycle-shared';

export { DEFAULT_CYCLE, cycleMonth, cycleLabelMonth, type GrowthCycle } from '@/lib/cycle-shared';

// Current growth cycle (app_settings.growth_cycle), set by admins in
// Settings → Active cycle. Falls back to DEFAULT_CYCLE if the setting or table
// isn't there, so screens never break on it.
let cached: GrowthCycle | null = null;
let inflight: Promise<GrowthCycle> | null = null;

export function loadGrowthCycle(force = false): Promise<GrowthCycle> {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight && !force) return inflight;
  const p = (async (): Promise<GrowthCycle> => {
    const { data, error } = await createClient().from('app_settings').select('value').eq('key', 'growth_cycle').maybeSingle();
    const v = (!error && data?.value) as Partial<GrowthCycle> | false;
    cached = v && v.start ? { ...DEFAULT_CYCLE, ...v } : DEFAULT_CYCLE;
    return cached;
  })().catch(() => DEFAULT_CYCLE);
  inflight = p;
  return p;
}

export function useGrowthCycle(): GrowthCycle {
  const [cycle, setCycle] = useState<GrowthCycle>(cached ?? DEFAULT_CYCLE);
  useEffect(() => { let on = true; loadGrowthCycle().then(c => { if (on) setCycle(c); }); return () => { on = false; }; }, []);
  return cycle;
}
