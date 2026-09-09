import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase-server';
import { getUserRoles, hasAdminAccess } from '@/lib/roles';

interface ExportMemberRow {
  name: string;
  email: string | null;
  whatsapp: string | null;
  pillar: string | null;
  life_stage: string | null;
  department: string | null;
  is_leader: boolean | null;
  is_mentor: boolean | null;
  onboarding_complete: boolean;
  points: number | null;
  created_at: string;
  updated_at: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await getUserRoles(user.id);
  if (!hasAdminAccess(roles)) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const { members } = await request.json() as { members?: ExportMemberRow[] };
  if (!Array.isArray(members)) return Response.json({ error: 'members array is required' }, { status: 400 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SODE Growth Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Members');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'WhatsApp', key: 'whatsapp', width: 18 },
    { header: 'Pillar', key: 'pillar', width: 14 },
    { header: 'Life stage', key: 'lifeStage', width: 16 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Role', key: 'role', width: 16 },
    { header: 'Points', key: 'points', width: 10 },
    { header: 'Onboarded', key: 'onboarded', width: 12 },
    { header: 'Joined', key: 'joined', width: 14 },
    { header: 'Last updated', key: 'updated', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const m of members) {
    sheet.addRow({
      name: m.name ?? '',
      email: m.email ?? '',
      whatsapp: m.whatsapp ?? '',
      pillar: m.pillar ?? '',
      lifeStage: m.life_stage ?? '',
      department: m.department ?? '',
      role: m.is_mentor ? `Mentor${m.is_leader ? ' · Leader' : ''}` : m.is_leader ? 'Leader' : 'Member',
      points: m.points ?? 0,
      onboarded: m.onboarding_complete ? 'Yes' : 'No',
      joined: fmtDate(m.created_at),
      updated: fmtDate(m.updated_at),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `members-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
