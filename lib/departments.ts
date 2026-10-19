'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { DEFAULT_DEPARTMENTS } from '@/lib/departments-shared';

export { DEFAULT_DEPARTMENTS } from '@/lib/departments-shared';

// Church departments members can serve in (app_settings.departments), edited
// by admins in Settings → Church departments. Falls back to the default list.
let cached: string[] | null = null;

export async function loadDepartments(force = false): Promise<string[]> {
  if (cached && !force) return cached;
  const { data, error } = await createClient().from('app_settings').select('value').eq('key', 'departments').maybeSingle();
  const v = !error && Array.isArray(data?.value) ? (data!.value as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()) : null;
  cached = v && v.length ? v : DEFAULT_DEPARTMENTS;
  return cached;
}

export function useDepartments(): string[] {
  const [list, setList] = useState<string[]>(cached ?? DEFAULT_DEPARTMENTS);
  useEffect(() => { let on = true; loadDepartments().then(l => { if (on) setList(l); }).catch(() => {}); return () => { on = false; }; }, []);
  return list;
}
