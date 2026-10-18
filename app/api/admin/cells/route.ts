import { requireAdmin } from '@/lib/admin-auth';

// Cells: list / create / update / delete, and add / remove members.
// Server-side (service role) so every admin role can manage cells.

const PILLARS = new Set(['spiritual', 'career', 'business', 'character']);

export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const [{ data: cells, error }, { data: links }] = await Promise.all([
    a.db.from('cells').select('id,name,pillar,leader_id,description,meeting_schedule,is_active,created_at').order('name'),
    a.db.from('cell_members').select('id,cell_id,member_id,role,joined_at'),
  ]);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const memberIds = Array.from(new Set([
    ...((links ?? []) as { member_id: string }[]).map(l => l.member_id),
    ...((cells ?? []) as { leader_id: string | null }[]).map(c => c.leader_id).filter(Boolean) as string[],
  ]));
  const { data: people } = memberIds.length
    ? await a.db.from('members').select('id,name,email,whatsapp').in('id', memberIds)
    : { data: [] };
  const byId = Object.fromEntries(((people ?? []) as { id: string }[]).map(p => [p.id, p]));
  return Response.json({
    cells: ((cells ?? []) as { id: string; leader_id: string | null }[]).map(c => ({
      ...c,
      leader: c.leader_id ? byId[c.leader_id] ?? null : null,
      members: ((links ?? []) as { cell_id: string; member_id: string; role: string; joined_at: string }[])
        .filter(l => l.cell_id === c.id)
        .map(l => ({ ...byId[l.member_id], role: l.role, joined_at: l.joined_at })),
    })),
  });
}

// Create or update a cell: { id?, name, pillar, leader_id, meeting_schedule, description, is_active }
export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const b = await request.json().catch(() => ({})) as {
    id?: string; name?: string; pillar?: string | null; leader_id?: string | null;
    meeting_schedule?: string | null; description?: string | null; is_active?: boolean;
  };
  if (!b.name?.trim()) return Response.json({ error: 'Give the cell a name.' }, { status: 400 });
  if (b.pillar && !PILLARS.has(b.pillar)) return Response.json({ error: 'Unknown pillar.' }, { status: 400 });
  const row = {
    name: b.name.trim().slice(0, 80),
    pillar: b.pillar || null,
    leader_id: b.leader_id || null,
    meeting_schedule: b.meeting_schedule?.trim().slice(0, 120) || null,
    description: b.description?.trim().slice(0, 1000) || null,
    is_active: b.is_active !== false,
    updated_at: new Date().toISOString(),
  };
  const res = b.id
    ? await a.db.from('cells').update(row).eq('id', b.id).select('id').single()
    : await a.db.from('cells').insert(row).select('id').single();
  if (res.error) return Response.json({ error: res.error.message }, { status: 500 });

  // The leader is always a member of their cell
  if (row.leader_id) {
    const { data: existing } = await a.db.from('cell_members').select('id').eq('cell_id', res.data.id).eq('member_id', row.leader_id).maybeSingle();
    if (existing) await a.db.from('cell_members').update({ role: 'leader' }).eq('id', existing.id);
    else await a.db.from('cell_members').insert({ cell_id: res.data.id, member_id: row.leader_id, role: 'leader' });
  }
  return Response.json({ ok: true, id: res.data.id });
}

// { cellId } deletes a cell; { cellId, memberId } removes one member
export async function DELETE(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { cellId, memberId } = await request.json().catch(() => ({})) as { cellId?: string; memberId?: string };
  if (!cellId) return Response.json({ error: 'cellId required' }, { status: 400 });
  if (memberId) {
    const { error } = await a.db.from('cell_members').delete().eq('cell_id', cellId).eq('member_id', memberId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }
  await a.db.from('cell_members').delete().eq('cell_id', cellId);
  const { error } = await a.db.from('cells').delete().eq('id', cellId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// Add members: { cellId, memberIds: [] } (a member can be in one cell at a time)
export async function PUT(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { cellId, memberIds } = await request.json().catch(() => ({})) as { cellId?: string; memberIds?: string[] };
  if (!cellId || !Array.isArray(memberIds) || memberIds.length === 0) return Response.json({ error: 'Choose members to add.' }, { status: 400 });
  await a.db.from('cell_members').delete().in('member_id', memberIds).neq('cell_id', cellId);
  const { data: already } = await a.db.from('cell_members').select('member_id').eq('cell_id', cellId).in('member_id', memberIds);
  const have = new Set(((already ?? []) as { member_id: string }[]).map(r => r.member_id));
  const rows = memberIds.filter(id => !have.has(id)).map(member_id => ({ cell_id: cellId, member_id, role: 'member' }));
  if (rows.length) {
    const { error } = await a.db.from('cell_members').insert(rows);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, added: rows.length });
}
