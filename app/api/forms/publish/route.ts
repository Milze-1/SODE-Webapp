import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { type FormAudience } from '@/lib/forms-audience';
import { sendBulkEmail, emailWrapper, ctaButton } from '@/lib/email';

export async function POST(req: Request) {
  const { formId } = await req.json().catch(() => ({ formId: null }));
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: form } = await supabase
    .from('forms')
    .select('id,title,form_audience')
    .eq('id', formId)
    .maybeSingle();
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  const { error: updateError } = await supabase.from('forms').update({ is_active: true }).eq('id', formId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 403 });

  const audience = (form.form_audience ?? { type: 'everyone' }) as FormAudience;
  let memberQuery = supabase.from('members').select('id, name, email').eq('onboarding_complete', true);

  if (audience.type === 'pillar') {
    memberQuery = memberQuery.in('pillar', audience.pillars);
  } else if (audience.type === 'life_stage') {
    memberQuery = memberQuery.in('life_stage', audience.stages);
  } else if (audience.type === 'specific') {
    memberQuery = memberQuery.in('id', audience.member_ids);
  } else if (audience.type === 'cell') {
    const { data: cellMembers } = await supabase.from('cell_members').select('member_id').eq('cell_id', audience.cell_id);
    const ids = ((cellMembers ?? []) as { member_id: string }[]).map(m => m.member_id);
    memberQuery = memberQuery.in('id', ids);
  }

  const { data: members } = await memberQuery;
  const rows = (members ?? []) as { id: string; name: string; email: string }[];

  if (rows.length > 0) {
    const now = new Date().toISOString();
    const reminderRows = rows.map(m => ({
      member_id: m.id,
      type: 'form_published',
      reference_id: formId,
      message: `A new form is waiting for you: ${form.title}`,
      scheduled_at: now,
    }));
    await supabase.from('reminders').insert(reminderRows);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thesode.org';
    // Fire-and-forget emails
    sendBulkEmail(
      rows,
      `New form: ${form.title}`,
      r => emailWrapper(`
        <p style="font-size:14px;color:#374151;margin:0 0 6px;">Hi ${r.name},</p>
        <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a2e;">A new form is ready for you</h2>
        <div style="background:#f5f5f7;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <p style="font-weight:700;font-size:15px;margin:0;color:#1a1a2e;">${form.title}</p>
        </div>
        <p style="font-size:13.5px;color:#374151;line-height:1.65;margin:0 0 4px;">
          Please take a moment to fill it in — it only takes a few minutes.
        </p>
        ${ctaButton('Open form', `${appUrl}/member/forms`)}
      `),
    ).then(({ sent, failed }) => console.log(`[forms/publish] emails: ${sent} sent, ${failed} failed`))
      .catch(e => console.error('[forms/publish] email error (non-fatal):', e));
  }

  return NextResponse.json({ notified: rows.length });
}
