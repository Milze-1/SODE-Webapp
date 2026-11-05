import { createAdminClient } from '@/lib/supabase-server';
import { PERSONALIZE_COLUMNS, type PersonalizeMember } from '@/lib/message-fields';

type DB = ReturnType<typeof createAdminClient>;

export type PersonalizeRow = PersonalizeMember & { id: string; whatsapp: string | null };

// Loads everything {{placeholders}} can use for the given members, cell name included.
export async function loadPersonalizeData(db: DB, memberIds: string[]): Promise<Map<string, PersonalizeRow>> {
  const out = new Map<string, PersonalizeRow>();
  const ids = Array.from(new Set(memberIds));
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [{ data: ms }, { data: cms }] = await Promise.all([
      db.from('members').select(PERSONALIZE_COLUMNS).in('id', chunk),
      db.from('cell_members').select('member_id, cell_id').in('member_id', chunk),
    ]);
    const cellIds = Array.from(new Set(((cms ?? []) as { cell_id: string }[]).map(c => c.cell_id)));
    const cellNames = new Map<string, string>();
    if (cellIds.length) {
      const { data: cells } = await db.from('cells').select('id, name').in('id', cellIds);
      for (const c of (cells ?? []) as { id: string; name: string }[]) cellNames.set(c.id, c.name);
    }
    const cellOf = new Map<string, string>();
    for (const cm of (cms ?? []) as { member_id: string; cell_id: string }[]) {
      const n = cellNames.get(cm.cell_id);
      if (n && !cellOf.has(cm.member_id)) cellOf.set(cm.member_id, n);
    }
    for (const m of (ms ?? []) as unknown as PersonalizeRow[]) out.set(m.id, { ...m, cell: cellOf.get(m.id) ?? null });
  }
  return out;
}
