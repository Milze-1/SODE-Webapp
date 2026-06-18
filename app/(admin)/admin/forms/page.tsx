'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, Segmented, TextInput, Field, Toggle, PillarChip, OptionChips } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, Skeleton } from '@/components/admin/chrome';
import { summarizeAudience, PILLAR_OPTIONS, LIFE_STAGE_OPTIONS, type FormAudience } from '@/lib/forms-audience';

const FIELD_TYPES = [
  { type: 'short_text', label: 'Short text', icon: 'pencil' },
  { type: 'long_text', label: 'Long text', icon: 'list' },
  { type: 'number', label: 'Number', icon: 'zap' },
  { type: 'single_select', label: 'Single select', icon: 'check' },
  { type: 'multi_select', label: 'Multi select', icon: 'grid' },
  { type: 'nps', label: 'NPS 0–10', icon: 'trendingup' },
  { type: 'date', label: 'Date', icon: 'calendarclock' },
  { type: 'file_upload', label: 'File upload', icon: 'download' },
  { type: 'pillar_picker', label: 'Pillar picker', icon: 'target' },
  { type: 'member_picker', label: 'Member picker', icon: 'users' },
] as const;

type FieldType = typeof FIELD_TYPES[number]['type'];

const FIELD_TYPE_LABEL: Record<FieldType, string> = Object.fromEntries(
  FIELD_TYPES.map(f => [f.type, f.label]),
) as Record<FieldType, string>;

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  hint?: string;
  required: boolean;
  options?: string[];
  low_label?: string;
  high_label?: string;
  accepted_types?: string[];
  max_size?: string;
  pillars?: string[];
  scope?: string;
  min?: number;
  max?: number;
}

const AUDIENCE_TYPES: { key: FormAudience['type']; label: string; desc: string }[] = [
  { key: 'everyone', label: 'Everyone', desc: 'All onboarded members' },
  { key: 'pillar', label: 'By pillar', desc: "Members whose primary pillar matches" },
  { key: 'life_stage', label: 'By life stage', desc: 'Members at a matching life stage' },
  { key: 'cell', label: 'By cell', desc: 'Members of one cell group' },
  { key: 'specific', label: 'Specific members', desc: 'Hand-pick individual members' },
];

function defaultAudience(key: FormAudience['type']): FormAudience {
  switch (key) {
    case 'pillar': return { type: 'pillar', pillars: [] };
    case 'life_stage': return { type: 'life_stage', stages: [] };
    case 'cell': return { type: 'cell', cell_id: '' };
    case 'specific': return { type: 'specific', member_ids: [] };
    default: return { type: 'everyone' };
  }
}

function relativeDate(iso: string | null) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

interface FormRow {
  id: string; title: string; description: string | null;
  is_active: boolean; created_at: string; form_audience: FormAudience | null; response_count?: number;
}
interface ResponseRow {
  id: string; member_id: string; submitted_at: string;
  data: Record<string, unknown>; members: { name: string }[] | null;
}
interface RawFormFieldRow {
  id: string; label: string; field_type: string; options: unknown; required: boolean; sort_order: number;
}
interface CellOption { id: string; name: string; }
interface MemberOption { id: string; name: string; }

type PageView = 'builder' | 'responses' | 'import';

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
    accepted_types: Array.isArray(o.accepted_types) ? (o.accepted_types as string[]) : undefined,
    max_size: typeof o.max_size === 'string' ? o.max_size : undefined,
    pillars: Array.isArray(o.pillars) ? (o.pillars as string[]) : undefined,
    scope: typeof o.scope === 'string' ? o.scope : undefined,
    min: typeof o.min === 'number' ? o.min : undefined,
    max: typeof o.max === 'number' ? o.max : undefined,
  };
}

function fieldToRow(f: FormField, formId: string, sortOrder: number) {
  return {
    id: f.id,
    form_id: formId,
    field_key: f.id,
    label: f.label,
    field_type: f.type,
    required: f.required,
    sort_order: sortOrder,
    options: {
      hint: f.hint,
      choices: f.options,
      low_label: f.low_label,
      high_label: f.high_label,
      accepted_types: f.accepted_types,
      max_size: f.max_size,
      pillars: f.pillars,
      scope: f.scope,
      min: f.min,
      max: f.max,
    },
  };
}

