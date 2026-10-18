'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar, PillarChip, Sheet, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, FilterChip, Panel, THead, TRow, AdminSearch } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

// Cells & registers — live data via /api/admin/cells and /api/admin/registers.

type Tab = 'cells' | 'business' | 'leadership' | 'certificates';
interface Person { id: string; name: string; email: string | null; whatsapp?: string | null }
interface Cell {
  id: string; name: string; pillar: string | null; leader_id: string | null; description: string | null;
  meeting_schedule: string | null; is_active: boolean; leader: Person | null;
  members: (Person & { role: string; joined_at: string })[];
}
interface Draft { id?: string; name: string; pillar: string; leader_id: string; meeting_schedule: string; description: string; is_active: boolean }

const PILLARS = [['', 'No pillar'], ['spiritual', 'Spiritual'], ['career', 'Career'], ['business', 'Business'], ['character', 'Character']] as const;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init ? { ...init, headers: { 'Content-Type': 'application/json' } } : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Something went wrong');
  return json as T;
}

export default function CellsPage() {
  const [tab, setTab] = useState<Tab>('cells');
  const [toast, setToast] = useState<ToastData | null>(null);
  const notify = useCallback((msg: string, kind?: string) => { setToast({ msg, kind, icon: kind === 'error' ? 'x' : 'check' }); setTimeout(() => setToast(null), 3000); }, []);

  // all members, for leader/member pickers
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    createClient().from('members').select('id,name,email').eq('onboarding_complete', true).order('name')
      .then(({ data }) => setPeople((data ?? []) as Person[]));
  }, []);

  return (
    <>
      <AdminTopbar title="Cells & registers" subtitle="Small groups and verified records — guard against success theatre" />
      <AdminBody>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {([['cells', 'Cells'], ['business', 'Business registry'], ['leadership', 'Leadership'], ['certificates', 'Certificates']] as const).map(([k, l]) => (
            <FilterChip key={k} active={tab === k} label={l} onClick={() => setTab(k)} />
          ))}
        </div>
        {tab === 'cells' && <CellsTab people={people} notify={notify} />}
        {tab === 'business' && <BusinessTab notify={notify} />}
        {tab === 'leadership' && <LeadershipTab />}
        {tab === 'certificates' && <CertificatesTab notify={notify} />}
      </AdminBody>
      <Toast toast={toast} />
    </>
  );
}

// ── Cells ────────────────────────────────────────────────────────────────────

