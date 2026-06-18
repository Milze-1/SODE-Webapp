import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { matchesAudience, type FormAudience } from '@/lib/forms-audience';

interface FormRow {
  id: string;
  title: string;
  description: string | null;
  estimated_seconds: number | null;
  is_pulse: boolean;
  is_wins_form: boolean;
  form_audience: FormAudience | null;
  open_at: string | null;
  close_at: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('members')
    .select('id,pillar,life_stage')
    .eq('auth_id', user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const now = new Date().toISOString();
  const [formsRes, cellRes, responsesRes] = await Promise.all([
    supabase
      .from('forms')
      .select('id,title,description,estimated_seconds,is_pulse,is_wins_form,form_audience,open_at,close_at')
      .eq('is_active', true)
      .or(`close_at.is.null,close_at.gt.${now}`),
    supabase.from('cell_members').select('cell_id').eq('member_id', member.id),
    supabase.from('form_responses').select('form_id').eq('member_id', member.id),
  ]);

  const memberCellIds = new Set(((cellRes.data ?? []) as { cell_id: string }[]).map(c => c.cell_id));
  const doneIds = new Set(((responsesRes.data ?? []) as { form_id: string }[]).map(r => r.form_id));

  const forms = (formsRes.data ?? []) as FormRow[];
  const visible = forms.filter(f =>
    !f.is_wins_form &&
    !doneIds.has(f.id) &&
    matchesAudience(f.form_audience, member, memberCellIds),
  );

  const withEstimates = await Promise.all(visible.map(async f => {
    if (f.estimated_seconds) return f;
    const { count } = await supabase.from('form_fields').select('id', { count: 'exact', head: true }).eq('form_id', f.id);
    return { ...f, estimated_seconds: (count ?? 0) * 30 || null };
  }));

  return NextResponse.json({ forms: withEstimates });
}
