'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { Icon, PILLARS } from '@/components/sode/icons';
import { Avatar, StatusPill, ProgressBar, TextInput, EmptyState } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';
import { awardPoints } from '@/lib/points';

interface SessionRow {
  id: string; title: string; type: string; location: string | null;
  scheduled_at: string; expected_count: number | null; is_live: boolean; pillar: string | null;
}

interface AttendRecord {
  id: string; member_id: string; status: string; source: string; checked_in_at: string | null;
}

interface MemberRow { id: string; name: string; }

interface RegisterRow {
  member_id: string; name: string;
  record: AttendRecord | null;
}

const SESSION_TYPES = [
  { value: 'service',       label: 'Service' },
  { value: 'sode_session',  label: 'SODE Session' },
  { value: 'retreat',       label: 'Retreat' },
  { value: 'workshop',      label: 'Workshop' },
];

const EDIT_SESSION_TYPES = [
  { value: 'sunday_service', label: 'Sunday Service' },
  { value: 'sode_session',   label: 'SODE Session' },
  { value: 'cell_meeting',   label: 'Cell Meeting' },
  { value: 'masterclass',    label: 'Masterclass' },
  { value: 'service',        label: 'Service' },
  { value: 'retreat',        label: 'Retreat' },
  { value: 'workshop',       label: 'Workshop' },
  { value: 'other',          label: 'Other' },
];

const selectStyle: React.CSSProperties = {
  width: '100%', height: 50, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)',
  background: 'var(--surface)', padding: '0 14px', fontSize: 15, color: 'var(--ink)', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

