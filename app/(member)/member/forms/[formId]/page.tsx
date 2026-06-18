'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';
import { Icon, PILLARS } from '@/components/sode/icons';
import { Avatar, PillarChip, OptionChips, TextInput, ProgressBar, StickyFooter } from '@/components/sode/ui';
import { matchesAudience, type FormAudience } from '@/lib/forms-audience';

type FieldType =
  | 'short_text' | 'long_text' | 'number' | 'single_select' | 'multi_select'
  | 'nps' | 'date' | 'file_upload' | 'pillar_picker' | 'member_picker';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  hint?: string;
  required: boolean;
  options?: string[];
  low_label?: string;
  high_label?: string;
  pillars?: string[];
  scope?: string;
  min?: number;
  max?: number;
}

interface RawFormFieldRow {
  id: string; label: string; field_type: string; options: unknown; required: boolean; sort_order: number;
}

function rawOptionsToField(r: RawFormFieldRow): FormField {
  const o = (r.options ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    type: (r.field_type as FieldType) || 'short_text',
    label: r.label,
    required: r.required,
    hint: typeof o.hint === 'string' ? o.hint : undefined,
    options: Array.isArray(o.choices) ? (o.choices as string[]) : undefined,
    low_label: typeof o.low_label === 'string' ? o.low_label : undefined,
    high_label: typeof o.high_label === 'string' ? o.high_label : undefined,
    pillars: Array.isArray(o.pillars) ? (o.pillars as string[]) : undefined,
    scope: typeof o.scope === 'string' ? o.scope : undefined,
    min: typeof o.min === 'number' ? o.min : undefined,
    max: typeof o.max === 'number' ? o.max : undefined,
  };
}

interface MemberMeta { id: string; name: string; pillar: string | null; life_stage: string | null; points: number }
interface FormMeta { id: string; title: string; description: string | null; form_audience: FormAudience | null }
interface MemberOption { id: string; name: string; }

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function LoadingSkeleton() {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flex: 1, padding: '72px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[8, 160].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
      </div>
    </div>
  );
}

function CenteredMessage({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28 }}>
        <div style={{ width: 66, height: 66, borderRadius: 20, background: 'var(--navy-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)' }}>
          <Icon name={icon} size={30} stroke={1.9} />
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 16, letterSpacing: '-.01em' }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 7, lineHeight: 1.5, maxWidth: 280 }}>{body}</p>
        <Link href="/member/forms" className="btn btn-primary" style={{ marginTop: 20, textDecoration: 'none' }}>
          <Icon name="arrowleft" size={17} color="#fff" /> Back to forms
        </Link>
      </div>
    </div>
  );
}

