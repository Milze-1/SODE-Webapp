'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, FilterChip, AdminSearch, THead, TRow } from '@/components/admin/chrome';

// ─── Member tracker types ─────────────────────────────────────────────────────

interface MemberDevotionRow {
  member_id: string;
  member_name: string;
  member_email: string;
  plan_id: string;
  plan_type: string;
  plan_title: string;
  target_days: number;
  start_date: string;
  total_checkins: number;
  last_checkin: string | null;
  checkin_dates: string[];
}

const PLAN_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  bible_study:  { label: 'Bible Study',  icon: 'bookopen', color: '#7c3aed' },
  prayer:       { label: 'Prayer',       icon: 'heart',    color: '#2563eb' },
  reading:      { label: 'Reading Plan', icon: 'list',     color: '#16a34a' },
  fasting:      { label: 'Fasting',      icon: 'zap',      color: '#ea580c' },
  discipleship: { label: 'Discipleship', icon: 'users',    color: '#0891b2' },
  ministry:     { label: 'Ministry',     icon: 'sparkles', color: '#7c3aed' },
  custom:       { label: 'Custom',       icon: 'pencil',   color: '#6b7280' },
};

const GRID = '200px 150px 110px 120px 130px 80px';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function calcStreak(dates: string[]): number {
  const sorted = Array.from(new Set(dates)).sort().reverse();
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  for (const d of sorted) {
    const day = new Date(d + 'T00:00:00');
    const diff = Math.round((cursor.getTime() - day.getTime()) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = day; } else break;
  }
  return streak;
}