function renderPreviewControl(f: FormField) {
  switch (f.type) {
    case 'short_text':
      return <input className="input" disabled style={{ width: '100%' }} />;
    case 'long_text':
      return <textarea className="input" disabled rows={3} style={{ width: '100%', resize: 'none' }} />;
    case 'number':
      return <input className="input" type="number" disabled style={{ width: '100%' }} />;
    case 'single_select':
      return <OptionChips options={(f.options ?? []).filter(Boolean)} value="" onChange={() => {}} />;
    case 'multi_select':
      return <OptionChips options={(f.options ?? []).filter(Boolean)} value={[]} onChange={() => {}} multi />;
    case 'nps':
      return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: 11 }, (_, n) => n).map(n => (
            <span key={n} style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
          ))}
        </div>
      );
    case 'date':
      return <input className="input" type="date" disabled style={{ width: '100%' }} />;
    case 'file_upload':
      return (
        <div style={{ padding: 16, borderRadius: 9, border: '2px dashed var(--line-2)', textAlign: 'center', fontSize: 11.5, color: 'var(--faint)' }}>
          Tap to upload
        </div>
      );
    case 'pillar_picker':
      return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(f.pillars?.length ? f.pillars : ['spiritual', 'career', 'business', 'character']).map(key => (
            <PillarChip key={key} pillar={key} size="sm" />
          ))}
        </div>
      );
    case 'member_picker':
      return <input className="input" disabled placeholder="Search members…" style={{ width: '100%' }} />;
    default:
      return null;
  }
}

