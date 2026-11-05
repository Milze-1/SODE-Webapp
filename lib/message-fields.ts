// Personalised WhatsApp messages: {{field}} placeholders filled from each
// member's record. Shared by the server (sending) and the admin page
// (insert buttons + preview), so it must stay free of server-only imports.
//
//   Hi {{first_name}}, the {{department|church}} team needs you this Sunday!
//
// `{{field|fallback}}` uses the fallback when the member has no value.

import { LIFE_STAGE_OPTIONS } from '@/lib/forms-audience';

export interface PersonalizeMember {
  name: string;
  life_stage?: string | null;
  department?: string | null;
  industry?: string | null;
  career_stage?: string | null;
  points?: number | null;
  cell?: string | null;
}

// Columns read from `members` for personalising (the cell comes from cell_members)
export const PERSONALIZE_COLUMNS = 'id, name, whatsapp, life_stage, department, industry, career_stage, points';

export const MESSAGE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'first_name', label: 'First name', hint: 'Ada' },
  { key: 'name', label: 'Full name', hint: 'Ada Obi' },
  { key: 'cell', label: 'Cell', hint: 'their cell group' },
  { key: 'department', label: 'Department', hint: 'e.g. Choir' },
  { key: 'life_stage', label: 'Life stage', hint: 'e.g. Professional' },
  { key: 'career_stage', label: 'Career stage', hint: 'e.g. Building (3–7 yrs)' },
  { key: 'industry', label: 'Industry', hint: 'e.g. Technology' },
  { key: 'points', label: 'Points', hint: 'their points total' },
];

function lifeStageLabel(v: string): string {
  return LIFE_STAGE_OPTIONS.find(o => o.key === v)?.label
    ?? v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function memberFieldValues(m: PersonalizeMember): Record<string, string> {
  const name = m.name?.trim() ?? '';
  const dept = m.department?.trim() ?? '';
  return {
    first_name: name.split(/\s+/)[0] ?? name,
    name,
    cell: m.cell?.trim() ?? '',
    department: /^not yet$/i.test(dept) ? '' : dept,
    life_stage: m.life_stage ? lifeStageLabel(m.life_stage) : '',
    career_stage: m.career_stage?.trim() ?? '',
    industry: m.industry?.trim() ?? '',
    points: m.points != null ? String(m.points) : '',
  };
}

const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;

export function personalize(template: string, m: PersonalizeMember): string {
  const values = memberFieldValues(m);
  return template.replace(TOKEN, (whole, key: string, fallback?: string) => {
    const k = key.toLowerCase();
    if (!(k in values)) return whole; // unknown placeholder: leave as typed
    return values[k] || (fallback ?? '').trim();
  });
}

// Placeholders in a template that have no fallback, e.g. ['cell', 'department']
export function fieldsWithoutFallback(template: string): string[] {
  const out = new Set<string>();
  for (const match of Array.from(template.matchAll(TOKEN))) {
    const k = match[1].toLowerCase();
    if (match[2] === undefined && MESSAGE_FIELDS.some(f => f.key === k)) out.add(k);
  }
  return Array.from(out);
}

export function unknownFields(template: string): string[] {
  const out = new Set<string>();
  for (const match of Array.from(template.matchAll(TOKEN))) {
    if (!MESSAGE_FIELDS.some(f => f.key === match[1].toLowerCase())) out.add(match[1]);
  }
  return Array.from(out);
}