function CellsTab({ people, notify }: { people: Person[]; notify: (m: string, k?: string) => void }) {
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [leaderSearch, setLeaderSearch] = useState('');

  const load = useCallback(() => {
    api<{ cells: Cell[] }>('/api/admin/cells').then(j => setCells(j.cells)).catch(e => { setCells([]); notify((e as Error).message, 'error'); });
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  const open = cells?.find(c => c.id === openId) ?? null;
  const inAnyCell = useMemo(() => new Map((cells ?? []).flatMap(c => c.members.map(m => [m.id, c.name] as const))), [cells]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await api('/api/admin/cells', { method: 'POST', body: JSON.stringify(draft) });
      notify(draft.id ? 'Cell updated' : 'Cell created');
      setDraft(null);
      load();
    } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (cell: Cell) => {
    if (!window.confirm(`Delete "${cell.name}"? Its ${cell.members.length} members will be unassigned.`)) return;
    try { await api('/api/admin/cells', { method: 'DELETE', body: JSON.stringify({ cellId: cell.id }) }); setOpenId(null); load(); notify('Cell deleted'); }
    catch (e) { notify((e as Error).message, 'error'); }
  };
  const addMember = async (cellId: string, memberId: string) => {
    try { await api('/api/admin/cells', { method: 'PUT', body: JSON.stringify({ cellId, memberIds: [memberId] }) }); setAddSearch(''); load(); }
    catch (e) { notify((e as Error).message, 'error'); }
  };
  const removeMember = async (cellId: string, memberId: string) => {
    try { await api('/api/admin/cells', { method: 'DELETE', body: JSON.stringify({ cellId, memberId }) }); load(); }
    catch (e) { notify((e as Error).message, 'error'); }
  };

  const search = (q: string, exclude: Set<string>) => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return people.filter(p => !exclude.has(p.id) && (p.name.toLowerCase().includes(s) || (p.email ?? '').toLowerCase().includes(s))).slice(0, 6);
  };

  if (!cells) return <Panel><div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading cells…</div></Panel>;

  const TEMPLATE = '1.4fr 1.1fr .7fr 1fr .6fr';
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {cells.length} cell{cells.length === 1 ? '' : 's'} · {inAnyCell.size} of {people.length} members assigned
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setLeaderSearch(''); setDraft({ name: '', pillar: '', leader_id: '', meeting_schedule: '', description: '', is_active: true }); }}>
          <Icon name="plus" size={15} color="#fff" /> New cell
        </button>
      </div>

      <Panel pad={false}>
        <THead cols={['Cell', 'Lead', 'Members', 'Meets', 'Status']} template={TEMPLATE} />
        {cells.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No cells yet. Create one to start grouping members.
          </div>
        )}
        {cells.map(c => (
          <TRow key={c.id} template={TEMPLATE} onClick={() => { setAddSearch(''); setOpenId(c.id); }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              {c.pillar && <div style={{ marginTop: 3 }}><PillarChip pillar={c.pillar} size="sm" /></div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {c.leader ? <><Avatar name={c.leader.name} size={24} tone="grey" /><span>{c.leader.name}</span></> : <span style={{ color: 'var(--faint)' }}>No lead</span>}
            </div>
            <span className="tnum">{c.members.length}</span>
            <span style={{ color: 'var(--muted)' }}>{c.meeting_schedule ?? '—'}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: c.is_active ? '#166534' : 'var(--faint)' }}>{c.is_active ? 'Active' : 'Paused'}</span>
          </TRow>
        ))}
      </Panel>

      {/* Cell detail */}
      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
              {open.leader ? `Led by ${open.leader.name}` : 'No lead assigned'}{open.meeting_schedule ? ` · Meets ${open.meeting_schedule}` : ''}
              {open.description && <div style={{ marginTop: 6, color: 'var(--ink-2)' }}>{open.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setLeaderSearch(''); setDraft({ id: open.id, name: open.name, pillar: open.pillar ?? '', leader_id: open.leader_id ?? '', meeting_schedule: open.meeting_schedule ?? '', description: open.description ?? '', is_active: open.is_active }); }}>
                <Icon name="pencil" size={14} /> Edit
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: '#c53030' }} onClick={() => remove(open)}><Icon name="trash" size={14} /> Delete</button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Members ({open.members.length})</div>
            <AdminSearch value={addSearch} onChange={setAddSearch} placeholder="Add a member by name or email…" />
            {search(addSearch, new Set(open.members.map(m => m.id))).map(p => (
              <button key={p.id} type="button" onClick={() => addMember(open.id, p.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <Avatar name={p.name} size={26} tone="grey" />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
                {inAnyCell.get(p.id) && <span style={{ fontSize: 11.5, color: '#92400e' }}>moves from {inAnyCell.get(p.id)}</span>}
                <Icon name="plus" size={15} color="var(--navy)" />
              </button>
            ))}
            <div style={{ marginTop: 10 }}>
              {open.members.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>No members yet.</div>}
              {open.members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 2px', borderBottom: '1px solid var(--line)' }}>
                  <Avatar name={m.name} size={28} tone="soft" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}{m.role === 'leader' && <span style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 700 }}> · Lead</span>}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{m.email ?? ''}</div>
                  </div>
                  {m.role !== 'leader' && (
                    <button onClick={() => removeMember(open.id, m.id)} aria-label={`Remove ${m.name}`} style={{ color: 'var(--faint)', padding: 6 }}><Icon name="x" size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* Create / edit */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit cell' : 'New cell'}>
        {draft && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Name</label>
            <input className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. VI Central" style={{ width: '100%', marginBottom: 12 }} autoFocus />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pillar</label>
            <select className="input" value={draft.pillar} onChange={e => setDraft({ ...draft, pillar: e.target.value })} style={{ width: '100%', marginBottom: 12 }}>
              {PILLARS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Cell lead</label>
            {draft.leader_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--navy-tint)', marginBottom: 12 }}>
                <Avatar name={people.find(p => p.id === draft.leader_id)?.name ?? '?'} size={26} tone="navy" />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>{people.find(p => p.id === draft.leader_id)?.name ?? 'Selected member'}</span>
                <button onClick={() => setDraft({ ...draft, leader_id: '' })} aria-label="Clear lead"><Icon name="x" size={15} /></button>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <AdminSearch value={leaderSearch} onChange={setLeaderSearch} placeholder="Search for a lead…" />
                {search(leaderSearch, new Set()).map(p => (
                  <button key={p.id} type="button" onClick={() => { setDraft({ ...draft, leader_id: p.id }); setLeaderSearch(''); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <Avatar name={p.name} size={24} tone="grey" /><span style={{ fontSize: 13.5 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>When it meets</label>
            <input className="input" value={draft.meeting_schedule} onChange={e => setDraft({ ...draft, meeting_schedule: e.target.value })} placeholder="e.g. Tuesdays 7pm" style={{ width: '100%', marginBottom: 12 }} />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description (optional)</label>
            <textarea className="input" rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} style={{ width: '100%', marginBottom: 12, resize: 'vertical' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /> Active
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-block" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={save} disabled={busy || !draft.name.trim()}>{busy ? 'Saving…' : 'Save cell'}</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

// ── Business registry ───────────────────────────────────────────────────────

interface BizRow { id: string; name: string; email: string | null; business_status: string; business_industry: string | null; business_description: string | null; business_employees: string | null; business_verified_at?: string | null }

function BusinessTab({ notify }: { notify: (m: string, k?: string) => void }) {
  const [rows, setRows] = useState<BizRow[] | null>(null);
  const [canVerify, setCanVerify] = useState(true);
  const [filter, setFilter] = useState('all');
  const load = useCallback(() => {
    api<{ rows: BizRow[]; canVerify: boolean }>('/api/admin/registers?tab=business')
      .then(j => { setRows(j.rows); setCanVerify(j.canVerify); }).catch(e => { setRows([]); notify((e as Error).message, 'error'); });
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  const verify = async (r: BizRow, verified: boolean) => {
    try { await api('/api/admin/registers', { method: 'POST', body: JSON.stringify({ kind: 'business', id: r.id, verified }) }); load(); }
    catch (e) { notify((e as Error).message, 'error'); }
  };

  if (!rows) return <Panel><div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</div></Panel>;
  const stages = Array.from(new Set(rows.map(r => r.business_status)));
  const shown = filter === 'all' ? rows : rows.filter(r => r.business_status === filter);
  const TEMPLATE = '1.1fr 1.4fr .9fr .6fr .8fr';
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <FilterChip active={filter === 'all'} label={`All (${rows.length})`} onClick={() => setFilter('all')} />
        {stages.map(s => <FilterChip key={s} active={filter === s} label={`${s} (${rows.filter(r => r.business_status === s).length})`} onClick={() => setFilter(s)} />)}
      </div>
      {!canVerify && <div style={{ fontSize: 12.5, color: '#92400e', marginBottom: 10 }}>Run migration 019 in Supabase to turn on verification.</div>}
      <Panel pad={false}>
        <THead cols={['Owner', 'Business', 'Industry', 'Team', 'Verify']} template={TEMPLATE} />
        {shown.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No businesses recorded yet.</div>}
        {shown.map(r => (
          <TRow key={r.id} template={TEMPLATE}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={r.name} size={24} tone="grey" /><span style={{ fontWeight: 600 }}>{r.name}</span></div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{r.business_status}</div>
              {r.business_description && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{r.business_description}</div>}
            </div>
            <span style={{ color: 'var(--muted)' }}>{r.business_industry ?? '—'}</span>
            <span style={{ color: 'var(--muted)' }}>{r.business_employees ?? '—'}</span>
            {r.business_verified_at
              ? <button onClick={() => verify(r, false)} title={`Verified ${fmt(r.business_verified_at)} — click to undo`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--navy)', fontWeight: 600, fontSize: 12.5 }}><Icon name="shieldcheck" size={16} /> Verified</button>
              : <button onClick={() => verify(r, true)} disabled={!canVerify} className="btn btn-primary btn-sm" style={{ height: 30 }}>Verify</button>}
          </TRow>
        ))}
      </Panel>
    </>
  );
}

// ── Leadership ──────────────────────────────────────────────────────────────

function LeadershipTab() {
  const [rows, setRows] = useState<{ name: string; email: string | null; role: string; pillar: string | null; since: string | null }[] | null>(null);
  useEffect(() => { api<{ rows: NonNullable<typeof rows> }>('/api/admin/registers?tab=leadership').then(j => setRows(j.rows)).catch(() => setRows([])); }, []);
  if (!rows) return <Panel><div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</div></Panel>;
  const TEMPLATE = '1.3fr 1.2fr .9fr .7fr';
  return (
    <Panel pad={false}>
      <THead cols={['Leader', 'Role', 'Pillar', 'Since']} template={TEMPLATE} />
      {rows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No leaders yet — grant roles in Settings, add cell leads here, or make mentors in Mentorship.</div>}
      {rows.map((r, i) => (
        <TRow key={i} template={TEMPLATE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={r.name} size={24} tone="grey" /><span style={{ fontWeight: 600 }}>{r.name}</span></div>
          <span>{r.role}</span>
          {r.pillar ? <PillarChip pillar={r.pillar} size="sm" /> : <span style={{ color: 'var(--faint)' }}>—</span>}
          <span style={{ color: 'var(--muted)' }}>{r.since ? fmt(r.since) : '—'}</span>
        </TRow>
      ))}
    </Panel>
  );
}

// ── Certificates ────────────────────────────────────────────────────────────

function CertificatesTab({ notify }: { notify: (m: string, k?: string) => void }) {
  const [rows, setRows] = useState<{ id: string; member: string; course: string; completed_at: string; certificate_url: string | null; verified: boolean | null }[] | null>(null);
  const load = useCallback(() => {
    api<{ rows: NonNullable<typeof rows> }>('/api/admin/registers?tab=certificates').then(j => setRows(j.rows)).catch(e => { setRows([]); notify((e as Error).message, 'error'); });
  }, [notify]);
  useEffect(() => { load(); }, [load]);
  const verify = async (id: string, verified: boolean) => {
    try { await api('/api/admin/registers', { method: 'POST', body: JSON.stringify({ kind: 'certificate', id, verified }) }); load(); }
    catch (e) { notify((e as Error).message, 'error'); }
  };
  if (!rows) return <Panel><div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</div></Panel>;
  const TEMPLATE = '1.1fr 1.3fr .8fr .8fr .7fr';
  return (
    <Panel pad={false}>
      <THead cols={['Member', 'Course', 'Completed', 'Certificate', 'Verify']} template={TEMPLATE} />
      {rows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No course completions recorded yet.</div>}
      {rows.map(r => (
        <TRow key={r.id} template={TEMPLATE}>
          <span style={{ fontWeight: 600 }}>{r.member}</span>
          <span>{r.course}</span>
          <span style={{ color: 'var(--muted)' }}>{fmt(r.completed_at)}</span>
          {r.certificate_url ? <a href={r.certificate_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 600 }}>View</a> : <span style={{ color: 'var(--faint)' }}>—</span>}
          {r.verified
            ? <button onClick={() => verify(r.id, false)} title="Click to undo" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--navy)', fontWeight: 600, fontSize: 12.5 }}><Icon name="shieldcheck" size={16} /> Verified</button>
            : <button onClick={() => verify(r.id, true)} className="btn btn-primary btn-sm" style={{ height: 30 }}>Verify</button>}
        </TRow>
      ))}
    </Panel>
  );
}