function Modal({ onClose, width = 380, children }: { onClose: () => void; width?: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
      <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 20, padding: 28, width, maxHeight: '88%', overflowY: 'auto', boxShadow: 'var(--sh-pop)' }}>
        {children}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [sessions, setSessions]               = useState<SessionRow[]>([]);
  const [members, setMembers]                 = useState<MemberRow[]>([]);
  const [registerSessionId, setRegisterSessionId] = useState<string | null>(null);
  const [records, setRecords]                 = useState<AttendRecord[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [loadError, setLoadError]             = useState<string | null>(null);

  // New session modal
  const [showNew, setShowNew]   = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType]   = useState('service');
  const [newAt, setNewAt]       = useState('');
  const [newCount, setNewCount] = useState('');
  const [newPillar, setNewPillar] = useState('');
  const [saving, setSaving]     = useState(false);

  // Edit session modal
  const [editingSession, setEditingSession] = useState<SessionRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', type: 'service', date: '', time: '09:00', expected_count: 0, pillar: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState<string | null>(null);

  // Delete session modal
  const [deletingSession, setDeletingSession] = useState<SessionRow | null>(null);
  const [deleting, setDeleting]               = useState(false);

  // Register search
  const [registerSearch, setRegisterSearch] = useState('');

  // Member attendance history
  const [historySearch, setHistorySearch]   = useState('');
  const [historyResults, setHistoryResults] = useState<MemberRow[]>([]);
  const [historyMember, setHistoryMember]   = useState<MemberRow | null>(null);
  const [historyRecords, setHistoryRecords] = useState<{ session: SessionRow; record: AttendRecord }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [qrSession, setQrSession]   = useState<SessionRow | null>(null);
  const [qrDataUrl, setQrDataUrl]   = useState('');
  const qrImgRef = useRef<HTMLDivElement | null>(null);

  // Toast
  const [toast, setToast]                   = useState<string | null>(null);
  const toastTimer                           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sessions')
      .select('id,title,type,location,scheduled_at,expected_count,is_live,pillar')
      .order('scheduled_at', { ascending: false })
      .limit(8);
    if (error) {
      console.error('fetchSessions error:', JSON.stringify(error));
      setLoadError('Could not load sessions — check that migration 003_attendance_live.sql has been run in Supabase.');
      return [];
    }
    setLoadError(null);
    const allSessions = (data ?? []) as SessionRow[];
    setSessions(allSessions);
    return allSessions;
  }, []);

  const fetchRecords = useCallback(async (sessionId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id,member_id,status,source,checked_in_at')
      .eq('session_id', sessionId);
    if (error) console.error('fetchRecords error:', JSON.stringify(error));
    setRecords((data ?? []) as AttendRecord[]);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [allSessions] = await Promise.all([fetchSessions()]);
      const { data: memberRows } = await supabase
        .from('members').select('id,name').eq('onboarding_complete', true).order('name');
      setMembers((memberRows ?? []) as MemberRow[]);

      const now = new Date().toISOString();
      const live     = allSessions.find(s => s.is_live);
      const fallback = allSessions.find(s => s.scheduled_at < now);
      const initial  = live ?? fallback ?? allSessions[0] ?? null;
      if (initial) {
        setRegisterSessionId(initial.id);
        await fetchRecords(initial.id);
      }
      setLoading(false);

      const channel = supabase.channel('admin-attendance')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => { fetchSessions(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
          setRegisterSessionId(cur => { if (cur) fetchRecords(cur); return cur; });
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Session actions ────────────────────────────────────────────────────────

  const selectRegister = async (sessionId: string) => {
    setRegisterSessionId(sessionId);
    await fetchRecords(sessionId);
  };

  const goLive = async (session: SessionRow) => {
    const supabase = createClient();
    const { error: e1 } = await supabase.from('sessions').update({ is_live: false }).eq('is_live', true);
    if (e1) console.error('goLive (unset) error:', JSON.stringify(e1));
    const { error: e2 } = await supabase.from('sessions').update({ is_live: true }).eq('id', session.id);
    if (e2) console.error('goLive (set) error:', JSON.stringify(e2));
    await fetchSessions();
    await selectRegister(session.id);
  };

  const endSession = async (session: SessionRow) => {
    const supabase = createClient();
    const { error } = await supabase.from('sessions').update({ is_live: false }).eq('id', session.id);
    if (error) console.error('endSession error:', JSON.stringify(error));
    await fetchSessions();
  };

  const createSession = async () => {
    if (!newTitle.trim() || !newAt) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          title: newTitle.trim(),
          type: newType,
          scheduled_at: new Date(newAt).toISOString(),
          expected_count: newCount ? parseInt(newCount, 10) : null,
          pillar: newPillar || null,
          is_live: false,
        })
        .select('id,title,type,location,scheduled_at,expected_count,is_live,pillar')
        .single();
      if (error) {
        console.error('createSession error:', JSON.stringify(error));
        setLoadError('Could not create session — check that migration 003_attendance_live.sql has been run in Supabase.');
        return;
      }
      if (data) setSessions(prev => [data as SessionRow, ...prev]);
      setShowNew(false);
      setNewTitle(''); setNewType('service'); setNewAt(''); setNewCount(''); setNewPillar('');
      await fetchSessions();
    } finally { setSaving(false); }
  };

  // ─── Edit session ───────────────────────────────────────────────────────────

  const openEdit = (session: SessionRow) => {
    setEditingSession(session);
    setEditError(null);
    setEditForm({
      title:          session.title,
      type:           session.type || 'service',
      date:           session.scheduled_at.split('T')[0],
      time:           session.scheduled_at.split('T')[1]?.slice(0, 5) || '09:00',
      expected_count: session.expected_count ?? 0,
      pillar:         session.pillar || '',
    });
  };

  const saveEdit = async () => {
    if (!editingSession) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const supabase = createClient();
      const combinedDateTime = new Date(`${editForm.date}T${editForm.time}`).toISOString();
      const { error } = await supabase
        .from('sessions')
        .update({
          title:          editForm.title,
          type:           editForm.type,
          scheduled_at:   combinedDateTime,
          expected_count: editForm.expected_count || null,
          pillar:         editForm.pillar || null,
        })
        .eq('id', editingSession.id);

      if (error) { setEditError(error.message); return; }

      setSessions(prev => prev.map(s => s.id === editingSession.id ? {
        ...s,
        title:          editForm.title,
        type:           editForm.type,
        scheduled_at:   combinedDateTime,
        expected_count: editForm.expected_count || null,
        pillar:         editForm.pillar || null,
      } : s));

      setEditingSession(null);
      showToast('Session updated ✓');
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Delete session ─────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deletingSession) return;
    setDeleting(true);
    try {
      const supabase = createClient();

      await supabase.from('attendance_records').delete().eq('session_id', deletingSession.id);

      const { error } = await supabase.from('sessions').delete().eq('id', deletingSession.id);
      if (error) { console.error('deleteSession error:', JSON.stringify(error)); return; }

      setSessions(prev => prev.filter(s => s.id !== deletingSession.id));
      if (registerSessionId === deletingSession.id) { setRegisterSessionId(null); setRecords([]); }

      showToast('Session deleted');
      setDeletingSession(null);
    } finally {
      setDeleting(false);
    }
  };

  // ─── QR ────────────────────────────────────────────────────────────────────

  const openQr = async (session: SessionRow) => {
    setQrSession(session);
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/member/attendance?session=${session.id}`
      : '';
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1e2a52', light: '#ffffff' } });
    setQrDataUrl(dataUrl);
  };

  const checkinUrl = qrSession && typeof window !== 'undefined'
    ? `${window.location.origin}/member/attendance?session=${qrSession.id}`
    : '';

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(checkinUrl); } catch { /* ignore */ }
  };

  const goFullscreen = () => {
    qrImgRef.current?.requestFullscreen?.().catch(() => {});
  };

  // ─── Register ───────────────────────────────────────────────────────────────

  const toggleStatus = async (memberId: string, record: AttendRecord | null) => {
    if (!registerSessionId) return;
    const supabase = createClient();
    if (!record) {
      const { data: inserted, error } = await supabase
        .from('attendance_records')
        .insert({ session_id: registerSessionId, member_id: memberId, status: 'present', source: 'leader' })
        .select('id').single();
      if (error) console.error('toggleStatus insert error:', JSON.stringify(error));
      if (inserted) await awardPoints(memberId, 'attendance_present', 'attendance_records', inserted.id);
      await fetchRecords(registerSessionId);
      return;
    }
    const nextStatus = record.status === 'present' ? 'absent' : 'present';
    const { error } = await supabase.from('attendance_records').update({ status: nextStatus }).eq('id', record.id);
    if (error) console.error('toggleStatus update error:', JSON.stringify(error));
    if (nextStatus === 'present') await awardPoints(memberId, 'attendance_present', 'attendance_records', record.id);
    await fetchRecords(registerSessionId);
  };

  const markAllPresent = async () => {
    if (!registerSessionId) return;
    const supabase = createClient();
    const checkedIds = new Set(records.map(r => r.member_id));
    const missing = members.filter(m => !checkedIds.has(m.id));
    if (missing.length === 0) return;
    const { data: inserted, error } = await supabase
      .from('attendance_records')
      .insert(missing.map(m => ({ session_id: registerSessionId, member_id: m.id, status: 'present', source: 'leader' })))
      .select('id,member_id');
    if (error) console.error('markAllPresent error:', JSON.stringify(error));
    await Promise.all(
      ((inserted ?? []) as { id: string; member_id: string }[]).map(r =>
        awardPoints(r.member_id, 'attendance_present', 'attendance_records', r.id)),
    );
    await fetchRecords(registerSessionId);
  };

  // ─── History search ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!historySearch.trim()) { setHistoryResults([]); return; }
    const supabase = createClient();
    supabase.from('members').select('id,name').eq('onboarding_complete', true).ilike('name', `%${historySearch.trim()}%`).limit(8)
      .then(({ data }) => setHistoryResults((data ?? []) as MemberRow[]));
  }, [historySearch]);

  const loadHistory = async (member: MemberRow) => {
    setHistoryMember(member);
    setHistoryLoading(true);
    const supabase = createClient();
    const { data: recs } = await supabase
      .from('attendance_records')
      .select('id,member_id,status,source,checked_in_at,session_id')
      .eq('member_id', member.id)
      .eq('status', 'present');

    if (!recs?.length) { setHistoryRecords([]); setHistoryLoading(false); return; }
    const sessionIds = recs.map((r: AttendRecord & { session_id: string }) => r.session_id);
    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('id,title,type,location,scheduled_at,expected_count,is_live,pillar')
      .in('id', sessionIds);

    const sessionMap = Object.fromEntries(((sessionRows ?? []) as SessionRow[]).map(s => [s.id, s]));
    const pairs = (recs as (AttendRecord & { session_id: string })[])
      .filter(r => sessionMap[r.session_id])
      .map(r => ({ session: sessionMap[r.session_id], record: r }))
      .sort((a, b) => new Date(b.session.scheduled_at).getTime() - new Date(a.session.scheduled_at).getTime());

    setHistoryRecords(pairs);
    setHistoryLoading(false);
  };

  // ─── Derived values ─────────────────────────────────────────────────────────

  const now             = new Date().toISOString();
  const registerSession = sessions.find(s => s.id === registerSessionId) ?? null;

  const registerRows: RegisterRow[] = members.map(m => ({
    member_id: m.id,
    name:      m.name,
    record:    records.find(r => r.member_id === m.id) ?? null,
  })).sort((a, b) => {
    if (!!a.record === !!b.record) return a.name.localeCompare(b.name);
    return a.record ? -1 : 1;
  });

  const filteredRegisterRows = registerRows.filter(row =>
    !registerSearch.trim() || row.name.toLowerCase().includes(registerSearch.toLowerCase()),
  );

  const presentCount = records.filter(r => r.status === 'present').length;

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <AdminTopbar title="Attendance" subtitle="Sessions, registers & Sheets sync" />
        <AdminBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 128, borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }} />)}
          </div>
        </AdminBody>
      </>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminTopbar
        title="Attendance"
        subtitle="Sessions, registers & Sheets sync"
        actions={
          <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={16} color="#fff" /> New session
          </button>
        }
      />
      <AdminBody>
        {loadError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', fontSize: 13, marginBottom: 16 }}>
            <Icon name="info" size={17} color="var(--navy)" />
            {loadError}
          </div>
        )}

        {/* Session cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 18 }}>
          {sessions.length === 0 && !loadError && (
            <div style={{ gridColumn: '1/-1', padding: 20, color: 'var(--muted)', fontSize: 14 }}>No sessions found. Create a session to get started.</div>
          )}
          {sessions.map(s => {
            const state = s.is_live ? 'LIVE' : s.scheduled_at > now ? 'UPCOMING' : 'PAST';
            const sessionRecords = s.id === registerSessionId ? records : null;
            const present = sessionRecords ? sessionRecords.filter(r => r.status === 'present').length : null;
            const pct = present != null && members.length > 0 ? Math.round((present / members.length) * 100) : null;
            const stateColor = state === 'PAST' ? 'var(--faint)' : 'var(--navy)';
            const liveDisabledTitle = 'End the session before editing/deleting';

            return (
              <div
                key={s.id}
                className="card card-pad"
                onClick={() => selectRegister(s.id)}
                style={{ cursor: 'pointer', border: s.id === registerSessionId ? '1.5px solid var(--navy)' : undefined }}
              >
                {/* Card header: state label + date + edit/delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: stateColor }}>
                    {state === 'LIVE' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: stateColor, animation: 'sode-pulse 1.4s infinite' }} />}
                    {state}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="tnum" style={{ fontSize: 12, color: 'var(--faint)', marginRight: 4 }}>{fmtDate(s.scheduled_at)}</span>
                    {/* Edit button */}
                    <button
                      onClick={e => { e.stopPropagation(); if (!s.is_live) openEdit(s); }}
                      title={s.is_live ? liveDisabledTitle : 'Edit session'}
                      disabled={s.is_live}
                      style={{
                        width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line-2)',
                        background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: s.is_live ? 'not-allowed' : 'pointer',
                        opacity: s.is_live ? 0.4 : 1,
                      }}
                    >
                      <Icon name="pencil" size={13} color="var(--ink-2)" />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={e => { e.stopPropagation(); if (!s.is_live) setDeletingSession(s); }}
                      title={s.is_live ? liveDisabledTitle : 'Delete session'}
                      disabled={s.is_live}
                      style={{
                        width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line-2)',
                        background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: s.is_live ? 'not-allowed' : 'pointer',
                        opacity: s.is_live ? 0.4 : 1,
                      }}
                    >
                      <Icon name="trash" size={13} color="#dc2626" />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 15.5, fontWeight: 700, marginTop: 8 }}>{s.title}</div>
                {pct != null ? (
                  <>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>{pct}%</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>of {members.length}</span>
                    </div>
                    <div style={{ marginTop: 8 }}><ProgressBar value={pct / 100} height={6} /></div>
                  </>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
                    {s.expected_count ? `${s.expected_count} expected` : 'No records yet'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={e => { e.stopPropagation(); openQr(s); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--navy)', background: 'none', cursor: 'pointer', padding: 0 }}>
                    <Icon name="grid" size={15} color="var(--navy)" /> QR
                  </button>
                  <div style={{ flex: 1 }} />
                  {state === 'LIVE' ? (
                    <button onClick={e => { e.stopPropagation(); endSession(s); }} className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 12 }}>End session</button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); goLive(s); }} className="btn btn-primary btn-sm" style={{ height: 28, fontSize: 12 }}>Go Live</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Two-column: register + sheets sync */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
          <Panel
            title={registerSession ? `Register · ${registerSession.title}, ${fmtDate(registerSession.scheduled_at)}` : 'Register'}
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 11px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)' }}>
                  <Icon name="search" size={14} color="var(--faint)" />
                  <input
                    value={registerSearch}
                    onChange={e => setRegisterSearch(e.target.value)}
                    placeholder="Search member…"
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--ink)', width: 140 }}
                  />
                </div>
                <button onClick={markAllPresent} className="btn btn-ghost btn-sm">Mark all present</button>
              </div>
            }
            pad={false}
          >
            {!registerSession ? (
              <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: 13 }}>Select a session to view its register.</div>
            ) : registerRows.length === 0 ? (
              <EmptyState icon="users" title="No members yet" body="Members will appear here once onboarded." />
            ) : (
              <>
                <THead cols={['Member', 'Check-in time', 'Source', 'Status']} template="1.6fr .9fr .8fr .8fr" />
                <div style={{ fontSize: 11.5, color: 'var(--faint)', padding: '8px 16px 0' }}>{presentCount} of {members.length} present</div>
                {filteredRegisterRows.map(row => (
                  <TRow key={row.member_id} template="1.6fr .9fr .8fr .8fr">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar name={row.name} size={28} tone="grey" />
                      <span style={{ fontWeight: 600 }}>{row.name}</span>
                    </div>
                    <span className="tnum" style={{ fontSize: 12, color: 'var(--muted)' }}>{row.record?.checked_in_at ? fmtTime(row.record.checked_in_at) : '—'}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--faint)', textTransform: 'capitalize' }}>{row.record?.source ?? '—'}</span>
                    <button onClick={() => toggleStatus(row.member_id, row.record)} style={{ background: 'none', padding: 0, cursor: 'pointer', width: 'fit-content' }}>
                      <StatusPill status={row.record?.status === 'present' ? 'done' : 'behind'} size="sm" />
                    </button>
                  </TRow>
                ))}
                {filteredRegisterRows.length === 0 && registerSearch && (
                  <div style={{ padding: '16px', color: 'var(--muted)', fontSize: 13 }}>No members match &quot;{registerSearch}&quot;.</div>
                )}
              </>
            )}
          </Panel>

          <Panel title="Google Sheets sync">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}>
                <Icon name="refresh" size={17} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Attendance_2026.xlsx</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Last sync 8 min ago · {members.length} rows</div>
              </div>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--navy)', flex: 'none' }} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Unmatched rows (0)</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 6 }}>All rows resolved</div>
          </Panel>
        </div>
      </AdminBody>

      {/* Member attendance history */}
      <div style={{ marginTop: 16 }}>
        <Panel title="Member attendance history">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line-2)', flex: 1, maxWidth: 280 }}>
              <Icon name="search" size={15} color="var(--faint)" />
              <input
                value={historySearch}
                onChange={e => { setHistorySearch(e.target.value); setHistoryMember(null); }}
                placeholder="Find a member…"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', width: '100%' }}
              />
            </div>
            {historyMember && (
              <button onClick={() => { setHistoryMember(null); setHistorySearch(''); setHistoryRecords([]); }} className="btn btn-ghost btn-sm">
                <Icon name="x" size={14} /> Clear
              </button>
            )}
          </div>

          {historySearch.trim() && !historyMember && historyResults.length > 0 && (
            <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              {historyResults.map(m => (
                <div key={m.id} onClick={() => { loadHistory(m); setHistorySearch(m.name); setHistoryResults([]); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                  <Avatar name={m.name} size={26} tone="grey" />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                </div>
              ))}
            </div>
          )}

          {historyMember && (
            historyLoading ? (
              <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 0', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
                  <Avatar name={historyMember.name} size={42} tone="soft" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{historyMember.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                      {historyRecords.length} of {sessions.length} sessions attended
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>
                      {sessions.length > 0 ? Math.round((historyRecords.length / sessions.length) * 100) : 0}%
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>attendance rate</div>
                  </div>
                </div>

                {historyRecords.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No sessions attended yet.</div>
                ) : (
                  <>
                    <THead cols={['Session', 'Date', 'Check-in time', 'Source']} template="1.5fr .8fr .8fr .6fr" />
                    {historyRecords.map(({ session, record }, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr .8fr .8fr .6fr', padding: '10px 16px', gap: 12, borderBottom: '1px solid var(--line)', fontSize: 13, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{session.title}</span>
                        <span className="tnum" style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(session.scheduled_at)}</span>
                        <span className="tnum" style={{ color: record.checked_in_at ? 'var(--ink)' : 'var(--faint)' }}>
                          {record.checked_in_at ? fmtTime(record.checked_in_at) : '—'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, background: 'var(--navy-tint)', color: 'var(--navy)', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                          {record.source ?? '—'}
                        </span>
                      </div>
                    ))}
                    {historyRecords.length > 0 && (() => {
                      const checkinTimes = historyRecords.filter(h => h.record.checked_in_at).map(h => new Date(h.record.checked_in_at!));
                      const toTimeStr = (d: Date) => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
                      const earliest = checkinTimes.length ? new Date(Math.min(...checkinTimes.map(d => d.getTime()))) : null;
                      const latest   = checkinTimes.length ? new Date(Math.max(...checkinTimes.map(d => d.getTime()))) : null;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, padding: '14px 0' }}>
                          {[
                            { l: 'Earliest check-in', v: earliest ? toTimeStr(earliest) : '—' },
                            { l: 'Latest check-in',   v: latest ? toTimeStr(latest) : '—' },
                            { l: 'Sessions missed',   v: String(sessions.length - historyRecords.length) },
                            { l: 'Total attended',    v: String(historyRecords.length) },
                          ].map((stat, i) => (
                            <div key={i} style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface)' }}>
                              <div style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{stat.l}</div>
                              <div className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>{stat.v}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )
          )}

          {!historyMember && !historySearch.trim() && (
            <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>Search for a member to see their full attendance history and check-in times.</div>
          )}
        </Panel>
      </div>

      {/* ── New session modal ─────────────────────────────────────────────────── */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)} width={400}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>New session</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextInput value={newTitle} onChange={setNewTitle} placeholder="Session name" />
            <select value={newType} onChange={e => setNewType(e.target.value)} style={selectStyle}>
              {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="datetime-local" value={newAt} onChange={e => setNewAt(e.target.value)} style={selectStyle} />
            <TextInput value={newCount} onChange={setNewCount} placeholder="Expected count" type="number" />
            <select value={newPillar} onChange={e => setNewPillar(e.target.value)} style={selectStyle}>
              <option value="">No pillar (general)</option>
              {PILLARS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowNew(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={createSession} disabled={saving || !newTitle.trim() || !newAt} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'Creating…' : 'Create session'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit session modal ────────────────────────────────────────────────── */}
      {editingSession && (
        <Modal onClose={() => setEditingSession(null)} width={420}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>Edit session</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={labelStyle}>Session name</label>
              <input
                type="text"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Session name"
                style={selectStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Session type</label>
              <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} style={selectStyle}>
                {EDIT_SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  style={selectStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Time</label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                  style={selectStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Expected attendance</label>
              <input
                type="number"
                value={editForm.expected_count || ''}
                onChange={e => setEditForm(f => ({ ...f, expected_count: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                style={selectStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Pillar (optional)</label>
              <select value={editForm.pillar} onChange={e => setEditForm(f => ({ ...f, pillar: e.target.value }))} style={selectStyle}>
                <option value="">None</option>
                {PILLARS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {editError && (
            <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>
              {editError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditingSession(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button
              onClick={saveEdit}
              disabled={editSaving || !editForm.title.trim() || !editForm.date}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete session modal ──────────────────────────────────────────────── */}
      {deletingSession && (
        <Modal onClose={() => setDeletingSession(null)} width={380}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>Delete this session?</div>

          <div style={{ padding: '13px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{deletingSession.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {fmtDate(deletingSession.scheduled_at)} · {fmtTime(deletingSession.scheduled_at)}
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 20 }}>
            This will also delete all attendance records for this session. This cannot be undone.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeletingSession(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              style={{
                flex: 1, height: 42, borderRadius: 10, border: 'none',
                background: '#dc2626', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.7 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete session'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── QR modal ─────────────────────────────────────────────────────────── */}
      {qrSession && (
        <Modal onClose={() => { setQrSession(null); setQrDataUrl(''); }} width={380}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{qrSession.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>Scan to check in, or share the link below</div>
          <div ref={qrImgRef} style={{ display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 }}>
            {qrDataUrl ? <img src={qrDataUrl} alt="Check-in QR code" width={240} height={240} /> : <div style={{ width: 240, height: 240, background: 'var(--surface-2)', borderRadius: 10 }} />}
          </div>
          <div style={{ padding: '13px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 11.5, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 14 }}>{checkinUrl}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={copyLink} className="btn btn-ghost" style={{ flex: 1 }}><Icon name="link" size={15} /> Copy link</button>
            <button onClick={goFullscreen} className="btn btn-ghost" style={{ flex: 1 }}><Icon name="arrowupright" size={15} /> Full screen</button>
            <button onClick={() => { setQrSession(null); setQrDataUrl(''); }} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
          </div>
        </Modal>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, background: 'var(--navy)', color: '#fff', fontSize: 13.5, fontWeight: 600, boxShadow: '0 8px 24px rgba(20,29,58,.25)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <Icon name="check" size={16} color="#fff" />
          {toast}
        </div>
      )}
    </>
  );
}
