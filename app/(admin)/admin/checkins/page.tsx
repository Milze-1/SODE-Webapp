'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { Avatar, StatusPill } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, TRow, THead, Skeleton } from '@/components/admin/chrome';
import { ProgressBar } from '@/components/sode/ui';

interface CheckInRow {
  id: string; notes: string | null; follow_up_action: string | null;
  follow_up_done: boolean; created_at: string;
  members: { id: string; name: string } | null;
  leaders: { name: string } | null;
}
interface MentorRow { id: string; name: string; mentee_count?: number; max_mentees?: number; }
interface PendingInvite { name: string; email: string; created_at: string; }

export default function MentorshipPage() {
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<CheckInRow[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [memberOptions, setMemberOptions] = useState<{ id: string; name: string }[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const inviteNameRef = useRef<HTMLInputElement>(null);
  const inviteEmailRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const followUpRef = useRef<HTMLInputElement>(null);
  const memberSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const [ciRes, membersRes, mentorRes, leaderRes] = await Promise.all([
          supabase.from('check_ins').select('id,notes,follow_up_action,follow_up_done,created_at,members:member_id(id,name),leaders:leader_id(name)').order('created_at', { ascending: false }).limit(50),
          supabase.from('members').select('id,name').eq('onboarding_complete', true).order('name'),
          supabase.from('members').select('id,name,max_mentees').eq('is_mentor', true).order('name'),
          user ? supabase.from('members').select('id').eq('auth_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        setCheckIns((ciRes.data ?? []) as unknown as CheckInRow[]);
        setMemberOptions((membersRes.data ?? []) as { id: string; name: string }[]);

        // Compute mentee counts per mentor
        const mentorData = (mentorRes.data ?? []) as MentorRow[];
        const withCounts = await Promise.all(mentorData.map(async m => {
          const { count } = await supabase.from('check_ins').select('id', { count: 'exact', head: true }).eq('leader_id', m.id);
          return { ...m, mentee_count: count ?? 0, max_mentees: (m as MentorRow & { max_mentees?: number }).max_mentees ?? 3 };
        }));
        setMentors(withCounts);

        const ld = (leaderRes as { data: { id: string } | null }).data;
        if (ld?.id) setLeaderId(ld.id);
      } catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  const createCheckIn = async () => {
    const memberId = memberSelectRef.current?.value;
    if (!memberId || !notesRef.current?.value) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { data: newCi } = await supabase
        .from('check_ins')
        .insert({ member_id: memberId, leader_id: leaderId, notes: notesRef.current.value, follow_up_action: followUpRef.current?.value || null })
        .select('id,notes,follow_up_action,follow_up_done,created_at,members:member_id(id,name),leaders:leader_id(name)')
        .single();
      if (newCi) setCheckIns(cs => [newCi as unknown as CheckInRow, ...cs]);
      setShowCheckin(false);
    } catch { /* silent */ }
    finally { setCreating(false); }
  };

  const inviteMentor = async () => {
    const name = inviteNameRef.current?.value?.trim();
    const email = inviteEmailRef.current?.value?.trim();
    if (!name || !email) return;
    setInviting(true);
    try {
      const supabase = createClient();
      await supabase.from('members').insert({ name, email, is_mentor: true, onboarding_complete: false }).select('id').single();
      setPendingInvites(pi => [...pi, { name, email, created_at: new Date().toISOString() }]);
      setShowInvite(false);
      if (inviteNameRef.current) inviteNameRef.current.value = '';
      if (inviteEmailRef.current) inviteEmailRef.current.value = '';
    } catch { /* column may not exist yet */ }
    finally { setInviting(false); }
  };

  const markFollowUp = async (ciId: string) => {
    const supabase = createClient();
    await supabase.from('check_ins').update({ follow_up_done: true }).eq('id', ciId);
    setCheckIns(cs => cs.map(c => c.id === ciId ? { ...c, follow_up_done: true } : c));
  };

  // Derive "open requests" from check_ins that have no follow-up done yet
  const openRequests = checkIns.filter(c => c.follow_up_action && !c.follow_up_done).slice(0, 5);

  const PAIR_COL = '1fr 1fr .6fr';

  return (
    <>
      <AdminTopbar
        title="Mentorship"
        subtitle="Pairings · requests · capacity"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCheckin(true)} className="btn btn-ghost btn-sm"><Icon name="plus" size={16} /> New 1:1</button>
            <button onClick={() => setShowInvite(true)} className="btn btn-primary btn-sm">
              <Icon name="userplus" size={16} color="#fff" /> Invite mentor
            </button>
          </div>
        }
      />
      <AdminBody>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--r-sm)', background: '#fff3f3', border: '1px solid #ffc5c5', color: '#c0392b', fontSize: 13, marginBottom: 16 }}>
            <Icon name="info" size={16} /> Could not load mentorship data
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[160, 48, 48, 48].map((h, i) => <Skeleton key={i} h={h} />)}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Open requests */}
              <Panel title="Open follow-ups" action={<span style={{ fontSize: 12, color: 'var(--muted)' }}>{openRequests.length} pending</span>} pad={false}>
                {openRequests.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>All follow-ups complete</div>
                ) : openRequests.map(ci => (
                  <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                    <Avatar name={(ci.members as { id: string; name: string } | null)?.name ?? '?'} size={32} tone="soft" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{(ci.members as { id: string; name: string } | null)?.name ?? '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.follow_up_action}</div>
                    </div>
                    <button onClick={() => markFollowUp(ci.id)} className="btn btn-primary btn-sm" style={{ height: 30 }}>Done</button>
                  </div>
                ))}

                {pendingInvites.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '10px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Pending invites</div>
                    {pendingInvites.map((pi, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                        <Avatar name={pi.name} size={26} tone="soft" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{pi.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{pi.email}</div>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>Invited</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* Mentor capacity */}
              <Panel title="Mentor capacity">
                {mentors.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '20px 0' }}>
                    No mentors yet — invite one above
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {mentors.map(m => {
                      const cap = m.max_mentees ?? 3;
                      const used = m.mentee_count ?? 0;
                      const full = used >= cap;
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <Avatar name={m.name} size={32} tone="grey" />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                            <div style={{ marginTop: 5 }}>
                              <ProgressBar value={cap > 0 ? used / cap : 0} color={full ? 'var(--character)' : 'var(--navy)'} height={6} />
                            </div>
                          </div>
                          <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: full ? 'var(--muted)' : 'var(--ink)' }}>{used}/{cap}{full ? ' · full' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            {/* Pairing log (check_ins) */}
            <Panel title="Check-in log" action={<span style={{ fontSize: 12, color: 'var(--muted)' }}>{checkIns.length} sessions</span>} pad={false}>
              <THead cols={['Mentee', 'Mentor', 'Status']} template={PAIR_COL} />
              {checkIns.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>No check-in sessions yet</div>
              ) : checkIns.map(ci => (
                <TRow key={ci.id} template={PAIR_COL}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={(ci.members as { id: string; name: string } | null)?.name ?? '?'} size={26} tone="grey" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{(ci.members as { id: string; name: string } | null)?.name ?? '—'}</div>
                      {ci.notes && <div style={{ fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{ci.notes}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={(ci.leaders as { name: string } | null)?.name ?? '?'} size={26} tone="soft" />
                    <span style={{ fontSize: 13 }}>{(ci.leaders as { name: string } | null)?.name ?? '—'}</span>
                  </div>
                  <StatusPill status={ci.follow_up_done ? 'done' : ci.follow_up_action ? 'ontrack' : 'atrisk'} size="sm" />
                </TRow>
              ))}
            </Panel>
          </>
        )}
      </AdminBody>

      {/* Invite mentor modal */}
      {showInvite && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowInvite(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 16, padding: 24, width: 380, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Invite a mentor</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 20 }}>They will receive an email with a link to set up their mentor profile.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Full name *</div>
                <input ref={inviteNameRef} placeholder="e.g. Grace Adeyemi" className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Email address *</div>
                <input ref={inviteEmailRef} type="email" placeholder="grace@example.com" className="input" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowInvite(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={inviteMentor} disabled={inviting} className="btn btn-primary" style={{ flex: 1 }}>
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New 1:1 check-in modal */}
      {showCheckin && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowCheckin(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 16, padding: 24, width: 400, boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>New 1:1 Check-in</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Member *</div>
                <select ref={memberSelectRef} className="input" style={{ width: '100%' }}>
                  <option value="">Select member…</option>
                  {memberOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Session notes *</div>
                <textarea ref={notesRef} placeholder="What was discussed…" className="input" rows={4} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Follow-up action</div>
                <input ref={followUpRef} placeholder="e.g. Submit CV by Friday" className="input" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCheckin(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={createCheckIn} disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>
                {creating ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
