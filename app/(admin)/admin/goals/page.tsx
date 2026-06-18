'use client';
import { useState, useEffect, useCallback } from 'react';
import { Icon, pillarOf } from '@/components/sode/icons';
import { Avatar, ProgressBar } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, CyclePill, Panel, AdminSearch, THead, TRow } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';
import { PILLAR_OPTIONS, LIFE_STAGE_OPTIONS, type FormAudience, summarizeAudience } from '@/lib/forms-audience';

const PILLARS = ['spiritual', 'career', 'business', 'character'] as const;
type Pillar = typeof PILLARS[number];

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberGoal {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  pillar: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminGoalStep {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  goal_updates: {
    id: string;
    comment: string;
    progress_value: number | null;
    created_at: string;
  }[];
}

interface CommunityGoal {
  id: string;
  title: string;
  notes: string | null;
  pillar: string;
  target: number;
  unit: string;
  due_date: string | null;
  is_published: boolean;
  is_mandatory: boolean;
  audience: FormAudience | null;
  published_at: string | null;
  created_at: string;
  assigned_count?: number;
  completed_count?: number;
}

interface CommunityGoalStep {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
}

interface MemberProgress {
  member_id: string;
  member_name: string;
  member_email: string;
  current_value: number;
  is_completed: boolean;
  completed_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  ontrack:  { label: 'On track', bg: '#d1fae5', color: '#065f46' },
  atrisk:   { label: 'At risk',  bg: '#fef3c7', color: '#92400e' },
  behind:   { label: 'Behind',   bg: '#fee2e2', color: '#c53030' },
  done:     { label: '✓ Done',   bg: 'var(--navy)', color: '#fff' },
  archived: { label: 'Archived', bg: 'var(--surface-2)', color: 'var(--muted)' },
};

const PILLAR_COLORS: Record<string, string> = {
  spiritual: '#7c3aed',
  career:    '#2563eb',
  business:  '#16a34a',
  character: '#ea580c',
};

const GRID = '180px 1fr 110px 150px 100px 70px 80px';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isOverdue(due: string | null, status: string): boolean {
  if (!due || status === 'done' || status === 'archived') return false;
  return new Date(due) < new Date();
}

function goalProgress(g: MemberGoal): number {
  if (!g.target || g.target === 0) {
    if (g.status === 'done')    return 1;
    if (g.status === 'ontrack') return 0.5;
    if (g.status === 'atrisk')  return 0.3;
    return 0.1;
  }
  return Math.min(g.current / g.target, 1);
}

// ── Audience Picker ───────────────────────────────────────────────────────────

function AudiencePicker({ value, onChange }: { value: FormAudience; onChange: (a: FormAudience) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {([
          { key: 'everyone',   label: 'Everyone' },
          { key: 'pillar',     label: 'By pillar' },
          { key: 'life_stage', label: 'By life stage' },
          { key: 'specific',   label: 'Specific members' },
        ] as const).map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              if (o.key === 'everyone')   onChange({ type: 'everyone' });
              if (o.key === 'pillar')     onChange({ type: 'pillar', pillars: [] });
              if (o.key === 'life_stage') onChange({ type: 'life_stage', stages: [] });
              if (o.key === 'specific')   onChange({ type: 'specific', member_ids: [] });
            }}
            style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: value.type === o.key ? 'var(--navy)' : 'var(--surface)', color: value.type === o.key ? '#fff' : 'var(--ink)', border: value.type === o.key ? 'none' : '1px solid var(--line-2)' }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.type === 'pillar' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PILLAR_OPTIONS.map(o => {
            const sel = value.pillars.includes(o.key);
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onChange({ type: 'pillar', pillars: sel ? value.pillars.filter(p => p !== o.key) : [...value.pillars, o.key] })}
                style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: sel ? `${PILLAR_COLORS[o.key]}20` : 'var(--surface)', color: sel ? PILLAR_COLORS[o.key] : 'var(--muted)', border: sel ? `1px solid ${PILLAR_COLORS[o.key]}` : '1px solid var(--line-2)' }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {value.type === 'life_stage' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LIFE_STAGE_OPTIONS.map(o => {
            const sel = value.stages.includes(o.key);
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onChange({ type: 'life_stage', stages: sel ? value.stages.filter(s => s !== o.key) : [...value.stages, o.key] })}
                style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: sel ? 'var(--navy-tint)' : 'var(--surface)', color: sel ? 'var(--navy)' : 'var(--muted)', border: sel ? '1.5px solid var(--navy)' : '1px solid var(--line-2)' }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {value.type === 'specific' && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
          Specific member targeting is managed after publishing via the progress drawer.
        </div>
      )}
    </div>
  );
}

// ── Community Goal Modal ──────────────────────────────────────────────────────

function CommunityGoalModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: CommunityGoal | null;
  onClose: () => void;
  onSaved: (g: CommunityGoal) => void;
}) {
  const isEdit = !!goal;
  const [title, setTitle]           = useState(goal?.title ?? '');
  const [description, setDesc]      = useState(goal?.notes ?? '');
  const [pillar, setPillar]         = useState<string>(goal?.pillar ?? 'spiritual');
  const [target, setTarget]         = useState<number>(goal?.target ?? 10);
  const [unit, setUnit]             = useState(goal?.unit ?? 'steps');
  const [dueDate, setDueDate]       = useState(goal?.due_date ?? '');
  const [mandatory, setMandatory]   = useState(goal?.is_mandatory ?? false);
  const [audience, setAudience]     = useState<FormAudience>(goal?.audience ?? { type: 'everyone' });
  const [steps, setSteps]           = useState<CommunityGoalStep[]>([]);
  const [newStep, setNewStep]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (goal?.id) {
      createClient()
        .from('goal_steps')
        .select('id,title,description,order_index')
        .eq('goal_id', goal.id)
        .order('order_index')
        .then(({ data }) => setSteps((data ?? []) as CommunityGoalStep[]));
    }
  }, [goal?.id]);

  const addStep = () => {
    if (!newStep.trim()) return;
    setSteps(ss => [...ss, { id: `new-${Date.now()}`, title: newStep.trim(), description: null, order_index: ss.length }]);
    setNewStep('');
  };

  const removeStep = (idx: number) => setSteps(ss => ss.filter((_, i) => i !== idx));

  const save = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    const supabase = createClient();

    const payload = {
      title: title.trim(),
      notes: description.trim() || null,
      pillar,
      target,
      unit: unit.trim(),
      due_date: dueDate || null,
      is_mandatory: mandatory,
      audience: audience as unknown as Record<string, unknown>,
      goal_type: 'community',
    };

    let goalId = goal?.id ?? '';

    if (isEdit) {
      const { error: err } = await supabase.from('goals').update(payload).eq('id', goalId);
      if (err) {
        console.error('Community goal UPDATE error:', JSON.stringify(err, null, 2));
        setError(`Could not save: ${err.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { data, error: err } = await supabase.from('goals').insert({
        ...payload,
        member_id: null,
        current: 0,
        status: 'ontrack',
        is_published: false,
      }).select('id').single();
      if (err || !data) {
        console.error('Community goal INSERT error:', JSON.stringify(err, null, 2));
        setError(`Could not create: ${err?.message ?? 'unknown error'}`);
        setSaving(false);
        return;
      }
      goalId = data.id;
    }

    // Sync steps: delete existing, insert all (simple approach for edit)
    if (isEdit) {
      await supabase.from('goal_steps').delete().eq('goal_id', goalId);
    }
    const newSteps = steps.filter(s => s.title.trim());
    if (newSteps.length > 0) {
      await supabase.from('goal_steps').insert(
        newSteps.map((s, i) => ({ goal_id: goalId, title: s.title, description: s.description, order_index: i }))
      );
    }

    onSaved({
      id: goalId,
      title: title.trim(),
      notes: description.trim() || null,
      pillar,
      target,
      unit: unit.trim(),
      due_date: dueDate || null,
      is_published: goal?.is_published ?? false,
      is_mandatory: mandatory,
      audience,
      published_at: goal?.published_at ?? null,
      created_at: goal?.created_at ?? new Date().toISOString(),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90dvh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{isEdit ? 'Edit community goal' : 'New community goal'}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ padding: '10px 12px', background: '#fee2e2', borderRadius: 8, color: '#c53030', fontSize: 13 }}>{error}</div>}

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Title *</div>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Read one chapter a day" style={{ width: '100%', height: 40, borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Description</div>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Optional context for members…" style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '8px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Pillar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {PILLARS.map(pl => {
                const pm  = pillarOf(pl);
                const sel = pillar === pl;
                return (
                  <button key={pl} type="button" onClick={() => setPillar(pl)} style={{ padding: '9px 6px', borderRadius: 8, background: sel ? `${PILLAR_COLORS[pl]}18` : 'var(--surface)', border: sel ? `1.5px solid ${PILLAR_COLORS[pl]}` : '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <Icon name={pm.icon} size={16} stroke={2.1} color={sel ? PILLAR_COLORS[pl] : 'var(--muted)'} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: sel ? PILLAR_COLORS[pl] : 'var(--muted)', textTransform: 'capitalize' }}>{pl}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Target</div>
              <input type="number" value={target} min={1} onChange={e => setTarget(Number(e.target.value))} style={{ width: '100%', height: 40, borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Unit</div>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="days, books…" style={{ width: '100%', height: 40, borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 5 }}>Deadline</div>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', height: 40, borderRadius: 8, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Audience</div>
            <AudiencePicker value={audience} onChange={setAudience} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Pre-set steps (optional)</div>
            {steps.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 13 }}>{s.title}</div>
                <button type="button" onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Icon name="x" size={14} color="var(--muted)" />
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newStep}
                onChange={e => setNewStep(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStep()}
                placeholder="Add a step and press Enter"
                style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--surface)', fontSize: 13, padding: '0 10px', outline: 'none' }}
              />
              <button type="button" onClick={addStep} className="btn btn-ghost btn-sm">Add</button>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)' }}>
            <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--navy)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Mandatory goal</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>All matched members must complete this goal</div>
            </div>
          </label>

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-block">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-block">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create goal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [activeTab, setActiveTab]   = useState<'member' | 'community'>('member');
  const [activePillar, setActivePillar] = useState<Pillar>('spiritual');

  // Member goals state
  const [memberGoals, setMemberGoals]       = useState<MemberGoal[]>([]);
  const [goalsLoading, setGoalsLoading]     = useState(true);
  const [search, setSearch]                 = useState('');
  const [pillarFilter, setPillarFilter]     = useState<string>('all');
  const [statusFilter, setStatusFilter]     = useState<string>('all');
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null);
  const [drawerFilter, setDrawerFilter]     = useState<string>('all');

  // Two-level drawer
  const [selectedDrawerGoal, setSelectedDrawerGoal]         = useState<MemberGoal | null>(null);
  const [drawerGoalSteps, setDrawerGoalSteps]               = useState<AdminGoalStep[]>([]);
  const [drawerGoalStepsLoading, setDrawerGoalStepsLoading] = useState(false);
  const [confirmGoalAction, setConfirmGoalAction]           = useState<{ type: 'delete' | 'archive'; goal: MemberGoal } | null>(null);

  // Community goals state
  const [communityGoals, setCommunityGoals]       = useState<CommunityGoal[]>([]);
  const [communityLoading, setCommunityLoading]   = useState(true);
  const [communitySearch, setCommunitySearch]     = useState('');
  const [communityPillar, setCommunityPillar]     = useState<string>('all');
  const [showModal, setShowModal]                 = useState(false);
  const [editingGoal, setEditingGoal]             = useState<CommunityGoal | null>(null);
  const [progressDrawerGoal, setProgressDrawerGoal] = useState<CommunityGoal | null>(null);
  const [memberProgress, setMemberProgress]       = useState<MemberProgress[]>([]);
  const [progressLoading, setProgressLoading]     = useState(false);
  const [publishingId, setPublishingId]           = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('goals')
      .select(`
        id, member_id, pillar, title, current, target, unit,
        due_date, status, notes, created_at, updated_at,
        members!inner(id, name, email)
      `)
      .eq('is_template', false)
      .eq('goal_type', 'personal')
      .order('updated_at', { ascending: false, nullsFirst: false });

    if (error) console.error('[Goals] fetch error:', error);

    const rows = ((data ?? []) as unknown as Array<MemberGoal & { members: { id: string; name: string; email: string } }>).map(r => ({
      ...r,
      member_name:  r.members?.name  ?? 'Unknown',
      member_email: r.members?.email ?? '',
    }));
    setMemberGoals(rows);
    setGoalsLoading(false);
  }, []);

  const fetchCommunityGoals = useCallback(async () => {
    setCommunityLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('goals')
      .select('id, title, notes, pillar, target, unit, due_date, is_published, is_mandatory, audience, published_at, created_at')
      .eq('goal_type', 'community')
      .order('created_at', { ascending: false });

    if (error) console.error('[CommunityGoals] fetch error:', error);
    const goals = (data ?? []) as CommunityGoal[];

    // Enrich with assignment counts
    const enriched = await Promise.all(goals.map(async g => {
      const { count: assigned } = await supabase
        .from('member_community_goals')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', g.id);
      const { count: completed } = await supabase
        .from('member_community_goals')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', g.id)
        .eq('is_completed', true);
      return { ...g, audience: g.audience as FormAudience | null, assigned_count: assigned ?? 0, completed_count: completed ?? 0 };
    }));

    setCommunityGoals(enriched);
    setCommunityLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
    const supabase = createClient();
    const ch = supabase.channel('pillar-goals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => {
        fetchGoals();
        fetchCommunityGoals();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchGoals, fetchCommunityGoals]);

  useEffect(() => { fetchCommunityGoals(); }, [fetchCommunityGoals]);

  const loadDrawerGoalSteps = async (goalId: string) => {
    setDrawerGoalStepsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('goal_steps')
      .select('id, title, description, order_index, is_completed, goal_updates(id, comment, progress_value, created_at)')
      .eq('goal_id', goalId)
      .order('order_index');
    setDrawerGoalSteps((data ?? []) as AdminGoalStep[]);
    setDrawerGoalStepsLoading(false);
  };

  const selectDrawerGoal = (goal: MemberGoal) => {
    setSelectedDrawerGoal(goal);
    loadDrawerGoalSteps(goal.id);
  };

  const deleteGoal = async (goal: MemberGoal) => {
    const supabase = createClient();
    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (!error) {
      const remaining = memberGoals.filter(g => g.member_id === goal.member_id && g.id !== goal.id);
      setMemberGoals(gs => gs.filter(g => g.id !== goal.id));
      if (selectedDrawerGoal?.id === goal.id) setSelectedDrawerGoal(null);
      if (remaining.length === 0) setDrawerMemberId(null);
    }
    setConfirmGoalAction(null);
  };

  const archiveGoal = async (goal: MemberGoal) => {
    const supabase = createClient();
    const { error } = await supabase.from('goals').update({ status: 'archived' }).eq('id', goal.id);
    if (!error) {
      setMemberGoals(gs => gs.map(g => g.id === goal.id ? { ...g, status: 'archived' } : g));
      if (selectedDrawerGoal?.id === goal.id) setSelectedDrawerGoal(null);
    }
    setConfirmGoalAction(null);
  };

  const publishGoal = async (goal: CommunityGoal) => {
    setPublishingId(goal.id);
    try {
      const res = await fetch('/api/community-goals/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: goal.id }),
      });
      const json = await res.json() as { ok?: boolean; assigned?: number; error?: string };
      console.log('[publishGoal] response:', res.status, json);
      if (!res.ok || !json.ok) {
        alert(`Publish failed: ${json.error ?? 'Unknown error (check browser console)'}`);
      } else {
        setCommunityGoals(gs => gs.map(g => g.id === goal.id ? { ...g, is_published: true, assigned_count: json.assigned ?? 0 } : g));
      }
    } catch (err) {
      console.error('[publishGoal] network error:', err);
      alert('Publish failed — network error. Check browser console.');
    }
    setPublishingId(null);
  };

  const deleteCommunityGoal = async (id: string) => {
    const supabase = createClient();
    await supabase.from('goals').delete().eq('id', id);
    setCommunityGoals(gs => gs.filter(g => g.id !== id));
    if (progressDrawerGoal?.id === id) setProgressDrawerGoal(null);
  };

  const openProgressDrawer = async (goal: CommunityGoal) => {
    setProgressDrawerGoal(goal);
    setProgressLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('member_community_goals')
      .select('member_id, current_value, is_completed, completed_at, members(name, email)')
      .eq('goal_id', goal.id);

    const rows = ((data ?? []) as unknown as Array<{
      member_id: string;
      current_value: number;
      is_completed: boolean;
      completed_at: string | null;
      members: { name: string; email: string } | null;
    }>).map(r => ({
      member_id:    r.member_id,
      member_name:  r.members?.name  ?? 'Unknown',
      member_email: r.members?.email ?? '',
      current_value: r.current_value,
      is_completed:  r.is_completed,
      completed_at:  r.completed_at,
    }));
    setMemberProgress(rows);
    setProgressLoading(false);
  };

  // Per-pillar live stats
  const pillarStats = PILLARS.map(pl => {
    const g = memberGoals.filter(g => g.pillar === pl && g.status !== 'archived');
    return {
      pillar:  pl,
      total:   g.length,
      ontrack: g.filter(g => g.status === 'ontrack').length,
      atrisk:  g.filter(g => g.status === 'atrisk').length,
      done:    g.filter(g => g.status === 'done').length,
      overdue: g.filter(g => isOverdue(g.due_date, g.status)).length,
    };
  });

  const filteredGoals = memberGoals.filter(g => {
    if (pillarFilter !== 'all' && g.pillar !== pillarFilter) return false;
    if (statusFilter !== 'all' && g.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!g.member_name.toLowerCase().includes(q) && !g.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const drawerGoals = memberGoals.filter(g => g.member_id === drawerMemberId);
  const drawerMember = drawerGoals[0];

  const filteredDrawerGoals = drawerGoals.filter(g => {
    if (drawerFilter === 'active')    return g.status !== 'done' && g.status !== 'archived' && !isOverdue(g.due_date, g.status);
    if (drawerFilter === 'completed') return g.status === 'done';
    if (drawerFilter === 'overdue')   return isOverdue(g.due_date, g.status);
    if (drawerFilter === 'archived')  return g.status === 'archived';
    return g.status !== 'archived';
  });

  const drawerStats = {
    ontrack:   drawerGoals.filter(g => g.status === 'ontrack').length,
    atrisk:    drawerGoals.filter(g => g.status === 'atrisk').length,
    completed: drawerGoals.filter(g => g.status === 'done').length,
    overdue:   drawerGoals.filter(g => isOverdue(g.due_date, g.status)).length,
  };

  const filteredCommunity = communityGoals.filter(g => {
    if (communityPillar !== 'all' && g.pillar !== communityPillar) return false;
    if (communitySearch) {
      const q = communitySearch.toLowerCase();
      if (!g.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <AdminTopbar
        title="Pillar Goals"
        subtitle="Member goals tracked by pillar"
        actions={<CyclePill label="Month 4 of 12" />}
      />
      <AdminBody>
        {/* ── Tab switcher ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--line)' }}>
          {([
            { key: 'member',    label: 'Member Goals' },
            { key: 'community', label: 'Community Goals' },
          ] as const).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === t.key ? '2.5px solid var(--navy)' : '2.5px solid transparent', fontSize: 14, fontWeight: activeTab === t.key ? 800 : 600, color: activeTab === t.key ? 'var(--navy)' : 'var(--muted)', cursor: 'pointer', marginBottom: -1 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ MEMBER GOALS TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'member' && (
          <>
            {/* Pillar summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
              {pillarStats.map(ps => {
                const pm = pillarOf(ps.pillar as Pillar);
                const isActive = activePillar === ps.pillar;
                return (
                  <button
                    key={ps.pillar}
                    type="button"
                    onClick={() => { setActivePillar(ps.pillar as Pillar); setPillarFilter(ps.pillar); }}
                    className="card card-pad"
                    style={{ textAlign: 'left', cursor: 'pointer', border: isActive ? `2px solid ${pm.color}` : '2px solid transparent', outline: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PILLAR_COLORS[ps.pillar]}18`, color: pm.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name={pm.icon} size={18} stroke={2.1} />
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{pm.name}</div>
                    </div>
                    {goalsLoading ? (
                      <div style={{ height: 36, background: 'var(--surface-2)', borderRadius: 6 }} />
                    ) : ps.total === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--faint)' }}>No goals yet</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div>
                          <div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{ps.total}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>goals</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                          {ps.ontrack > 0 && <span style={{ fontSize: 11, color: '#065f46' }}>✓ {ps.ontrack} on track</span>}
                          {ps.atrisk  > 0 && <span style={{ fontSize: 11, color: '#92400e' }}>⚠ {ps.atrisk} at risk</span>}
                          {ps.overdue > 0 && <span style={{ fontSize: 11, color: '#c53030' }}>! {ps.overdue} overdue</span>}
                          {ps.done    > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ps.done} done</span>}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Member Goals table */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Member Goals</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {goalsLoading ? 'Loading…' : `${filteredGoals.length} goal${filteredGoals.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <button
                onClick={() => {
                  const csv = [
                    ['Member', 'Goal', 'Pillar', 'Status', 'Progress', 'Due', 'Updated'].join(','),
                    ...filteredGoals.map(g => [
                      `"${g.member_name}"`, `"${g.title}"`, g.pillar, g.status,
                      `${g.current}/${g.target} ${g.unit}`, g.due_date ?? '', g.updated_at,
                    ].join(',')),
                  ].join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  a.download = 'member-goals.csv';
                  a.click();
                }}
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="download" size={14} /> Export CSV
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <AdminSearch value={search} onChange={setSearch} placeholder="Search by member name or goal" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['all', ...PILLARS] as const).map(f => (
                  <FilterChip key={f} active={pillarFilter === f} label={f === 'all' ? 'All pillars' : f.charAt(0).toUpperCase() + f.slice(1)} onClick={() => setPillarFilter(f)} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { key: 'all',      label: 'All status' },
                  { key: 'ontrack',  label: 'On track' },
                  { key: 'atrisk',   label: 'At risk' },
                  { key: 'behind',   label: 'Behind' },
                  { key: 'done',     label: 'Done' },
                  { key: 'archived', label: 'Archived' },
                ] as const).map(f => (
                  <FilterChip key={f.key} active={statusFilter === f.key} label={f.label} onClick={() => setStatusFilter(f.key)} />
                ))}
              </div>
            </div>

            <Panel pad={false}>
              {goalsLoading ? (
                <div style={{ padding: '28px 20px', color: 'var(--muted)', fontSize: 13 }}>Loading member goals…</div>
              ) : filteredGoals.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Icon name="target" size={20} color="var(--faint)" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                    {memberGoals.length === 0 ? 'No member goals yet' : 'No goals match this filter'}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {memberGoals.length === 0
                      ? 'Members create goals from their home page. Goals will appear here once set.'
                      : 'Try a different search or filter.'}
                  </p>
                </div>
              ) : (
                <>
                  <THead cols={['Member', 'Goal', 'Pillar', 'Progress', 'Status', 'Due', 'Updated']} template={GRID} />
                  {filteredGoals.map(g => {
                    const sc      = STATUS_CONFIG[g.status] ?? STATUS_CONFIG.ontrack;
                    const pct     = goalProgress(g);
                    const pc      = PILLAR_COLORS[g.pillar] ?? 'var(--navy)';
                    const overdue = isOverdue(g.due_date, g.status);
                    return (
                      <TRow key={g.id} template={GRID}>
                        <button
                          type="button"
                          onClick={() => { setDrawerMemberId(g.member_id); setDrawerFilter('all'); setSelectedDrawerGoal(null); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        >
                          <Avatar name={g.member_name} size={28} tone="navy" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{g.member_name}</span>
                        </button>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                          {g.notes && <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.notes}</div>}
                        </div>
                        <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: `${pc}18`, color: pc, fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize', width: 'fit-content' }}>
                          {g.pillar}
                        </span>
                        <div>
                          <ProgressBar value={pct} color="var(--navy)" height={5} />
                          <div className="tnum" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{g.current} / {g.target} {g.unit}</div>
                        </div>
                        <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 99, background: sc.bg, color: sc.color, fontSize: 11.5, fontWeight: 700, width: 'fit-content' }}>
                          {sc.label}
                        </span>
                        <span style={{ fontSize: 12.5, color: overdue ? '#c53030' : 'var(--muted)', fontWeight: overdue ? 700 : 400 }}>
                          {overdue ? 'Overdue' : fmtDate(g.due_date)}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--faint)' }}>{relativeTime(g.updated_at)}</span>
                      </TRow>
                    );
                  })}
                </>
              )}
            </Panel>
          </>
        )}

        {/* ══ COMMUNITY GOALS TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'community' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Community Goals</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {communityLoading ? 'Loading…' : `${filteredCommunity.length} goal${filteredCommunity.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setEditingGoal(null); setShowModal(true); }}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="plus" size={15} stroke={2.5} color="#fff" /> New goal
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <AdminSearch value={communitySearch} onChange={setCommunitySearch} placeholder="Search community goals" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['all', ...PILLARS] as const).map(f => (
                  <FilterChip key={f} active={communityPillar === f} label={f === 'all' ? 'All pillars' : f.charAt(0).toUpperCase() + f.slice(1)} onClick={() => setCommunityPillar(f)} />
                ))}
              </div>
            </div>

            {communityLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 88, borderRadius: 12, background: 'var(--surface-2)' }} />)}
              </div>
            ) : filteredCommunity.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Icon name="globe" size={20} color="var(--faint)" />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>No community goals yet</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Create a goal and assign it to members across the community.</p>
                <button type="button" onClick={() => { setEditingGoal(null); setShowModal(true); }} className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                  Create first goal
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredCommunity.map(g => {
                  const pc        = PILLAR_COLORS[g.pillar] ?? 'var(--navy)';
                  const overdue   = isOverdue(g.due_date, 'ontrack');
                  const completePct = g.assigned_count ? (g.completed_count ?? 0) / g.assigned_count : 0;
                  return (
                    <div key={g.id} className="card card-pad" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      {/* Left: pillar dot */}
                      <div style={{ width: 6, flex: 'none', alignSelf: 'stretch', borderRadius: 3, background: pc, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: `${pc}18`, color: pc, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{g.pillar}</span>
                          {g.is_mandatory && <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#c53030', fontSize: 11, fontWeight: 700 }}>Mandatory</span>}
                          {g.is_published
                            ? <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 700 }}>Published</span>
                            : <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>Draft</span>
                          }
                          {overdue && <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#c53030', fontSize: 11, fontWeight: 700 }}>Overdue</span>}
                        </div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.3, marginBottom: 5 }}>{g.title}</div>
                        {g.notes && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 7, lineHeight: 1.4 }}>{g.notes}</div>}
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--faint)', flexWrap: 'wrap' }}>
                          <span>{summarizeAudience(g.audience)}</span>
                          {g.due_date && <span>Due {fmtDate(g.due_date)}</span>}
                          {g.assigned_count !== undefined && g.assigned_count > 0 && (
                            <span>{g.completed_count}/{g.assigned_count} completed</span>
                          )}
                        </div>
                        {g.is_published && g.assigned_count !== undefined && g.assigned_count > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <ProgressBar value={completePct} color={pc} height={4} />
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flex: 'none', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {!g.is_published && (
                          <button
                            type="button"
                            onClick={() => publishGoal(g)}
                            disabled={publishingId === g.id}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <Icon name="globe" size={13} color="#fff" />
                            {publishingId === g.id ? 'Publishing…' : 'Publish'}
                          </button>
                        )}
                        {g.is_published && (
                          <button
                            type="button"
                            onClick={() => openProgressDrawer(g)}
                            className="btn btn-ghost btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <Icon name="users" size={13} /> Progress
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setEditingGoal(g); setShowModal(true); }}
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Icon name="pencil" size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCommunityGoal(g.id)}
                          className="btn btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#c53030', border: '1px solid #fca5a5', borderRadius: 8 }}
                        >
                          <Icon name="trash" size={13} color="#c53030" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </AdminBody>

      {/* ── Member drawer ─────────────────────────────────────────────────────── */}
      {drawerMemberId && drawerMember && (
        <>
          <div onClick={() => { setDrawerMemberId(null); setSelectedDrawerGoal(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 40 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
            background: 'var(--surface)', zIndex: 50,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
          }}>
            {/* Drawer header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={drawerMember.member_name} size={42} tone="navy" />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{drawerMember.member_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{drawerMember.member_email}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{drawerGoals.filter(g => g.status !== 'archived').length} active goal{drawerGoals.filter(g => g.status !== 'archived').length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <button type="button" onClick={() => { setDrawerMemberId(null); setSelectedDrawerGoal(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                  <Icon name="x" size={18} />
                </button>
              </div>
              {!selectedDrawerGoal && (
                <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                  {([
                    { key: 'all',       label: 'All' },
                    { key: 'active',    label: 'Active' },
                    { key: 'completed', label: 'Done' },
                    { key: 'overdue',   label: 'Overdue' },
                    { key: 'archived',  label: 'Archived' },
                  ] as const).map(f => (
                    <FilterChip key={f.key} active={drawerFilter === f.key} label={f.label} onClick={() => setDrawerFilter(f.key)} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Level 1: Goals list ── */}
            {!selectedDrawerGoal && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {filteredDrawerGoals.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No goals in this filter.</div>
                ) : filteredDrawerGoals.map(g => {
                  const sc      = STATUS_CONFIG[g.status] ?? STATUS_CONFIG.ontrack;
                  const pct     = goalProgress(g);
                  const pc      = PILLAR_COLORS[g.pillar] ?? 'var(--navy)';
                  const overdue = isOverdue(g.due_date, g.status);
                  return (
                    <div key={g.id} className="card card-pad" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => selectDrawerGoal(g)}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: `${pc}18`, color: pc, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{g.pillar}</span>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                        {overdue && <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#c53030', fontSize: 11, fontWeight: 700 }}>Overdue</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{g.title}</div>
                        <Icon name="chevronright" size={16} color="var(--faint)" />
                      </div>
                      {g.notes && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>{g.notes}</div>}
                      <div style={{ marginTop: 10 }}>
                        <ProgressBar value={pct} color="var(--navy)" height={5} />
                        <div className="tnum" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{g.current} / {g.target} {g.unit}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11.5, color: 'var(--faint)' }}>
                        <span>{g.due_date ? `Due ${fmtDate(g.due_date)}` : 'No due date'}</span>
                        <span>Updated {relativeTime(g.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Level 2: Goal steps ── */}
            {selectedDrawerGoal && (() => {
              const g  = selectedDrawerGoal;
              const sc = STATUS_CONFIG[g.status] ?? STATUS_CONFIG.ontrack;
              const pc = PILLAR_COLORS[g.pillar] ?? 'var(--navy)';
              return (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDrawerGoal(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy)', fontWeight: 700, fontSize: 13, padding: '0 0 12px', marginBottom: 2 }}
                  >
                    <Icon name="arrowleft" size={15} color="var(--navy)" /> All goals
                  </button>

                  <div className="card card-pad" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: `${pc}18`, color: pc, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{g.pillar}</span>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 10 }}>{g.title}</div>
                    <ProgressBar value={goalProgress(g)} color="var(--navy)" height={5} />
                    <div className="tnum" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{g.current} / {g.target} {g.unit}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setConfirmGoalAction({ type: 'archive', goal: g }); }}
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      >
                        <Icon name="archive" size={13} color="var(--muted)" /> Archive
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setConfirmGoalAction({ type: 'delete', goal: g }); }}
                        className="btn btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#fee2e2', color: '#c53030', border: '1px solid #fca5a5', borderRadius: 8 }}
                      >
                        <Icon name="trash" size={13} color="#c53030" /> Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>Action steps</div>
                  {drawerGoalStepsLoading ? (
                    <div style={{ height: 60, borderRadius: 10, background: 'var(--surface-2)' }} />
                  ) : drawerGoalSteps.length === 0 ? (
                    <div style={{ padding: '16px', borderRadius: 10, border: '1px solid var(--line-2)', background: 'var(--surface)', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>No action steps for this goal.</div>
                    </div>
                  ) : (
                    drawerGoalSteps.map(step => (
                      <div key={step.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', borderRadius: 9, background: step.is_completed ? 'var(--surface)' : 'var(--bg)', border: '1px solid var(--line-2)' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${step.is_completed ? 'var(--navy)' : 'var(--line-2)'}`, background: step.is_completed ? 'var(--navy)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
                            {step.is_completed && <Icon name="check" size={9} stroke={3} color="#fff" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, textDecoration: step.is_completed ? 'line-through' : 'none', color: step.is_completed ? 'var(--muted)' : 'var(--ink)', lineHeight: 1.3 }}>{step.title}</div>
                            {step.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{step.description}</div>}
                          </div>
                        </div>
                        {step.goal_updates.length > 0 && (
                          <div style={{ marginLeft: 28, marginTop: 4 }}>
                            {[...step.goal_updates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(u => (
                              <div key={u.id} style={{ padding: '7px 10px', borderLeft: '2px solid var(--navy-tint)', marginBottom: 4 }}>
                                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>{u.comment}</div>
                                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })()}

            {/* Footer stats (Level 1 only) */}
            {!selectedDrawerGoal && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap', flex: 'none' }}>
                {[
                  { v: drawerStats.ontrack,   label: 'On track', color: '#065f46', bg: '#d1fae5' },
                  { v: drawerStats.atrisk,    label: 'At risk',  color: '#92400e', bg: '#fef3c7' },
                  { v: drawerStats.completed, label: 'Done',     color: 'var(--navy)', bg: 'var(--navy-tint)' },
                  { v: drawerStats.overdue,   label: 'Overdue',  color: '#c53030', bg: '#fee2e2' },
                ].map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 99, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
                    {s.v} {s.label}
                  </span>
                ))}
              </div>
            )}

            {/* ── Confirm overlay ── */}
            {confirmGoalAction && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', zIndex: 10, borderRadius: 0 }}>
                <div style={{ width: '100%', background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
                    {confirmGoalAction.type === 'delete' ? 'Delete this goal?' : 'Archive this goal?'}
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 9, marginBottom: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{confirmGoalAction.goal.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{confirmGoalAction.goal.member_name}</div>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 20 }}>
                    {confirmGoalAction.type === 'delete'
                      ? 'This will also delete all action steps and progress updates. This cannot be undone.'
                      : 'The goal will be archived. The member can view it in their Archived section.'}
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setConfirmGoalAction(null)} className="btn btn-ghost btn-block">Cancel</button>
                    <button
                      onClick={() => confirmGoalAction.type === 'delete' ? deleteGoal(confirmGoalAction.goal) : archiveGoal(confirmGoalAction.goal)}
                      className="btn btn-block"
                      style={{ background: confirmGoalAction.type === 'delete' ? '#c53030' : 'var(--muted)', color: '#fff', border: 'none', borderRadius: 10, height: 46, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                    >
                      {confirmGoalAction.type === 'delete' ? 'Delete goal' : 'Archive goal'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Community goal progress drawer ────────────────────────────────────── */}
      {progressDrawerGoal && (
        <>
          <div onClick={() => setProgressDrawerGoal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'var(--surface)', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.12)' }}>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Community Goal</div>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{progressDrawerGoal.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{progressDrawerGoal.assigned_count ?? 0} assigned</span>
                    <span style={{ fontSize: 12.5, color: '#065f46' }}>{progressDrawerGoal.completed_count ?? 0} completed</span>
                  </div>
                </div>
                <button type="button" onClick={() => setProgressDrawerGoal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                  <Icon name="x" size={18} />
                </button>
              </div>
              {progressDrawerGoal.assigned_count !== undefined && progressDrawerGoal.assigned_count > 0 && (
                <div style={{ marginTop: 14 }}>
                  <ProgressBar
                    value={(progressDrawerGoal.completed_count ?? 0) / progressDrawerGoal.assigned_count}
                    color={PILLAR_COLORS[progressDrawerGoal.pillar] ?? 'var(--navy)'}
                    height={6}
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                    {Math.round(((progressDrawerGoal.completed_count ?? 0) / progressDrawerGoal.assigned_count) * 100)}% completion rate
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {progressLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 56, borderRadius: 10, background: 'var(--surface-2)' }} />)}
                </div>
              ) : memberProgress.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No members assigned yet.</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Member progress</div>
                  {[...memberProgress].sort((a, b) => (b.current_value - a.current_value) || (b.is_completed ? 1 : -1)).map((mp, idx) => {
                    const pct = progressDrawerGoal.target > 0 ? Math.min(mp.current_value / progressDrawerGoal.target, 1) : 0;
                    return (
                      <div key={mp.member_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line-2)', marginBottom: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--faint)', width: 20, textAlign: 'right', flex: 'none' }}>#{idx + 1}</div>
                        <Avatar name={mp.member_name} size={32} tone="navy" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{mp.member_name}</div>
                          <div style={{ marginTop: 5 }}>
                            <ProgressBar value={pct} color={PILLAR_COLORS[progressDrawerGoal.pillar] ?? 'var(--navy)'} height={4} />
                          </div>
                          <div className="tnum" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                            {mp.current_value} / {progressDrawerGoal.target} {progressDrawerGoal.unit}
                          </div>
                        </div>
                        {mp.is_completed && (
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            <Icon name="check" size={12} stroke={2.8} color="#065f46" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Community goal create/edit modal ──────────────────────────────────── */}
      {showModal && (
        <CommunityGoalModal
          goal={editingGoal}
          onClose={() => { setShowModal(false); setEditingGoal(null); }}
          onSaved={saved => {
            setCommunityGoals(gs => {
              const exists = gs.find(g => g.id === saved.id);
              if (exists) return gs.map(g => g.id === saved.id ? { ...g, ...saved } : g);
              return [{ ...saved, assigned_count: 0, completed_count: 0 }, ...gs];
            });
          }}
        />
      )}
    </>
  );
}
