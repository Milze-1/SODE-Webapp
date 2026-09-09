'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { TextInput, Field } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, Skeleton } from '@/components/admin/chrome';
import { summarizeAudience, PILLAR_OPTIONS, LIFE_STAGE_OPTIONS, type FormAudience } from '@/lib/forms-audience';

interface CellOption { id: string; name: string; }
interface MemberOption { id: string; name: string; }

interface MessageRow {
  id: string;
  body: string;
  audience: FormAudience;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

const AUDIENCE_TYPES: { key: FormAudience['type']; label: string; desc: string }[] = [
  { key: 'everyone', label: 'Everyone', desc: 'All members with a WhatsApp number on file' },
  { key: 'pillar', label: 'By pillar', desc: 'Members whose primary pillar matches' },
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

export default function MessagesPage() {
  const [loading, setLoading] = useState(true);
  const [cells, setCells] = useState<CellOption[]>([]);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [audience, setAudience] = useState<FormAudience>({ type: 'everyone' });
  const [targetCount, setTargetCount] = useState(0);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<MessageRow[]>([]);

  const loadHistory = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('group_messages').select('*').order('created_at', { ascending: false }).limit(20);
    setHistory((data ?? []) as MessageRow[]);
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const [cellsRes, membersRes] = await Promise.all([
          supabase.from('cells').select('id,name').order('name'),
          supabase.from('members').select('id,name').eq('onboarding_complete', true).not('whatsapp', 'is', null).order('name'),
        ]);
        setCells((cellsRes.data ?? []) as CellOption[]);
        setAllMembers((membersRes.data ?? []) as MemberOption[]);
        await loadHistory();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cellNameById = new Map(cells.map(c => [c.id, c.name]));

  useEffect(() => {
    (async () => {
      if (audience.type === 'specific') { setTargetCount(audience.member_ids.length); return; }
      const supabase = createClient();
      if (audience.type === 'cell') {
        if (!audience.cell_id) { setTargetCount(0); return; }
        const { count } = await supabase.from('cell_members').select('id', { count: 'exact', head: true }).eq('cell_id', audience.cell_id);
        setTargetCount(count ?? 0);
        return;
      }
      let q = supabase.from('members').select('id', { count: 'exact', head: true })
        .eq('onboarding_complete', true).not('whatsapp', 'is', null);
      if (audience.type === 'pillar') {
        if (audience.pillars.length === 0) { setTargetCount(0); return; }
        q = q.in('pillar', audience.pillars);
      } else if (audience.type === 'life_stage') {
        if (audience.stages.length === 0) { setTargetCount(0); return; }
        q = q.in('life_stage', audience.stages);
      }
      const { count } = await q;
      setTargetCount(count ?? 0);
    })();
  }, [audience]);

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

  const send = async () => {
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, audience }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? 'Failed to send'); setConfirming(false); return; }
      setResult({ sent: data.sent, failed: data.failed });
      setMessage('');
      setConfirming(false);
      await loadHistory();
    } catch {
      setErrorMsg('Failed to send. Check your connection and try again.');
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <>
        <AdminTopbar title="Messages" subtitle="Send a personalized WhatsApp message to members" />
        <AdminBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton h={200} /><Skeleton h={260} /><Skeleton h={160} />
          </div>
        </AdminBody>
      </>
    );
  }

  return (
    <>
      <AdminTopbar title="Messages" subtitle="Send a personalized WhatsApp message to members" />
      <AdminBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--navy-tint)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600 }}>
              <Icon name="check" size={14} /> Sent to {result.sent} member{result.sent === 1 ? '' : 's'}{result.failed > 0 ? ` · ${result.failed} failed` : ''}.
            </div>
          )}
          {errorMsg && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#c0392b', fontWeight: 600 }}>
              <Icon name="alertcircle" size={14} /> {errorMsg}
            </div>
          )}

          <Panel title="Compose">
            <Field label="Message" hint="Use {{name}} anywhere in the message to personalize it — e.g. Hi {{name}}, don't forget...">
              <TextInput value={message} onChange={v => { setMessage(v); setResult(null); }} placeholder="Write your message…" multiline rows={5} />
            </Field>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: -8 }}>{message.length} characters</div>
          </Panel>

          <Panel title="Audience">
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

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--ink)' }}>{targetCount}</strong> member{targetCount === 1 ? '' : 's'} will receive this message
              </div>
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!message.trim() || targetCount === 0}
                  className="btn btn-primary btn-sm"
                >
                  <Icon name="message" size={15} color="#fff" /> Send
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>Send to {targetCount} member{targetCount === 1 ? '' : 's'}?</span>
                  <button onClick={() => setConfirming(false)} disabled={sending} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={send} disabled={sending} className="btn btn-primary btn-sm">{sending ? 'Sending…' : 'Yes, send'}</button>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Recent messages">
            {history.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>No messages sent yet.</div>
            ) : (
              <div>
                <THead cols={['Sent', 'Message', 'Audience', 'Result']} template="120px 1fr 160px 140px" />
                {history.map(h => (
                  <TRow key={h.id} template="120px 1fr 160px 140px">
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span title={h.body}>{h.body}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{summarizeAudience(h.audience, h.audience?.type === 'cell' ? cellNameById.get(h.audience.cell_id) : undefined)}</span>
                    <span style={{ fontSize: 12.5 }}>
                      {h.sent_count} sent{h.failed_count > 0 ? `, ${h.failed_count} failed` : ''}
                    </span>
                  </TRow>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </AdminBody>
    </>
  );
}