function FieldRow({
  field, selected, onSelect, onCollapse, onUpdate, onRemove,
  deleteConfirm, onAskDelete, onConfirmDelete, onCancelDelete,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onCollapse: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  deleteConfirm: boolean;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [hover, setHover] = useState(false);

  if (!selected) {
    return (
      <div
        onClick={onSelect}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer' }}
      >
        <Icon name="menu" size={16} color="var(--faint)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: field.label ? 'var(--ink)' : 'var(--faint)' }}>
            {field.label || 'Untitled question'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--faint)' }}>{FIELD_TYPE_LABEL[field.type]}</div>
        </div>
        {hover && (
          <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ color: 'var(--faint)', background: 'none', cursor: 'pointer' }}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderLeft: '4px solid var(--navy)', borderRadius: 10, boxShadow: 'var(--sh-sm)', padding: 16 }}>
      <Field label="Question label">
        <TextInput value={field.label} onChange={v => onUpdate({ label: v })} placeholder="Type your question…" />
      </Field>

      {(field.type === 'short_text' || field.type === 'long_text') && (
        <Field label="Hint text (optional)">
          <TextInput value={field.hint ?? ''} onChange={v => onUpdate({ hint: v })} placeholder="Helper text shown to member" />
        </Field>
      )}

      {field.type === 'number' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Min value (optional)">
            <TextInput type="number" value={field.min != null ? String(field.min) : ''} onChange={v => onUpdate({ min: v === '' ? undefined : Number(v) })} />
          </Field>
          <Field label="Max value (optional)">
            <TextInput type="number" value={field.max != null ? String(field.max) : ''} onChange={v => onUpdate({ max: v === '' ? undefined : Number(v) })} />
          </Field>
        </div>
      )}

      {(field.type === 'single_select' || field.type === 'multi_select') && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Options</div>
          {(field.options ?? []).map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <TextInput
                value={opt}
                onChange={v => {
                  const next = [...(field.options ?? [])];
                  next[i] = v;
                  onUpdate({ options: next });
                }}
                placeholder={`Option ${i + 1}`}
              />
              <button
                onClick={() => onUpdate({ options: (field.options ?? []).filter((_, j) => j !== i) })}
                style={{ color: 'var(--faint)', background: 'none', cursor: 'pointer' }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ options: [...(field.options ?? []), ''] })}
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={14} /> Add option
          </button>
        </div>
      )}

      {field.type === 'nps' && (
        <>
          <Field label="Low label">
            <TextInput value={field.low_label ?? ''} onChange={v => onUpdate({ low_label: v })} placeholder="Not likely at all" />
          </Field>
          <Field label="High label">
            <TextInput value={field.high_label ?? ''} onChange={v => onUpdate({ high_label: v })} placeholder="Extremely likely" />
          </Field>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
            {Array.from({ length: 11 }, (_, n) => n).map(n => (
              <span key={n} style={{ width: 27, height: 27, borderRadius: 999, background: 'var(--surface-2)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{n}</span>
            ))}
          </div>
        </>
      )}

      {field.type === 'file_upload' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Accepted types</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            {['PDF', 'Image', 'Doc', 'Any'].map(t => {
              const checked = (field.accepted_types ?? []).includes(t);
              return (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const cur = field.accepted_types ?? [];
                      onUpdate({ accepted_types: checked ? cur.filter(x => x !== t) : [...cur, t] });
                    }}
                  />
                  {t}
                </label>
              );
            })}
          </div>
          <Field label="Max file size">
            <select className="input" value={field.max_size ?? '5MB'} onChange={e => onUpdate({ max_size: e.target.value })}>
              {['1MB', '5MB', '10MB'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </>
      )}

      {field.type === 'pillar_picker' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Which pillars to include</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {PILLAR_OPTIONS.map(p => {
              const checked = (field.pillars ?? []).includes(p.key);
              return (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const cur = field.pillars ?? [];
                      onUpdate({ pillars: checked ? cur.filter(x => x !== p.key) : [...cur, p.key] });
                    }}
                  />
                  {p.label}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {field.type === 'member_picker' && (
        <Field label="Search scope">
          <select className="input" value={field.scope ?? 'all'} onChange={e => onUpdate({ scope: e.target.value })}>
            <option value="all">All members</option>
            <option value="pillar">By pillar</option>
            <option value="cell">By cell</option>
          </select>
        </Field>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Required</span>
        <Toggle on={field.required} onChange={v => onUpdate({ required: v })} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        {deleteConfirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Remove this field?</span>
            <button onClick={onCancelDelete} className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 11.5 }}>Cancel</button>
            <button onClick={onConfirmDelete} className="btn btn-primary btn-sm" style={{ height: 28, fontSize: 11.5 }}>Yes, remove</button>
          </div>
        ) : (
          <button onClick={onAskDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
            <Icon name="x" size={15} /> Delete
          </button>
        )}
        <button onClick={onCollapse} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--navy)', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          Collapse <Icon name="chevrondown" size={13} />
        </button>
      </div>
    </div>
  );
}

export default function FormsPage() {
  const [view, setView] = useState<PageView>('builder');
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selForm, setSelForm] = useState<FormRow | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const persistedFieldIdsRef = useRef<Set<string>>(new Set());
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [targetCount, setTargetCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [audience, setAudience] = useState<FormAudience>({ type: 'everyone' });
  const [savingAudience, setSavingAudience] = useState(false);
  const [cells, setCells] = useState<CellOption[]>([]);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const [formsRes, cellsRes, membersRes] = await Promise.all([
          supabase.from('forms').select('id,title,description,is_active,created_at,form_audience').order('created_at', { ascending: false }),
          supabase.from('cells').select('id,name').order('name'),
          supabase.from('members').select('id,name').eq('onboarding_complete', true).order('name'),
        ]);
        setCells((cellsRes.data ?? []) as CellOption[]);
        setAllMembers((membersRes.data ?? []) as MemberOption[]);
        const data = formsRes.data;
        if (!data) { setLoading(false); return; }
        const withCounts = await Promise.all((data as FormRow[]).map(async f => {
          const { count } = await supabase.from('form_responses').select('id', { count: 'exact', head: true }).eq('form_id', f.id);
          return { ...f, response_count: count ?? 0 };
        }));
        setForms(withCounts);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const cellNameById = new Map(cells.map(c => [c.id, c.name]));

  const computeTargetCount = async (a: FormAudience | null) => {
    const supabase = createClient();
    const aud = a ?? { type: 'everyone' };
    if (aud.type === 'everyone') {
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq('onboarding_complete', true);
      return count ?? 0;
    }
    if (aud.type === 'pillar') {
      if (aud.pillars.length === 0) return 0;
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).in('pillar', aud.pillars);
      return count ?? 0;
    }
    if (aud.type === 'life_stage') {
      if (aud.stages.length === 0) return 0;
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).in('life_stage', aud.stages);
      return count ?? 0;
    }
    if (aud.type === 'cell') {
      if (!aud.cell_id) return 0;
      const { count } = await supabase.from('cell_members').select('id', { count: 'exact', head: true }).eq('cell_id', aud.cell_id);
      return count ?? 0;
    }
    if (aud.type === 'specific') return aud.member_ids.length;
    return 0;
  };

  const openForm = async (f: FormRow) => {
    setSelForm(f);
    setExpandedId(null);
    setSelectedFieldId(null);
    setDeleteConfirmId(null);
    setEditingTitle(false);
    setAudience(f.form_audience ?? { type: 'everyone' });
    try {
      const supabase = createClient();
      const [responsesRes, fieldsRes, count] = await Promise.all([
        supabase.from('form_responses').select('id,member_id,submitted_at,data,members:member_id(name)').eq('form_id', f.id).order('submitted_at', { ascending: false }).limit(200),
        supabase.from('form_fields').select('id,label,field_type,options,required,sort_order').eq('form_id', f.id).order('sort_order'),
        computeTargetCount(f.form_audience),
      ]);
      setResponses((responsesRes.data ?? []) as unknown as ResponseRow[]);
      const loaded = ((fieldsRes.data ?? []) as RawFormFieldRow[]).map(rawOptionsToField);
      setFields(loaded);
      persistedFieldIdsRef.current = new Set(loaded.map(x => x.id));
      setTargetCount(count);
    } catch { /* ignore */ }
  };

  const ensureFormExists = async (): Promise<FormRow> => {
    if (selForm) return selForm;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('forms')
      .insert({ title: 'Untitled form', is_active: false })
      .select('id,title,description,is_active,created_at,form_audience')
      .single();
    if (error || !data) {
      console.error('ensureFormExists error:', JSON.stringify(error));
      throw error ?? new Error('Failed to create form');
    }
    const row = data as FormRow;
    setForms(prev => [{ ...row, response_count: 0 }, ...prev]);
    setSelForm(row);
    setAudience(row.form_audience ?? { type: 'everyone' });
    persistedFieldIdsRef.current = new Set();
    return row;
  };

  const togglePublish = async (f: FormRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPublishing(f.id);
    try {
      const turningOn = !f.is_active;
      if (turningOn) {
        const res = await fetch('/api/forms/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formId: f.id }),
        });
        const json = await res.json().catch(() => ({}));
        setForms(fs => fs.map(x => x.id === f.id ? { ...x, is_active: true } : x));
        if (selForm?.id === f.id) setSelForm(s => s ? { ...s, is_active: true } : s);
        if (typeof json?.notified === 'number') {
          setNotice(`Published — ${json.notified} member${json.notified === 1 ? '' : 's'} notified`);
          setTimeout(() => setNotice(null), 4000);
        }
      } else {
        const supabase = createClient();
        await supabase.from('forms').update({ is_active: false }).eq('id', f.id);
        setForms(fs => fs.map(x => x.id === f.id ? { ...x, is_active: false } : x));
        if (selForm?.id === f.id) setSelForm(s => s ? { ...s, is_active: false } : s);
      }
    } catch { /* silent */ }
    finally { setPublishing(null); }
  };

  const saveAudience = async () => {
    if (!selForm) return;
    setSavingAudience(true);
    try {
      const supabase = createClient();
      await supabase.from('forms').update({ form_audience: audience }).eq('id', selForm.id);
      setForms(fs => fs.map(x => x.id === selForm.id ? { ...x, form_audience: audience } : x));
      setSelForm(s => s ? { ...s, form_audience: audience } : s);
      setTargetCount(await computeTargetCount(audience));
    } catch { /* silent */ }
    setSavingAudience(false);
  };

  const togglePillar = (key: string) => setAudience(a => a.type === 'pillar'
    ? { type: 'pillar', pillars: a.pillars.includes(key) ? a.pillars.filter(p => p !== key) : [...a.pillars, key] }
    : a);
  const toggleStage = (key: string) => setAudience(a => a.type === 'life_stage'
    ? { type: 'life_stage', stages: a.stages.includes(key) ? a.stages.filter(s => s !== key) : [...a.stages, key] }
    : a);
  const addSpecificMember = (id: string) => { setAudience(a => a.type === 'specific' && !a.member_ids.includes(id) ? { type: 'specific', member_ids: [...a.member_ids, id] } : a); setMemberSearch(''); };
  const removeSpecificMember = (id: string) => setAudience(a => a.type === 'specific' ? { type: 'specific', member_ids: a.member_ids.filter(m => m !== id) } : a);

  const filteredMembers = memberSearch.trim()
    ? allMembers.filter(m =>
        m.name.toLowerCase().includes(memberSearch.trim().toLowerCase()) &&
        !(audience.type === 'specific' && audience.member_ids.includes(m.id)),
      ).slice(0, 6)
    : [];

  // ─── Field builder actions ────────────────────────────────────────────────

  const addField = async (type: FieldType) => {
    try {
      await ensureFormExists();
    } catch { return; }
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: '',
      required: false,
      ...(type === 'single_select' || type === 'multi_select' ? { options: ['', '', ''] } : {}),
      ...(type === 'pillar_picker' ? { pillars: PILLAR_OPTIONS.map(p => p.key) } : {}),
      ...(type === 'member_picker' ? { scope: 'all' } : {}),
      ...(type === 'file_upload' ? { max_size: '5MB' } : {}),
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    if (persistedFieldIdsRef.current.has(id)) {
      persistedFieldIdsRef.current.delete(id);
      const supabase = createClient();
      supabase.from('form_fields').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('removeField delete error:', JSON.stringify(error));
      });
    }
  };

  // Auto-save fields to Supabase 1s after any change
  useEffect(() => {
    if (!selForm || fields.length === 0) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const rows = fields.map((f, i) => fieldToRow(f, selForm.id, i));
      const { error } = await supabase.from('form_fields').upsert(rows, { onConflict: 'id' });
      if (error) {
        console.error('autosave upsert error:', JSON.stringify(error));
        return;
      }
      fields.forEach(f => persistedFieldIdsRef.current.add(f.id));
      setSaveState('saved');
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, selForm?.id]);

  const startEditTitle = async () => {
    let form: FormRow;
    try {
      form = await ensureFormExists();
    } catch { return; }
    setTitleDraft(form.title);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    setEditingTitle(false);
    if (!selForm) return;
    const newTitle = titleDraft.trim() || 'Untitled form';
    if (newTitle === selForm.title) return;
    const supabase = createClient();
    const { error } = await supabase.from('forms').update({ title: newTitle }).eq('id', selForm.id);
    if (error) { console.error('saveTitle error:', JSON.stringify(error)); return; }
    setSelForm(s => s ? { ...s, title: newTitle } : s);
    setForms(fs => fs.map(f => f.id === selForm.id ? { ...f, title: newTitle } : f));
  };

  const exportCsv = () => {
    if (!selForm) return;
    const header = ['Member', ...fields.map(f => f.label)];
    const rows = [header, ...responses.map(r => {
      const membersArr = Array.isArray(r.members) ? r.members : r.members ? [r.members] : [];
      const name = membersArr[0]?.name ?? r.member_id;
      return [name, ...fields.map(f => String(r.data?.[f.id] ?? ''))];
    })];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${selForm.title}-responses.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').slice(1);
      setImportMsg(`Parsed ${lines.length} rows — connect to Supabase to import`);
    } catch { setImportMsg('Error reading file'); }
    e.target.value = '';
  };

  const canvasFormName = selForm?.title || 'Untitled form';

  return (
    <>
      <AdminTopbar
        title="Forms"
        subtitle="Build · preview · responses"
        actions={
          <button onClick={() => selForm && togglePublish(selForm)} disabled={!selForm || publishing === selForm?.id} className="btn btn-primary btn-sm">
            <Icon name="check" size={16} color="#fff" /> Publish
          </button>
        }
      />
      <AdminBody>
        <div style={{ maxWidth: 360, marginBottom: 18 }}>
          <Segmented
            options={[{ value: 'builder', label: 'Builder' }, { value: 'responses', label: 'Responses' }, { value: 'import', label: 'Import' }]}
            value={view}
            onChange={v => setView(v as PageView)}
            size="sm"
          />
        </div>

        {notice && (
          <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--navy-tint)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600, marginBottom: 14 }}>
            <Icon name="check" size={14} /> {notice}
          </div>
        )}

        {/* Builder view */}
        {view === 'builder' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr 300px', gap: 16, alignItems: 'start' }}>
              {/* Left: field palette */}
              <Panel title="Fields">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {FIELD_TYPES.map(f => (
                    <button key={f.type} onClick={() => addField(f.type)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
                      <Icon name={f.icon} size={15} color="var(--navy)" stroke={2.1} />
                      {f.label}
                      <Icon name="plus" size={14} color="var(--faint)" style={{ marginLeft: 'auto' }} />
                    </button>
                  ))}
                </div>
              </Panel>

              {/* Centre: form canvas */}
              <Panel
                title={
                  editingTitle ? (
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      placeholder="Untitled form"
                      style={{ fontSize: 14.5, fontWeight: 700, border: '1px solid var(--line-2)', outline: 'none', background: 'var(--surface)', borderRadius: 6, padding: '3px 8px', width: 200, fontFamily: 'var(--font)' }}
                    />
                  ) : (
                    <span onClick={startEditTitle} style={{ cursor: 'pointer' }}>{canvasFormName} · canvas</span>
                  )
                }
                action={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {saveState === 'saving' && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Saving…</span>}
                    {saveState === 'saved' && (
                      <span style={{ fontSize: 11, color: 'var(--navy)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="check" size={11} /> Saved
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>est. 60s</span>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Forms list (when no form selected, show forms to pick) */}
                  {!selForm && !loading && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 10 }}>Select a form to edit, or add fields to create a new one</div>
                      {forms.map(f => (
                        <div key={f.id} onClick={() => openForm(f)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line-2)', marginBottom: 7, cursor: 'pointer' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{f.title}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{f.response_count} responses</div>
                            {f.is_active && <div style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600, marginTop: 2 }}>{summarizeAudience(f.form_audience, f.form_audience?.type === 'cell' ? cellNameById.get(f.form_audience.cell_id) : undefined)}</div>}
                          </div>
                          <button onClick={e => togglePublish(f, e)} disabled={publishing === f.id} className={f.is_active ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ height: 28, padding: '0 10px' }}>
                            {publishing === f.id ? '…' : f.is_active ? 'Live' : 'Publish'}
                          </button>
                        </div>
                      ))}
                      {loading && <Skeleton h={48} />}
                    </div>
                  )}

                  {fields.length === 0 && selForm ? (
                    <div style={{ padding: '20px 12px', borderRadius: 10, border: '1.5px dashed var(--line-2)', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>
                      No questions yet — click a field type on the left to add one.
                    </div>
                  ) : (
                    fields.map(f => (
                      <FieldRow
                        key={f.id}
                        field={f}
                        selected={selectedFieldId === f.id}
                        onSelect={() => setSelectedFieldId(f.id)}
                        onCollapse={() => setSelectedFieldId(null)}
                        onUpdate={updates => updateField(f.id, updates)}
                        onRemove={() => removeField(f.id)}
                        deleteConfirm={deleteConfirmId === f.id}
                        onAskDelete={() => setDeleteConfirmId(f.id)}
                        onConfirmDelete={() => { removeField(f.id); setDeleteConfirmId(null); }}
                        onCancelDelete={() => setDeleteConfirmId(null)}
                      />
                    ))
                  )}

                  {!selForm && fields.length === 0 && (
                    <div style={{ padding: 12, borderRadius: 10, border: '1.5px dashed var(--line-2)', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>
                      Click a field on the left to start a new form
                    </div>
                  )}
                </div>
              </Panel>

              {/* Right: live preview */}
              <Panel title="Live preview">
                <div style={{ borderRadius: 18, border: '6px solid var(--ink)', overflow: 'hidden', background: 'var(--bg)' }}>
                  <div style={{ padding: 16, minHeight: 280 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{canvasFormName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>~60 seconds</div>
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {fields.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--faint)' }}>Add a field to preview it here.</div>
                      ) : fields.map(f => (
                        <div key={f.id}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: f.label ? 'var(--ink)' : 'var(--faint)' }}>
                            {f.label || 'Question'}{f.required && <span style={{ color: '#c0392b' }}> *</span>}
                          </div>
                          {renderPreviewControl(f)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            {/* Audience targeting */}
            <Panel
              title="Audience"
              action={<button onClick={saveAudience} disabled={!selForm || savingAudience} className="btn btn-ghost btn-sm">{savingAudience ? 'Saving…' : 'Save audience'}</button>}
            >
              {!selForm && (
                <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 12 }}>Select a form above to configure who can see it.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {AUDIENCE_TYPES.map(opt => {
                  const sel = audience.type === opt.key;
                  return (
                    <div key={opt.key}>
                      <button onClick={() => setAudience(defaultAudience(opt.key))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, background: sel ? 'var(--navy-tint)' : 'var(--surface)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', border: sel ? '6px solid var(--navy)' : '2px solid var(--line-2)', background: '#fff' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{opt.label}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{opt.desc}</div>
                        </div>
                      </button>

                      {sel && opt.key === 'pillar' && audience.type === 'pillar' && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, marginLeft: 32 }}>
                          {PILLAR_OPTIONS.map(p => {
                            const checked = audience.pillars.includes(p.key);
                            return (
                              <button key={p.key} onClick={() => togglePillar(p.key)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: checked ? 'var(--navy)' : 'var(--surface)', color: checked ? '#fff' : 'var(--ink)', border: checked ? '1px solid var(--navy)' : '1px solid var(--line-2)' }}>
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {sel && opt.key === 'life_stage' && audience.type === 'life_stage' && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, marginLeft: 32 }}>
                          {LIFE_STAGE_OPTIONS.map(s => {
                            const checked = audience.stages.includes(s.key);
                            return (
                              <button key={s.key} onClick={() => toggleStage(s.key)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: checked ? 'var(--navy)' : 'var(--surface)', color: checked ? '#fff' : 'var(--ink)', border: checked ? '1px solid var(--navy)' : '1px solid var(--line-2)' }}>
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {sel && opt.key === 'cell' && audience.type === 'cell' && (
                        <select
                          className="input"
                          style={{ marginTop: 8, marginLeft: 32, maxWidth: 280 }}
                          value={audience.cell_id}
                          onChange={e => setAudience({ type: 'cell', cell_id: e.target.value })}
                        >
                          <option value="">Select a cell…</option>
                          {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}

                      {sel && opt.key === 'specific' && audience.type === 'specific' && (
                        <div style={{ marginTop: 8, marginLeft: 32, maxWidth: 360 }}>
                          <TextInput value={memberSearch} onChange={setMemberSearch} placeholder="Search members by name…" />
                          {filteredMembers.length > 0 && (
                            <div style={{ marginTop: 6, border: '1px solid var(--line-2)', borderRadius: 9, overflow: 'hidden' }}>
                              {filteredMembers.map(m => (
                                <div key={m.id} onClick={() => addSpecificMember(m.id)} style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                                  {m.name}
                                </div>
                              ))}
                            </div>
                          )}
                          {audience.member_ids.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                              {audience.member_ids.map(id => {
                                const m = allMembers.find(x => x.id === id);
                                return (
                                  <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--navy)', color: '#fff' }}>
                                    {m?.name ?? id}
                                    <button onClick={() => removeSpecificMember(id)} style={{ color: '#fff', background: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}><Icon name="x" size={13} /></button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}

        {/* Responses view */}
        {view === 'responses' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <select
                className="input"
                style={{ maxWidth: 280 }}
                value={selForm?.id ?? ''}
                onChange={e => { const f = forms.find(x => x.id === e.target.value); if (f) openForm(f); }}
              >
                <option value="">Select a form…</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
              {selForm && (
                <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>
                  {responses.length} / {targetCount} responded
                </span>
              )}
            </div>

            {!selForm ? (
              <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Select a form above to see its responses.</div>
            ) : (
              <Panel
                title="Responses"
                action={<button onClick={exportCsv} className="btn btn-ghost btn-sm"><Icon name="download" size={15} /> Export CSV</button>}
                pad={false}
              >
                <THead cols={['Member', 'Submitted', 'Answers summary']} template="1.2fr .9fr 1.9fr" />
                {responses.length === 0 ? (
                  <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: 13 }}>No responses yet.</div>
                ) : responses.map(r => {
                  const membersArr = Array.isArray(r.members) ? r.members : r.members ? [r.members] : [];
                  const name = membersArr[0]?.name ?? r.member_id;
                  const firstField = fields[0];
                  const firstVal = firstField ? String(r.data?.[firstField.id] ?? '') : '';
                  const summary = firstVal.length > 50 ? `${firstVal.slice(0, 50)}…` : firstVal;
                  const expanded = expandedId === r.id;
                  return (
                    <div key={r.id}>
                      <TRow template="1.2fr .9fr 1.9fr" onClick={() => setExpandedId(expanded ? null : r.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar name={name} size={26} tone="grey" />
                          <span style={{ fontWeight: 600 }}>{name}</span>
                        </div>
                        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{relativeDate(r.submitted_at)}</span>
                        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{summary || '—'}</span>
                      </TRow>
                      {expanded && (
                        <div style={{ padding: '10px 16px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                          {fields.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No fields recorded for this form.</div>
                          ) : fields.map(f => (
                            <div key={f.id} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 12.5 }}>
                              <span style={{ fontWeight: 700, minWidth: 140, color: 'var(--ink-2)' }}>{f.label}</span>
                              <span style={{ color: 'var(--muted)' }}>{String(r.data?.[f.id] ?? '—')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Panel>
            )}
          </>
        )}

        {/* Import view */}
        {view === 'import' && (
          <Panel title="Import from Google Forms / Sheet">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', marginBottom: 16 }}>
              <Icon name="link" size={18} color="var(--navy)" />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>docs.google.com/forms/d/SODE-pulse-2026</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--navy)' }}>Connected</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>Map columns → fields</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[['Timestamp', 'Submitted at'], ['How likely…', 'NPS 0–10'], ['Email Address', 'Member (match)'], ['Comments', 'Long text']].map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, background: 'var(--surface)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m[0]}</span>
                  <Icon name="arrowupright" size={16} color="var(--faint)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m[1]}</span>
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px', borderRadius: 12, border: '2px dashed var(--line-2)', background: 'var(--surface)', cursor: 'pointer', marginBottom: 12 }}>
              <Icon name="download" size={18} color="var(--muted)" />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Upload CSV to import</span>
              <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            {importMsg && (
              <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--navy-tint)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600, marginBottom: 12 }}>
                <Icon name="check" size={14} /> {importMsg}
              </div>
            )}
            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }}>Import 248 responses</button>
          </Panel>
        )}
      </AdminBody>
    </>
  );
}