function relTime(iso: string | null): string {
  if (!iso) return 'Never';
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  const days = Math.round((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000);
  return `${days} days ago`;
}

function isLate(iso: string | null): boolean {
  if (!iso) return true;
  const days = Math.round((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000);
  return days > 2;
}

interface JournalRow {
  id: string;
  entry_date: string;
  reading_ref: string | null;
  key_insight: string | null;
  reflection: string | null;
  checklist: { read: boolean; prayed: boolean; reflected: boolean } | null;
}

// ─── Daily devotionals types ──────────────────────────────────────────────────

interface DailyDevotional {
  id: string;
  date: string;
  title: string;
  scripture_ref: string;
  scripture_text: string;
  body: string;
  prayer_focus: string;
  key_declaration: string;
  is_published: boolean;
  created_at: string;
}

const BLANK_FORM = {
  date: new Date().toISOString().slice(0, 10),
  title: '',
  scripture_ref: '',
  scripture_text: '',
  body: '',
  prayer_focus: '',
  key_declaration: '',
  is_published: false,
};

// ─── Main admin devotion page ─────────────────────────────────────────────────

export default function AdminDevotionPage() {
  const [adminTab, setAdminTab] = useState<'tracker' | 'devotionals'>('tracker');

  // ── Member tracker state ─────────────────────────────────────────────────
  const [rows, setRows]                   = useState<MemberDevotionRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState('all');
  const [streakFilter, setStreakFilter]   = useState('all');
  const [drawerRow, setDrawerRow]         = useState<MemberDevotionRow | null>(null);
  const [drawerCheckins, setDrawerCheckins] = useState<{ checkin_date: string; notes: string | null; duration_minutes: number | null }[]>([]);
  const [drawerJournal, setDrawerJournal] = useState<JournalRow[]>([]);
  const [bibleReaderCount, setBibleReaderCount] = useState(0);

  const today = todayStr();

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: plans } = await supabase
      .from('devotion_plans')
      .select('id, member_id, plan_type, title, target_days, start_date, members(id, name, email)')
      .eq('is_active', true);

    if (!plans || plans.length === 0) { setLoading(false); return; }

    const planIds = plans.map((p: { id: string }) => p.id);
    const { data: checkins } = await supabase
      .from('devotion_checkins')
      .select('plan_id, checkin_date, notes, duration_minutes, completed')
      .in('plan_id', planIds)
      .eq('completed', true);

    const checkinsByPlan: Record<string, string[]> = {};
    for (const ci of (checkins ?? [])) {
      const r = ci as { plan_id: string; checkin_date: string };
      if (!checkinsByPlan[r.plan_id]) checkinsByPlan[r.plan_id] = [];
      checkinsByPlan[r.plan_id].push(r.checkin_date);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: MemberDevotionRow[] = (plans as any[]).map((p: { id: string; member_id: string; plan_type: string; title: string; target_days: number; start_date: string; members: { id: string; name: string; email: string }[] | null }) => {
      const memberRecord = Array.isArray(p.members) ? p.members[0] : p.members;
      const dates = checkinsByPlan[p.id] ?? [];
      const sorted = [...dates].sort().reverse();
      return {
        member_id:      p.member_id,
        member_name:    memberRecord?.name  ?? 'Unknown',
        member_email:   memberRecord?.email ?? '',
        plan_id:        p.id,
        plan_type:      p.plan_type,
        plan_title:     p.title,
        target_days:    p.target_days,
        start_date:     p.start_date,
        total_checkins: dates.length,
        last_checkin:   sorted[0] ?? null,
        checkin_dates:  dates,
      };
    });

    setRows(result);
    const { count } = await supabase.from('bible_reading_plans').select('id', { count: 'exact', head: true });
    setBibleReaderCount(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openDrawer = async (row: MemberDevotionRow) => {
    setDrawerRow(row);
    setDrawerJournal([]);
    const supabase = createClient();
    const [checkinsRes, journalRes] = await Promise.all([
      supabase
        .from('devotion_checkins')
        .select('checkin_date, notes, duration_minutes, completed')
        .eq('plan_id', row.plan_id)
        .eq('completed', true)
        .order('checkin_date', { ascending: false })
        .limit(90),
      supabase
        .from('devotion_journal')
        .select('id, entry_date, reading_ref, key_insight, reflection, checklist')
        .eq('member_id', row.member_id)
        .order('entry_date', { ascending: false })
        .limit(30),
    ]);
    setDrawerCheckins((checkinsRes.data ?? []) as { checkin_date: string; notes: string | null; duration_minutes: number | null }[]);
    setDrawerJournal((journalRes.data ?? []) as JournalRow[]);
  };

  const checkinToday    = rows.filter(r => r.last_checkin === today).length;
  const sevenPlusStreak = rows.filter(r => calcStreak(r.checkin_dates) >= 7).length;
  const planTypes       = Array.from(new Set(rows.map(r => r.plan_type)));

  const filtered = rows.filter(r => {
    if (typeFilter !== 'all' && r.plan_type !== typeFilter) return false;
    const s = calcStreak(r.checkin_dates);
    if (streakFilter === '7+')         return s >= 7;
    if (streakFilter === '14+')        return s >= 14;
    if (streakFilter === '30+')        return s >= 30;
    if (streakFilter === 'struggling') return isLate(r.last_checkin);
    if (search) {
      const q = search.toLowerCase();
      if (!r.member_name.toLowerCase().includes(q)) return false;
    }
    return true;
  }).filter(r => !search || r.member_name.toLowerCase().includes(search.toLowerCase()));

  const calDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  // ── Daily Devotionals state ───────────────────────────────────────────────
  const [devotionals, setDevotionals]   = useState<DailyDevotional[]>([]);
  const [devLoading, setDevLoading]     = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [form, setForm]                 = useState(BLANK_FORM);
  const [saving, setSaving]             = useState(false);
  const [devLoaded, setDevLoaded]       = useState(false);

  const loadDevotionals = useCallback(async () => {
    if (devLoaded) return;
    setDevLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('daily_devotionals')
      .select('*')
      .order('date', { ascending: false })
      .limit(60);
    setDevotionals((data ?? []) as DailyDevotional[]);
    setDevLoading(false);
    setDevLoaded(true);
  }, [devLoaded]);

  useEffect(() => {
    if (adminTab === 'devotionals') loadDevotionals();
  }, [adminTab, loadDevotionals]);

  const startEdit = (d: DailyDevotional) => {
    setEditingId(d.id);
    setForm({
      date: d.date,
      title: d.title,
      scripture_ref: d.scripture_ref,
      scripture_text: d.scripture_text,
      body: d.body,
      prayer_focus: d.prayer_focus,
      key_declaration: d.key_declaration,
      is_published: d.is_published,
    });
  };

  const resetForm = () => { setEditingId(null); setForm(BLANK_FORM); };

  const saveDevotional = async () => {
    if (!form.title || !form.date || !form.scripture_ref || !form.body || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        date: form.date,
        title: form.title.trim(),
        scripture_ref: form.scripture_ref.trim(),
        scripture_text: form.scripture_text.trim(),
        body: form.body.trim(),
        prayer_focus: form.prayer_focus.trim(),
        key_declaration: form.key_declaration.trim(),
        is_published: form.is_published,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data } = await supabase
          .from('daily_devotionals')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();
        if (data) setDevotionals(ds => ds.map(d => d.id === editingId ? data as DailyDevotional : d));
      } else {
        const { data } = await supabase
          .from('daily_devotionals')
          .insert(payload)
          .select()
          .single();
        if (data) setDevotionals(ds => [data as DailyDevotional, ...ds]);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (d: DailyDevotional) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('daily_devotionals')
      .update({ is_published: !d.is_published, updated_at: new Date().toISOString() })
      .eq('id', d.id)
      .select()
      .single();
    if (data) setDevotionals(ds => ds.map(x => x.id === d.id ? data as DailyDevotional : x));
  };

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <AdminTopbar
        title="Devotion"
        subtitle="Tracker and daily devotionals"
      />
      <AdminBody>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--line)' }}>
          {([
            { key: 'tracker',     label: 'Member Tracker'    },
            { key: 'devotionals', label: 'Daily Devotionals' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setAdminTab(t.key)}
              style={{
                padding: '9px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: adminTab === t.key ? 800 : 500,
                color: adminTab === t.key ? 'var(--navy)' : 'var(--muted)',
                borderBottom: adminTab === t.key ? '2.5px solid var(--navy)' : '2.5px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ MEMBER TRACKER TAB ═══ */}
        {adminTab === 'tracker' && (
          <>
            {/* Overview stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { v: rows.length,      l: 'Active plans',    icon: 'bookopen' },
                { v: bibleReaderCount, l: 'Bible readers',   icon: 'list' },
                { v: checkinToday,     l: 'Check-ins today', icon: 'check' },
                { v: sevenPlusStreak,  l: '7+ day streaks',  icon: 'zap' },
              ].map((s, i) => (
                <div key={i} className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <Icon name={s.icon} size={16} color="var(--navy)" />
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{s.l}</div>
                  </div>
                  <div className="tnum" style={{ fontSize: 28, fontWeight: 800 }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <AdminSearch value={search} onChange={setSearch} placeholder="Search member…" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <FilterChip active={typeFilter === 'all'} label="All types" onClick={() => setTypeFilter('all')} />
                {planTypes.map(t => {
                  const m = PLAN_TYPE_META[t] ?? { label: t, icon: 'bookopen', color: 'var(--navy)' };
                  return <FilterChip key={t} active={typeFilter === t} label={m.label} onClick={() => setTypeFilter(t)} />;
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { key: 'all',        label: 'All' },
                  { key: '7+',         label: '7+ days' },
                  { key: '14+',        label: '14+ days' },
                  { key: '30+',        label: '30+ days' },
                  { key: 'struggling', label: 'Struggling' },
                ] as const).map(f => (
                  <FilterChip key={f.key} active={streakFilter === f.key} label={f.label} onClick={() => setStreakFilter(f.key)} />
                ))}
              </div>
            </div>

            {/* Table */}
            <Panel pad={false}>
              {loading ? (
                <div style={{ padding: '28px 20px', color: 'var(--muted)', fontSize: 13 }}>Loading devotion data…</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Icon name="bookopen" size={20} color="var(--faint)" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>No active devotion plans</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Members set up devotion plans from their spiritual goals.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No results for this filter.</div>
              ) : (
                <>
                  <THead
                    cols={['Member', 'Plan', 'Streak', 'Last check-in', 'Completion rate', 'Details']}
                    template={GRID}
                  />
                  {filtered.map(r => {
                    const streak  = calcStreak(r.checkin_dates);
                    const daysIn  = Math.max(1, Math.round((Date.now() - new Date(r.start_date + 'T00:00:00').getTime()) / 86400000));
                    const rate    = Math.min(100, Math.round((r.total_checkins / daysIn) * 100));
                    const m       = PLAN_TYPE_META[r.plan_type] ?? PLAN_TYPE_META.custom;
                    const late    = isLate(r.last_checkin);
                    return (
                      <TRow key={`${r.member_id}-${r.plan_id}`} template={GRID} onClick={() => openDrawer(r)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar name={r.member_name} size={28} tone="navy" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.member_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            <Icon name={m.icon} size={13} color={m.color} />
                          </div>
                          <span style={{ fontSize: 13 }}>{m.label}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: streak >= 7 ? '#92400e' : 'var(--ink)' }}>
                          {streak > 0 ? `🔥 ${streak}d` : '—'}
                        </span>
                        <span style={{ fontSize: 13, color: late ? '#c53030' : 'var(--ink)', fontWeight: late ? 700 : 400 }}>
                          {relTime(r.last_checkin)}
                        </span>
                        <div>
                          <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rate}%`, background: rate >= 70 ? '#16a34a' : rate >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 99 }} />
                          </div>
                          <span className="tnum" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{rate}%</span>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openDrawer(r); }}>
                          View
                        </button>
                      </TRow>
                    );
                  })}
                </>
              )}
            </Panel>
          </>
        )}

        {/* ═══ DAILY DEVOTIONALS TAB ═══ */}
        {adminTab === 'devotionals' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Creation / edit form */}
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>
                  {editingId ? 'Edit devotional' : 'New devotional'}
                </div>
                {editingId && (
                  <button onClick={resetForm} className="btn btn-ghost btn-sm">
                    <Icon name="x" size={14} /> Cancel
                  </button>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Walking in Faith"
                  style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Scripture reference *</label>
                <input
                  type="text"
                  value={form.scripture_ref}
                  onChange={e => setForm(f => ({ ...f, scripture_ref: e.target.value }))}
                  placeholder="e.g. Hebrews 11:1"
                  style={{ width: '100%', height: 40, borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Scripture text</label>
                <textarea
                  value={form.scripture_text}
                  onChange={e => setForm(f => ({ ...f, scripture_text: e.target.value }))}
                  placeholder="Now faith is confidence in what we hope for…"
                  rows={3}
                  style={{ width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Devotional body *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="The main devotional text…"
                  rows={6}
                  style={{ width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Prayer focus</label>
                <textarea
                  value={form.prayer_focus}
                  onChange={e => setForm(f => ({ ...f, prayer_focus: e.target.value }))}
                  placeholder="What members should pray about…"
                  rows={3}
                  style={{ width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Key declaration</label>
                <textarea
                  value={form.key_declaration}
                  onChange={e => setForm(f => ({ ...f, key_declaration: e.target.value }))}
                  placeholder="A declaration members will speak aloud…"
                  rows={2}
                  style={{ width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)', background: 'var(--surface)', fontSize: 13.5, padding: '10px 12px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Publish toggle */}
              <button
                onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  borderRadius: 10,
                  background: form.is_published ? 'var(--navy-tint)' : 'var(--surface-2)',
                  border: `1.5px solid ${form.is_published ? 'var(--navy)' : 'transparent'}`,
                  textAlign: 'left', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 36, height: 20, borderRadius: 10, flex: 'none',
                  background: form.is_published ? 'var(--navy)' : 'var(--line-2)',
                  position: 'relative', transition: 'background .2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: form.is_published ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s',
                  }} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: form.is_published ? 'var(--navy)' : 'var(--muted)' }}>
                  {form.is_published ? 'Published — visible to members' : 'Draft — not yet published'}
                </span>
              </button>

              <button
                onClick={saveDevotional}
                disabled={!form.title || !form.date || !form.scripture_ref || !form.body || saving}
                className="btn btn-primary btn-block"
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create devotional'}
              </button>
            </div>

            {/* Devotional list */}
            <div>
              {devLoading ? (
                <div style={{ padding: '24px 0', color: 'var(--muted)', fontSize: 13 }}>Loading devotionals…</div>
              ) : devotionals.length === 0 ? (
                <div className="card card-pad" style={{ textAlign: 'center', padding: '36px 20px' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>No devotionals yet — create the first one.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {devotionals.map(d => (
                    <div key={d.id} className="card" style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{fmtDate(d.date)}</span>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                              background: d.is_published ? '#d1fae5' : 'var(--surface-2)',
                              color: d.is_published ? '#065f46' : 'var(--faint)',
                            }}>
                              {d.is_published ? 'Published' : 'Draft'}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{d.title}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{d.scripture_ref}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                          <button
                            onClick={() => togglePublish(d)}
                            className="btn btn-ghost btn-sm"
                            title={d.is_published ? 'Unpublish' : 'Publish'}
                          >
                            <Icon name={d.is_published ? 'eyeoff' : 'eye'} size={14} />
                          </button>
                          <button onClick={() => startEdit(d)} className="btn btn-ghost btn-sm">
                            <Icon name="pencil" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </AdminBody>

      {/* Drawer */}
      {drawerRow && (
        <>
          <div onClick={() => setDrawerRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: 'var(--surface)', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.12)' }}>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={drawerRow.member_name} size={42} tone="navy" />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{drawerRow.member_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{drawerRow.member_email}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{drawerRow.plan_title}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setDrawerRow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                  <Icon name="x" size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {[
                  { v: calcStreak(drawerRow.checkin_dates), l: 'Streak', emoji: '🔥' },
                  { v: drawerRow.total_checkins, l: 'Total', emoji: '✓' },
                  { v: drawerRow.target_days, l: 'Target', emoji: '🎯' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'var(--surface-2)', borderRadius: 10 }}>
                    <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>{s.emoji} {s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 30-day calendar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Last 30 days</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
                {calDays.map((d, i) => {
                  const checked  = drawerCheckins.some(ci => ci.checkin_date === d);
                  const isFuture = d > today;
                  const isToday  = d === today;
                  const bg = checked ? '#16a34a' : isFuture ? 'var(--surface-2)' : '#fee2e2';
                  return (
                    <div key={i} style={{ aspectRatio: '1', borderRadius: 4, background: bg, border: isToday ? '2px solid var(--navy)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {checked && <Icon name="check" size={9} stroke={3} color="#fff" />}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {[{ c: '#16a34a', l: 'Done' }, { c: '#fee2e2', l: 'Missed' }].map((x, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Journal + Notes */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {drawerJournal.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Bible reading journal</div>
                  {drawerJournal.slice(0, 15).map((j) => {
                    const done = (j.checklist?.read ? 1 : 0) + (j.checklist?.prayed ? 1 : 0) + (j.checklist?.reflected ? 1 : 0);
                    return (
                      <div key={j.id} style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line-2)', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: j.key_insight ? 6 : 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{j.reading_ref ?? 'Unrecorded'}</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[
                              { key: 'read', icon: 'bookopen' },
                              { key: 'prayed', icon: 'heart' },
                              { key: 'reflected', icon: 'pencil' },
                            ].map(x => (
                              <div key={x.key} title={x.key} style={{ width: 20, height: 20, borderRadius: 5, background: j.checklist?.[x.key as keyof typeof j.checklist] ? '#d1fae5' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name={j.checklist?.[x.key as keyof typeof j.checklist] ? 'check' : x.icon} size={10} stroke={2.4} color={j.checklist?.[x.key as keyof typeof j.checklist] ? '#065f46' : 'var(--faint)'} />
                              </div>
                            ))}
                          </div>
                        </div>
                        {j.key_insight && (
                          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 4 }}>&ldquo;{j.key_insight}&rdquo;</div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                          {new Date(j.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {' · '}{done}/3 complete
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />
                </>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Check-in notes</div>
              {drawerCheckins.filter(c => c.notes).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', padding: '20px 0' }}>No notes recorded yet.</div>
              ) : drawerCheckins.filter(c => c.notes).slice(0, 20).map((ci, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line-2)', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.4 }}>{ci.notes}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>
                    {new Date(ci.checkin_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {ci.duration_minutes ? ` · ${ci.duration_minutes} min` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