export default function FormFillPage() {
  const params = useParams();
  const router = useRouter();
  const formId = String(params.formId);

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberMeta | null>(null);
  const [form, setForm] = useState<FormMeta | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [status, setStatus] = useState<'ok' | 'not_found' | 'blocked' | 'already_done'>('ok');

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [awarded, setAwarded] = useState(0);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: memberRow } = await supabase
        .from('members')
        .select('id,name,pillar,life_stage,points,onboarding_complete')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (!memberRow?.onboarding_complete) { router.replace('/member/onboarding'); return; }
      const meta: MemberMeta = { id: memberRow.id, name: memberRow.name, pillar: memberRow.pillar, life_stage: memberRow.life_stage, points: memberRow.points ?? 0 };
      setMember(meta);

      const [formRes, cellRes, responseRes] = await Promise.all([
        supabase.from('forms').select('id,title,description,form_audience').eq('id', formId).maybeSingle(),
        supabase.from('cell_members').select('cell_id').eq('member_id', meta.id),
        supabase.from('form_responses').select('id').eq('form_id', formId).eq('member_id', meta.id).maybeSingle(),
      ]);

      if (!formRes.data) { setStatus('not_found'); setLoading(false); return; }
      const formMeta = formRes.data as FormMeta;
      setForm(formMeta);

      const cellIds = new Set(((cellRes.data ?? []) as { cell_id: string }[]).map(c => c.cell_id));

      if (responseRes.data) { setStatus('already_done'); setLoading(false); return; }

      if (!matchesAudience(formMeta.form_audience, meta, cellIds)) {
        setStatus('blocked');
        setLoading(false);
        return;
      }

      const { data: fieldRows } = await supabase
        .from('form_fields')
        .select('id,label,field_type,options,required,sort_order')
        .eq('form_id', formId)
        .order('sort_order');
      setFields(((fieldRows ?? []) as RawFormFieldRow[]).map(rawOptionsToField));
      setLoading(false);
    })();
  }, [router, formId]);

  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const field = fields[index];
    let q = createClient().from('members').select('id,name').eq('onboarding_complete', true).ilike('name', `%${memberSearch.trim()}%`).limit(6);
    if (field?.scope === 'pillar' && member?.pillar) q = q.eq('pillar', member.pillar);
    q.then(({ data }) => {
      let rows = (data ?? []) as MemberOption[];
      if (field?.scope === 'cell') rows = rows; // cell filtering requires join; left as name search within all members
      setMemberResults(rows);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearch, index]);

  const field = fields[index];
  const total = fields.length;
  const progress = total > 0 ? (index + 1) / total : 0;

  const setAnswer = (v: unknown) => {
    if (!field) return;
    setAnswers(a => ({ ...a, [field.id]: v }));
    setError(null);
  };

  const goNext = async () => {
    if (!field) return;
    if (field.required && isEmpty(answers[field.id])) {
      setError('This question is required');
      return;
    }
    setError(null);
    if (index < total - 1) {
      setIndex(i => i + 1);
      setMemberSearch('');
    } else {
      await submit();
    }
  };

  const goBack = () => {
    setError(null);
    if (index === 0) { router.push('/member/forms'); return; }
    setIndex(i => i - 1);
    setMemberSearch('');
  };

  const submit = async () => {
    if (!member) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: inserted, error: insertError } = await supabase
        .from('form_responses')
        .insert({ form_id: formId, member_id: member.id, data: answers })
        .select('id')
        .single();
      if (insertError) { setError('Could not submit — try again.'); setSubmitting(false); return; }
      const pts = await awardPoints(member.id, 'form_submitted', 'form_responses', inserted.id);
      setAwarded(pts);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const pillarChoices = useMemo(() => {
    if (!field) return [];
    return field.pillars?.length ? field.pillars : PILLARS.map(p => p.key);
  }, [field]);

  if (loading) return <LoadingSkeleton />;
  if (status === 'not_found') return <CenteredMessage icon="info" title="Form not found" body="This form may have been removed or the link is out of date." />;
  if (status === 'blocked') return <CenteredMessage icon="lock" title="Not available for you" body="This form is not available for you." />;
  if (status === 'already_done') return <CenteredMessage icon="check" title="Already completed" body="You already completed this form ✓" />;

  if (submitted) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sode-pop .5s cubic-bezier(.22,1.4,.4,1)' }}>
            <Icon name="check" size={36} stroke={2.8} color="#fff" />
          </div>
          <h2 style={{ fontSize: 21, fontWeight: 800, marginTop: 18 }}>Thank you, {member?.name?.split(' ')[0]}!</h2>
          <p style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 6 }}>Your response has been recorded.</p>
          {awarded > 0 && (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, background: 'var(--navy-tint)', color: 'var(--navy)', fontWeight: 700, fontSize: 13 }}>
              <Icon name="zap" size={15} stroke={2.4} /> +{awarded} points
            </div>
          )}
          <Link href="/member/forms" className="btn btn-primary" style={{ marginTop: 24, textDecoration: 'none' }}>
            <Icon name="arrowleft" size={17} color="#fff" /> Back to forms
          </Link>
        </div>
      </div>
    );
  }

  if (!field) return <CenteredMessage icon="info" title="No questions yet" body="This form doesn't have any questions configured." />;

  const value = answers[field.id];

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
        {form?.title && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{form.title}</div>}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Question {index + 1} of {total}</div>
        <ProgressBar value={progress} height={6} />
      </div>

      <div className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 140px' }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.3 }}>
          {field.label || 'Untitled question'}{field.required && <span style={{ color: '#c0392b' }}> *</span>}
        </div>
        {field.hint && <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8 }}>{field.hint}</div>}

        <div style={{ marginTop: 22 }}>
          {field.type === 'short_text' && (
            <TextInput value={(value as string) ?? ''} onChange={setAnswer} placeholder="Type your answer…" />
          )}

          {field.type === 'long_text' && (
            <TextInput value={(value as string) ?? ''} onChange={setAnswer} multiline rows={5} placeholder="Type your answer…" />
          )}

          {field.type === 'number' && (
            <input
              className="input" type="number"
              min={field.min} max={field.max}
              value={value != null ? String(value) : ''}
              onChange={e => setAnswer(e.target.value === '' ? undefined : Number(e.target.value))}
              style={{ width: '100%' }}
            />
          )}

          {field.type === 'single_select' && (
            <OptionChips options={(field.options ?? []).filter(Boolean)} value={(value as string) ?? ''} onChange={setAnswer} />
          )}

          {field.type === 'multi_select' && (
            <OptionChips options={(field.options ?? []).filter(Boolean)} value={(value as string[]) ?? []} onChange={setAnswer} multi />
          )}

          {field.type === 'nps' && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Array.from({ length: 11 }, (_, n) => n).map(n => {
                  const sel = value === n;
                  return (
                    <button key={n} onClick={() => setAnswer(n)} style={{ width: 38, height: 38, borderRadius: 999, fontSize: 13, fontWeight: 700, background: sel ? 'var(--navy)' : 'var(--surface)', color: sel ? '#fff' : 'var(--ink)', border: sel ? '1px solid var(--navy)' : '1px solid var(--line-2)' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              {(field.low_label || field.high_label) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: 'var(--faint)' }}>
                  <span>{field.low_label}</span><span>{field.high_label}</span>
                </div>
              )}
            </div>
          )}

          {field.type === 'date' && (
            <input className="input" type="date" value={(value as string) ?? ''} onChange={e => setAnswer(e.target.value)} style={{ width: '100%' }} />
          )}

          {field.type === 'file_upload' && (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px', borderRadius: 14, border: '2px dashed var(--line-2)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'center' }}>
              <Icon name="download" size={26} color="var(--muted)" />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{(value as string) || 'Tap to upload, or drag a file here'}</span>
              <input type="file" style={{ display: 'none' }} onChange={e => setAnswer(e.target.files?.[0]?.name)} />
            </label>
          )}

          {field.type === 'pillar_picker' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pillarChoices.map(key => {
                const sel = value === key;
                return (
                  <button key={key} onClick={() => setAnswer(key)} style={{ borderRadius: 999, opacity: sel ? 1 : 0.55 }}>
                    <PillarChip pillar={key} solid={sel} />
                  </button>
                );
              })}
            </div>
          )}

          {field.type === 'member_picker' && (
            <div>
              <TextInput value={memberSearch} onChange={setMemberSearch} placeholder="Search members…" />
              {value != null && !memberSearch && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 10, background: 'var(--navy-tint)' }}>
                  <Avatar name={(answers[`${field.id}__name`] as string) ?? ''} size={28} tone="navy" />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{(answers[`${field.id}__name`] as string) ?? ''}</span>
                </div>
              )}
              {memberResults.length > 0 && (
                <div style={{ marginTop: 8, border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                  {memberResults.map(m => (
                    <div key={m.id} onClick={() => { setAnswer(m.id); setAnswers(a => ({ ...a, [`${field.id}__name`]: m.name })); setMemberSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                      <Avatar name={m.name} size={26} tone="grey" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: '#c0392b' }}>{error}</div>
        )}
      </div>

      <StickyFooter>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={goBack} className="btn btn-ghost" style={{ flex: '0 0 auto', paddingLeft: 18, paddingRight: 18 }}>
            <Icon name="arrowleft" size={18} /> Back
          </button>
          <button onClick={goNext} disabled={submitting} className="btn btn-primary btn-block">
            {index < total - 1 ? <>Next <Icon name="chevronright" size={18} color="#fff" /></> : (submitting ? 'Submitting…' : 'Submit')}
          </button>
        </div>
      </StickyFooter>
    </div>
  );
}
