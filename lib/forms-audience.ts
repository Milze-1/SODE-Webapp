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
  { key: 'young_professional', label: 'Young professional' },
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
