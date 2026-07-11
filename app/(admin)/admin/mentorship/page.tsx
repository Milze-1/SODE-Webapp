'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar, ProgressBar, Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, AdminSearch } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';
import { PILLAR_OPTIONS } from '@/lib/forms-audience';

interface MemberRow { id: string; name: string; email: string | null; pillar: string | null; is_mentor: boolean; mentor_capacity: number | null; }
interface MentorInviteRow { id: string; name: string; email: string; pillar: string | null; mentor_capacity: number | null; status: string; created_at: string | null; }
interface PairingRow {
  id: string; status: string; pillar: string | null; matched_at: string | null;
  mentee: { id: string; name: string } | null;
  mentor: { id: string; name: string } | null;
}

const STATUS_OPTIONS = ['active', 'paused', 'completed'];

export default function MentorshipPage() {
  const [loading, setLoading] = useState(true);
  const [mentors, setMentors] = useState<MemberRow[]>([]);
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [pairingCounts, setPairingCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // assign mentor
  const [menteeQuery, setMenteeQuery] = useState('');
  const [menteeResults, setMenteeResults] = useState<MemberRow[]>([]);
  const [selectedMentee, setSelectedMentee] = useState<MemberRow | null>(null);
  const [assignPillar, setAssignPillar] = useState('');

  // make a mentor
  const [mentorQuery, setMentorQuery] = useState('');
  const [mentorResults, setMentorResults] = useState<MemberRow[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MemberRow | null>(null);
  const [capacityInput, setCapacityInput] = useState('3');

  // invite external mentor
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePillar, setInvitePillar] = useState('');
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<MentorInviteRow[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const [mentorsRes, pairingsRes, invitesRes] = await Promise.all([
      supabase.from('members').select('id,name,email,pillar,is_mentor,mentor_capacity').eq('is_mentor', true).order('name'),
      supabase.from('mentor_pairings').select('id,status,pillar,matched_at,mentee:mentee_id(id,name),mentor:mentor_id(id,name)').order('matched_at', { ascending: false }),
      supabase.from('mentor_invites').select('id,name,email,pillar,mentor_capacity,status,created_at').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    const mentorRows = (mentorsRes.data ?? []) as unknown as MemberRow[];
    setMentors(mentorRows);
    setPairings((pairingsRes.data ?? []) as unknown as PairingRow[]);
    setPendingInvites((invitesRes.data ?? []) as unknown as MentorInviteRow[]);

    if (mentorRows.length) {
      const { data: activePairs } = await supabase.from('mentor_pairings').select('mentor_id').eq('status', 'active');
      const counts: Record<string, number> = {};
      ((activePairs ?? []) as { mentor_id: string }[]).forEach(p => { counts[p.mentor_id] = (counts[p.mentor_id] ?? 0) + 1; });
      setPairingCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!menteeQuery.trim()) { setMenteeResults([]); return; }
    createClient().from('members').select('id,name,email,pillar,is_mentor,mentor_capacity').eq('onboarding_complete', true).ilike('name', `%${menteeQuery.trim()}%`).limit(6)
      .then(({ data }) => setMenteeResults((data ?? []) as MemberRow[]));
  }, [menteeQuery]);

  useEffect(() => {
    if (!mentorQuery.trim()) { setMentorResults([]); return; }
    createClient().from('members').select('id,name,email,pillar,is_mentor,mentor_capacity').ilike('name', `%${mentorQuery.trim()}%`).limit(6)
      .then(({ data }) => setMentorResults((data ?? []) as MemberRow[]));
  }, [mentorQuery]);

  const assignMentor = async (mentor: MemberRow) => {
    if (!selectedMentee) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('mentor_pairings').insert({
      mentor_id: mentor.id,
      mentee_id: selectedMentee.id,
      pillar: assignPillar || mentor.pillar || selectedMentee.pillar,
      status: 'active',
      matched_by: user?.id,
    });
    if (error) { showToast('Could not assign — they may already be paired.', 'x'); return; }
    showToast(`${mentor.name} assigned to ${selectedMentee.name} ✓`, 'check');
    // Notify mentee by email (fire-and-forget)
    if (selectedMentee.email) {
      fetch('/api/notify/mentor-assigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menteeName: selectedMentee.name,
          menteeEmail: selectedMentee.email,
          mentorName: mentor.name,
          pillar: assignPillar || mentor.pillar || selectedMentee.pillar,
        }),
      }).catch(e => console.warn('[mentorship] email notify failed (non-fatal):', e));
    }
    setSelectedMentee(null);
    setMenteeQuery('');
    setAssignPillar('');
    loadAll();
  };

  const setAsMentor = async () => {
    if (!selectedCandidate) return;
    const cap = Number(capacityInput) || 3;
    const supabase = createClient();
    const { error } = await supabase.from('members').update({ is_mentor: true, mentor_capacity: cap }).eq('id', selectedCandidate.id);
    if (error) { showToast('Could not update member.', 'x'); return; }
    showToast(`${selectedCandidate.name} is now a mentor ✓`, 'check');
    setSelectedCandidate(null);
    setMentorQuery('');
    setCapacityInput('3');
    loadAll();
  };

  const sendInvite = async () => {
    if (!inviteName || !inviteEmail) return;
    setInviting(true);
    try {
      const res = await fetch('/api/admin/invite-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteName, email: inviteEmail, pillar: invitePillar || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error ?? 'Could not send invite.', 'x');
        return;
      }
      if (data.outcome === 'existing_member_promoted') {
        showToast(`${data.memberName} is already a member — set as mentor ✓`, 'check');
      } else if (data.outcome === 'already_mentor') {
        showToast(`${data.memberName} is already a mentor.`, 'check');
      } else {
        showToast(`Invite sent to ${inviteName} ✓`, 'mail');
      }
      setInviteName(''); setInviteEmail(''); setInvitePillar('');
      setShowInvite(false);
      loadAll();
    } catch {
      showToast('Could not send invite.', 'x');
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (inv: MentorInviteRow) => {
    setResendingId(inv.id);
    try {
      const res = await fetch('/api/admin/invite-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inv.name, email: inv.email, pillar: inv.pillar, capacity: inv.mentor_capacity }),
      });
      const data = await res.json();
      if (res.ok && data.ok) showToast(`Invite re-sent to ${inv.name} ✓`, 'mail');
      else showToast(data.error ?? 'Could not resend invite.', 'x');
    } catch {
      showToast('Could not resend invite.', 'x');
    } finally {
      setResendingId(null);
    }
  };

  const revokeInvite = async (inv: MentorInviteRow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('mentor_invites')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', inv.id);
    if (error) { showToast('Could not revoke invite.', 'x'); return; }
    showToast(`Invite to ${inv.name} revoked.`, 'check');
    setPendingInvites(rows => rows.filter(r => r.id !== inv.id));
  };

  const updateStatus = async (pairingId: string, status: string) => {
    const supabase = createClient();
    await supabase.from('mentor_pairings').update({ status }).eq('id', pairingId);
    setPairings(rows => rows.map(r => r.id === pairingId ? { ...r, status } : r));
  };

  // ─── Edit pairing ─────────────────────────────────────────────────────────
  const [editPairing, setEditPairing] = useState<PairingRow | null>(null);
  const [editMentorId, setEditMentorId] = useState('');
  const [editMenteeId, setEditMenteeId] = useState('');
  const [editMentorName, setEditMentorName] = useState('');
  const [editMenteeName, setEditMenteeName] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editMentorSearch, setEditMentorSearch] = useState('');
  const [editMenteeSearch, setEditMenteeSearch] = useState('');
  const [editMentorResults, setEditMentorResults] = useState<MemberRow[]>([]);
  const [editMenteeResults, setEditMenteeResults] = useState<MemberRow[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!editMentorSearch.trim()) { setEditMentorResults([]); return; }
    createClient().from('members').select('id,name,email,pillar,is_mentor,mentor_capacity').eq('is_mentor', true).ilike('name', `%${editMentorSearch}%`).limit(6)
      .then(({ data }) => setEditMentorResults((data ?? []) as MemberRow[]));
  }, [editMentorSearch]);

  useEffect(() => {
    if (!editMenteeSearch.trim()) { setEditMenteeResults([]); return; }
    createClient().from('members').select('id,name,email,pillar,is_mentor,mentor_capacity').eq('onboarding_complete', true).ilike('name', `%${editMenteeSearch}%`).limit(6)
      .then(({ data }) => setEditMenteeResults((data ?? []) as MemberRow[]));
  }, [editMenteeSearch]);

  const openEditPairing = (p: PairingRow) => {
    setEditPairing(p);
    setEditMentorId(p.mentor?.id ?? '');
    setEditMenteeId(p.mentee?.id ?? '');
    setEditMentorName(p.mentor?.name ?? '');
    setEditMenteeName(p.mentee?.name ?? '');
    setEditStatus(p.status);
    setEditNotes((p as PairingRow & { notes?: string }).notes ?? '');
    setEditMentorSearch('');
    setEditMenteeSearch('');
    setConfirmRemove(false);
  };

  const saveEditPairing = async () => {
    if (!editPairing) return;
    setEditSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('mentor_pairings').update({
      mentor_id: editMentorId,
      mentee_id: editMenteeId,
      status: editStatus,
      notes: editNotes || null,
    }).eq('id', editPairing.id);
    if (error) { showToast('Could not save changes.', 'x'); setEditSaving(false); return; }
    showToast('Pairing updated ✓', 'check');
    setEditPairing(null);
    setEditSaving(false);
    loadAll();
  };

  const removePairing = async () => {
    if (!editPairing) return;
    setEditSaving(true);
    const supabase = createClient();
    await supabase.from('mentor_pairings').delete().eq('id', editPairing.id);
    showToast('Pairing removed.', 'check');
    setEditPairing(null);
    setEditSaving(false);
    loadAll();
  };

  return (
    <>
      <AdminTopbar
        title="Mentorship"
        subtitle="Assign mentors · capacity · pairing log"
        actions={
          <button onClick={() => setShowInvite(true)} className="btn btn-primary btn-sm">
            <Icon name="userplus" size={16} color="#fff" /> Invite external mentor
          </button>
        }
      />
      <AdminBody>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 200, borderRadius: 'var(--r-md)', background: 'rgba(0,0,0,.06)' }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Assign mentor */}
              <Panel title="Assign a mentor" pad={false}>
                <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
                  <AdminSearch value={menteeQuery} onChange={v => { setMenteeQuery(v); setSelectedMentee(null); }} placeholder="Search mentee by name…" />
                  {selectedMentee && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 10, background: 'var(--navy-tint)' }}>
                      <Avatar name={selectedMentee.name} size={28} tone="navy" />
                      <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{selectedMentee.name}</span>
                      <select value={assignPillar} onChange={e => setAssignPillar(e.target.value)} className="input" style={{ height: 30, fontSize: 12, padding: '0 8px', width: 120 }}>
                        <option value="">Pillar…</option>
                        {PILLAR_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                      <button onClick={() => setSelectedMentee(null)} className="btn btn-ghost btn-sm" style={{ height: 30, padding: '0 8px' }}><Icon name="x" size={15} /></button>
                    </div>
                  )}
                  {!selectedMentee && menteeResults.length > 0 && (
                    <div style={{ marginTop: 8, border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                      {menteeResults.map(m => (
                        <div key={m.id} onClick={() => { setSelectedMentee(m); setMenteeResults([]); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                          <Avatar name={m.name} size={26} tone="grey" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {!selectedMentee ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Search and select a mentee to see eligible mentors.</div>
                ) : mentors.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No mentors yet — add one in the panel on the right.</div>
                ) : (
                  <div>
                    {mentors.map(m => {
                      const used = pairingCounts[m.id] ?? 0;
                      const cap = m.mentor_capacity ?? 3;
                      const full = used >= cap;
                      const compatible = !!m.pillar && m.pillar === selectedMentee.pillar;
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
                          <Avatar name={m.name} size={32} tone="soft" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                              {compatible && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy)', background: 'var(--navy-tint)', padding: '1px 6px', borderRadius: 4 }}>MATCH</span>}
                            </div>
                            <div className="tnum" style={{ fontSize: 11.5, color: full ? 'var(--muted)' : 'var(--faint)', marginTop: 2 }}>{used}/{cap} mentees{full ? ' · full' : ''}</div>
                          </div>
                          <button onClick={() => assignMentor(m)} disabled={full} className="btn btn-primary btn-sm" style={{ height: 30 }}>Assign</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              {/* Make someone a mentor */}
              <Panel title="Make someone a mentor">
                <AdminSearch value={mentorQuery} onChange={v => { setMentorQuery(v); setSelectedCandidate(null); }} placeholder="Search member by name…" />
                {selectedCandidate ? (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Avatar name={selectedCandidate.name} size={34} tone="navy" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{selectedCandidate.name}</div>
                      {selectedCandidate.is_mentor && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Already a mentor</div>}
                    </div>
                    <input value={capacityInput} onChange={e => setCapacityInput(e.target.value)} type="number" min={1} className="input" style={{ width: 64, height: 34, textAlign: 'center' }} />
                    <button onClick={setAsMentor} className="btn btn-primary btn-sm" style={{ height: 34 }}>Set as mentor</button>
                  </div>
                ) : mentorResults.length > 0 ? (
                  <div style={{ marginTop: 10, border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                    {mentorResults.map(m => (
                      <div key={m.id} onClick={() => setSelectedCandidate(m)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                        <Avatar name={m.name} size={26} tone="grey" />
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{m.name}</span>
                        {m.is_mentor && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>mentor</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>Search for a member to grant mentor capacity.</div>
                )}

                <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Mentor capacity</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {mentors.slice(0, 4).map(m => {
                      const used = pairingCounts[m.id] ?? 0;
                      const cap = m.mentor_capacity ?? 3;
                      const full = used >= cap;
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={m.name} size={26} tone="grey" />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
                            <div style={{ marginTop: 3 }}><ProgressBar value={cap ? used / cap : 0} color={full ? 'var(--p-character)' : 'var(--navy)'} height={5} /></div>
                          </div>
                          <span className="tnum" style={{ fontSize: 11.5, fontWeight: 700, color: full ? 'var(--muted)' : 'var(--ink)' }}>{used}/{cap}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            </div>

            {/* Pending mentor invites */}
            {pendingInvites.length > 0 && (
              <div style={{ marginBottom: 16 }}>
              <Panel title="Pending mentor invites" pad={false}>
                <THead cols={['Name', 'Email', 'Pillar', 'Invited', '']} template="1fr 1.3fr .7fr .7fr .9fr" />
                {pendingInvites.map(inv => (
                  <TRow key={inv.id} template="1fr 1.3fr .7fr .7fr .9fr">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={inv.name} size={26} tone="grey" />{inv.name}
                    </div>
                    <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</div>
                    <div>{inv.pillar ?? '—'}</div>
                    <div className="tnum" style={{ color: 'var(--muted)' }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 12 }} disabled={resendingId === inv.id} onClick={() => resendInvite(inv)}>
                        {resendingId === inv.id ? 'Sending…' : 'Resend'}
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 12, color: 'var(--muted)' }} onClick={() => revokeInvite(inv)}>Revoke</button>
                    </div>
                  </TRow>
                ))}
              </Panel>
              </div>
            )}

            {/* Pairing log */}
            <Panel title="Pairing log" pad={false}>
              <THead cols={['Mentee', 'Mentor', 'Pillar', 'Status', 'Since', '']} template="1fr 1fr .7fr .8fr .7fr .4fr" />
              {pairings.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No pairings yet.</div>
              ) : pairings.map(p => (
                <TRow key={p.id} template="1fr 1fr .7fr .8fr .7fr .4fr">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={p.mentee?.name ?? '—'} size={26} tone="grey" />{p.mentee?.name ?? '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={p.mentor?.name ?? '—'} size={26} tone="soft" />{p.mentor?.name ?? '—'}
                  </div>
                  <div>{p.pillar ?? '—'}</div>
                  <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)} className="input" style={{ height: 30, fontSize: 12, padding: '0 8px' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="tnum" style={{ color: 'var(--muted)' }}>{p.matched_at ? new Date(p.matched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
                  <button className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 12 }} onClick={() => openEditPairing(p)}>Edit</button>
                </TRow>
              ))}
            </Panel>
          </>
        )}
      </AdminBody>

      {showInvite && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowInvite(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 20, padding: 28, width: 380, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18 }}>Invite an external mentor</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Name</label>
              <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" className="input" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Email</label>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" type="email" className="input" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Pillar</label>
              <select value={invitePillar} onChange={e => setInvitePillar(e.target.value)} className="input" style={{ width: '100%' }}>
                <option value="">Select a pillar…</option>
                {PILLAR_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowInvite(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={sendInvite} disabled={inviting || !inviteName || !inviteEmail} className="btn btn-primary" style={{ flex: 1 }}>
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit pairing modal */}
      {editPairing && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setEditPairing(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 20, padding: 28, width: 420, maxHeight: '88vh', overflowY: 'auto', boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Edit pairing</div>

            {/* Mentee */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 7 }}>Mentee</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', marginBottom: 6 }}>
                <Avatar name={editMenteeName || '—'} size={26} tone="grey" />
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{editMenteeName || '—'}</span>
                <button type="button" className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 11 }} onClick={() => setEditMenteeSearch(' ')}>Change</button>
              </div>
              {editMenteeSearch.trim() && (
                <>
                  <input value={editMenteeSearch} onChange={e => setEditMenteeSearch(e.target.value)} placeholder="Search mentee…" className="input" style={{ width: '100%', marginBottom: 4 }} autoFocus />
                  {editMenteeResults.length > 0 && (
                    <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                      {editMenteeResults.map(m => (
                        <div key={m.id} onClick={() => { setEditMenteeId(m.id); setEditMenteeName(m.name); setEditMenteeSearch(''); setEditMenteeResults([]); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                          <Avatar name={m.name} size={24} tone="grey" /><span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mentor */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 7 }}>Mentor</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', marginBottom: 6 }}>
                <Avatar name={editMentorName || '—'} size={26} tone="soft" />
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{editMentorName || '—'}</span>
                <button type="button" className="btn btn-ghost btn-sm" style={{ height: 28, fontSize: 11 }} onClick={() => setEditMentorSearch(' ')}>Change</button>
              </div>
              {editMentorSearch.trim() && (
                <>
                  <input value={editMentorSearch} onChange={e => setEditMentorSearch(e.target.value)} placeholder="Search mentor…" className="input" style={{ width: '100%', marginBottom: 4 }} autoFocus />
                  {editMentorResults.length > 0 && (
                    <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                      {editMentorResults.map(m => (
                        <div key={m.id} onClick={() => { setEditMentorId(m.id); setEditMentorName(m.name); setEditMentorSearch(''); setEditMentorResults([]); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
                          <Avatar name={m.name} size={24} tone="soft" />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                          {m.is_mentor && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy)', background: 'var(--navy-tint)', padding: '1px 6px', borderRadius: 4 }}>MENTOR</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Status */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 7 }}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="input" style={{ width: '100%' }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 7 }}>Notes (optional)</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Add a note about this pairing…" rows={3} className="input" style={{ width: '100%', resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            {!confirmRemove ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmRemove(true)} className="btn btn-ghost" style={{ color: '#c53030', borderColor: '#fee2e2' }}>Remove</button>
                <button onClick={() => setEditPairing(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button onClick={saveEditPairing} disabled={editSaving} className="btn btn-primary" style={{ flex: 1 }}>{editSaving ? 'Saving…' : 'Save changes'}</button>
              </div>
            ) : (
              <div style={{ padding: '14px', borderRadius: 10, background: '#fff5f5', border: '1px solid #fed7d7', marginBottom: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#c53030', marginBottom: 8 }}>Remove this pairing?</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>The mentee will no longer have an assigned mentor and will see &quot;Mentor coming soon&quot;.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setConfirmRemove(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={removePairing} disabled={editSaving} style={{ flex: 1, height: 40, borderRadius: 10, background: '#c53030', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>{editSaving ? 'Removing…' : 'Yes, remove'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
