import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase-server';
import { getUserRoles, hasAdminAccess } from '@/lib/roles';
import { buildReport, type ReportType, type ReportPeriod, type Report } from '@/lib/reports-server';

// GET /api/admin/reports?type=scorecard&period=month&format=xlsx|csv|html
// Live-data reports for Admin → Reports (built in lib/reports-server.ts).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TYPES = new Set<ReportType>(['scorecard', 'attendance', 'members', 'goals', 'devotion']);
const PERIODS = new Set<ReportPeriod>(['month', 'quarter', 'year', 'cycle']);

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const slug = (r: Report) => `SODE_${r.title.replace(/[^A-Za-z0-9]+/g, '-')}_${r.periodLabel.replace(/[^A-Za-z0-9]+/g, '-')}`;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAdminAccess(await getUserRoles(user.id))) return Response.json({ error: 'Admin access required' }, { status: 403 });

  const q = new URL(request.url).searchParams;
  const type = q.get('type') as ReportType;
  const period = (q.get('period') ?? 'month') as ReportPeriod;
  const format = q.get('format') ?? 'xlsx';
  if (!TYPES.has(type) || !PERIODS.has(period)) return Response.json({ error: 'Unknown report or period' }, { status: 400 });

  let report: Report;
  try {
    report = await buildReport(type, period);
  } catch (e) {
    console.error('[admin/reports] build failed:', (e as Error).message);
    return Response.json({ error: `Could not build the report: ${(e as Error).message}` }, { status: 500 });
  }

  if (format === 'csv') {
    const sheet = report.sheets[0];
    const lines = [sheet.columns.map(c => csvCell(c.header)).join(','), ...sheet.rows.map(r => sheet.columns.map(c => csvCell(r[c.key])).join(','))];
    return new Response('﻿' + lines.join('\r\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug(report)}.csv"` },
    });
  }

  if (format === 'html') {
    const tables = report.sheets.map(s => `
      <h2>${esc(s.name)}</h2>
      ${s.rows.length === 0 ? '<p class="empty">No data for this period.</p>' : `
      <table><thead><tr>${s.columns.map(c => `<th>${esc(c.header)}</th>`).join('')}</tr></thead>
      <tbody>${s.rows.map(r => `<tr>${s.columns.map(c => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`}`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(report.title)} — ${esc(report.periodLabel)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;margin:32px;font-size:12px}
  h1{font-size:22px;margin:0}.meta{color:#6b7280;margin:4px 0 24px}
  h2{font-size:15px;margin:26px 0 8px;page-break-after:avoid}
  table{border-collapse:collapse;width:100%;page-break-inside:auto}
  th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-weight:700}tr{page-break-inside:avoid}.empty{color:#6b7280}
  .bar{position:sticky;top:0;background:#fff;padding:10px 0;margin-bottom:10px}
  button{background:#1e2a52;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer}
  @media print{.bar{display:none}body{margin:12mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>${esc(report.title)}</h1><div class="meta">${esc(report.periodLabel)} · Generated ${esc(report.generatedAt)} · SODE</div>
${tables}
</body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SODE Growth Platform';
  wb.created = new Date();
  for (const s of report.sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map(c => ({ header: c.header, key: c.key, width: c.width ?? 14 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    s.rows.forEach(r => ws.addRow(r));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${slug(report)}.xlsx"`,
    },
  });
}
