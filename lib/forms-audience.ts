import type { SupabaseClient } from '@supabase/supabase-js';

export type FormAudience =
  | { type: 'everyone' }
  | { type: 'pillar'; pillars: string[] }
  | { type: 'life_stage'; stages: string[] }
  | { type: 'cell'; cell_id: string }
  | { type: 'specific'; member_ids: string[] };

export const PILLAR_OPTIONS = [
  { key: 'spiritual', label: 'Spiritual' },
  { key: 'career', label: 'Career' },
  { key: 'business', label: 'Business' },
  { key: 'character', label: 'Character' },
];

export const LIFE_STAGE_OPTIONS = [
  { key: 'student', label: 'Student' },
  { key: 'professional', label: 'Professional' },
  { key: 'entrepreneur', label: 'Entrepreneur' },
  { key: 'employed', label: 'Employed' },
  { key: 'other', label: 'Other' },
];

export function summarizeAudience(a: FormAudience | null | undefined, cellName?: string): string {
  if (!a || a.type === 'everyone') return '→ Everyone';
  switch (a.type) {
    case 'pillar':
      return a.pillars.length
        ? `→ ${a.pillars.map(p => PILLAR_OPTIONS.find(o => o.key === p)?.label ?? p).join(' + ')}`
        : '→ Everyone';
    case 'life_stage':
      return a.stages.length
        ? `→ ${a.stages.map(s => LIFE_STAGE_OPTIONS.find(o => o.key === s)?.label ?? s).join(' + ')}`
        : '→ Everyone';
    case 'cell':
      return `→ ${cellName ?? 'a cell'}`;
    case 'specific':
      return `→ ${a.member_ids.length} specific member${a.member_ids.length === 1 ? '' : 's'}`;
    default:
      return '→ Everyone';
  }
}

// Server-side resolver: turns a FormAudience into the actual list of members
// it targets. Filters to members with a WhatsApp number on file since this
// currently only backs the WhatsApp group-messages feature.
export async function resolveAudienceMembers(
  supabase: SupabaseClient,
  audience: FormAudience,
): Promise<{ id: string; name: string; whatsapp: string }[]> {
  let q = supabase.from('members').select('id, name, whatsapp')
    .eq('onboarding_complete', true)
    .not('whatsapp', 'is', null);

  if (audience.type === 'pillar') {
    if (audience.pillars.length === 0) return [];
    q = q.in('pillar', audience.pillars);
  } else if (audience.type === 'life_stage') {
    if (audience.stages.length === 0) return [];
    q = q.in('life_stage', audience.stages);
  } else if (audience.type === 'specific') {
    if (audience.member_ids.length === 0) return [];
    q = q.in('id', audience.member_ids);
  } else if (audience.type === 'cell') {
    if (!audience.cell_id) return [];
    const { data: cellMembers } = await supabase.from('cell_members').select('member_id').eq('cell_id', audience.cell_id);
    const ids = (cellMembers ?? []).map((m: { member_id: string }) => m.member_id);
    if (ids.length === 0) return [];
    q = q.in('id', ids);
  }

  const { data } = await q;
  return (data ?? []) as { id: string; name: string; whatsapp: string }[];
}

export function matchesAudience(
  a: FormAudience | null | undefined,
  member: { id: string; pillar: string | null; life_stage: string | null },
  memberCellIds: Set<string>,
): boolean {
  if (!a || a.type === 'everyone') return true;
  switch (a.type) {
    case 'pillar':
      return !!member.pillar && a.pillars.includes(member.pillar);
    case 'life_stage':
      return !!member.life_stage && a.stages.includes(member.life_stage);
    case 'cell':
      return memberCellIds.has(a.cell_id);
    case 'specific':
      return a.member_ids.includes(member.id);
    default:
      return true;
  }
}
