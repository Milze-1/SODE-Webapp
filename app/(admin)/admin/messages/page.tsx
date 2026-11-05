'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Icon } from '@/components/sode/icons';
import { TextInput } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow, Skeleton } from '@/components/admin/chrome';
import WhatsAppConnection from '@/components/admin/WhatsAppConnection';
import MessagesTabs from '@/components/admin/MessagesTabs';
import { MESSAGE_FIELDS, personalize, memberFieldValues, fieldsWithoutFallback, unknownFields, type PersonalizeMember } from '@/lib/message-fields';
import { summarizeAudience, PILLAR_OPTIONS, LIFE_STAGE_OPTIONS, type FormAudience } from '@/lib/forms-audience';

interface CellOption { id: string; name: string; }
interface MemberOption { id: string; name: string; whatsapp: string | null; consent_contact: boolean; }
type Person = PersonalizeMember & { id: string; consent_contact: boolean; pillar: string | null; cell_ids: string[] };

interface MessageRow {
  id: string;
  body: string;
  audience: FormAudience;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  pending_count?: number;
  created_at: string;
}

const AUDIENCE_TYPES: { key: FormAudience['type']; label: string; desc: string }[] = [
  { key: 'everyone', label: 'Everyone', desc: 'All members with a WhatsApp number who allow WhatsApp messages' },
  { key: 'specific', label: 'Selected people', desc: 'Tick the individual members you want to message' },
  { key: 'pillar', label: 'By pillar', desc: 'Members whose primary pillar matches' },
  { key: 'life_stage', label: 'By life stage', desc: 'Members at a matching life stage' },
  { key: 'cell', label: 'By cell', desc: 'Members of one cell group' },
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
  const [result, setResult] = useState<{ queued: number; minutes: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<MessageRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [previewId, setPreviewId] = useState<string>('');
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const loadHistory = async () => {
    const r = await fetch('/api/admin/messages/send').catch(() => null);
    const j = r?.ok ? await r.json() as { history: MessageRow[] } : { history: [] };
    setHistory(j.history);
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const [cellsRes, membersRes] = await Promise.all([
          supabase.from('cells').select('id,name').order('name'),
          supabase.from('members').select('id,name,whatsapp,consent_contact').eq('onboarding_complete', true).not('whatsapp', 'is', null).order('name'),
        ]);
        setCells((cellsRes.data ?? []) as CellOption[]);
        setAllMembers((membersRes.data ?? []) as MemberOption[]);
        // Opened from Admin → Members bulk "Message": preselect those members
        const preset = new URLSearchParams(window.location.search).get('members');
        if (preset) {
          const ids = preset.split(',').filter(Boolean);
          if (ids.length) setAudience({ type: 'specific', member_ids: ids });
        }
        await Promise.all([
          loadHistory(),
          fetch('/api/admin/messages/send?people=1').then(r => r.ok ? r.json() : { people: [] })
            .then((j: { people: Person[] }) => setPeople(j.people)).catch(() => {}),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cellNameById = new Map(cells.map(c => [c.id, c.name]));

  // Who this message would go to (mirrors the server's audience rules) — for
  // the preview and the "missing details" warning
  const recipients = people.filter(p => {
    if (!p.consent_contact) return false;
    switch (audience.type) {
      case 'specific': return audience.member_ids.includes(p.id);
      case 'pillar': return !!p.pillar && audience.pillars.includes(p.pillar);
      case 'life_stage': return !!p.life_stage && audience.stages.includes(p.life_stage);
      case 'cell': return !!audience.cell_id && p.cell_ids.includes(audience.cell_id);
      default: return true;
    }
  });
  const previewPerson = recipients.find(p => p.id === previewId) ?? recipients[0] ?? null;
  const missing = fieldsWithoutFallback(message)
    .map(key => ({ key, label: MESSAGE_FIELDS.find(f => f.key === key)?.label ?? key, count: recipients.filter(p => !memberFieldValues(p)[key]).length }))
    .filter(x => x.count > 0);
  const unknown = unknownFields(message);

  // Put {{field}} where the cursor is
  const insertField = (key: string) => {
    const el = messageRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? message.length, end = el?.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next); setResult(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };
  const anySending = history.some(h => (h.pending_count ?? 0) > 0);
  useEffect(() => {
    if (!anySending) return;
    const t = setInterval(loadHistory, 15_000);
    return () => clearInterval(t);
  }, [anySending]);

  const stopBroadcast = async (id: string) => {
    if (!window.confirm('Stop the rest of this broadcast? Messages already sent stay sent.')) return;
    await fetch('/api/admin/messages/send', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    loadHistory();
  };

  useEffect(() => {
    (async () => {
      if (audience.type === 'specific') { setTargetCount(audience.member_ids.length); return; }
      const supabase = createClient();
      if (audience.type === 'cell') {
        if (!audience.cell_id) { setTargetCount(0); return; }
        const { data: cm } = await supabase.from('cell_members').select('member_id').eq('cell_id', audience.cell_id);
        const ids = ((cm ?? []) as { member_id: string }[]).map(x => x.member_id);
        if (ids.length === 0) { setTargetCount(0); return; }
        const { count } = await supabase.from('members').select('id', { count: 'exact', head: true })
          .in('id', ids).eq('onboarding_complete', true).eq('consent_contact', true).not('whatsapp', 'is', null);
        setTargetCount(count ?? 0);
        return;
      }
      let q = supabase.from('members').select('id', { count: 'exact', head: true })
        .eq('onboarding_complete', true).eq('consent_contact', true).not('whatsapp', 'is', null);
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
  const toggleSpecificMember = (id: string) => setAudience(a => a.type === 'specific'
    ? { type: 'specific', member_ids: a.member_ids.includes(id) ? a.member_ids.filter(m => m !== id) : [...a.member_ids, id] }
    : a);

  // Picker list: search by name or phone digits; members with alerts off are shown but can't be picked
  const q = memberSearch.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const shownMembers = allMembers.filter(m => !q
    || m.name.toLowerCase().includes(q)
    || (qDigits.length >= 3 && (m.whatsapp ?? '').replace(/\D/g, '').includes(qDigits)));
  const selectableShown = shownMembers.filter(m => m.consent_contact);
  const selectAllShown = () => setAudience(a => a.type === 'specific'
    ? { type: 'specific', member_ids: Array.from(new Set([...a.member_ids, ...selectableShown.map(m => m.id)])) }
    : a);

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
      setResult({ queued: data.queued, minutes: data.minutes });
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
        <AdminTopbar title="Messages" subtitle="WhatsApp broadcasts to members who opted in" />
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
      <AdminTopbar title="Messages" subtitle="WhatsApp messages to members who opted in" actions={<MessagesTabs />} />
      <AdminBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--navy-tint)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600 }}>
              <Icon name="check" size={14} /> {result.queued} message{result.queued === 1 ? '' : 's'} queued — sending at a steady pace, about {result.minutes} minute{result.minutes === 1 ? '' : 's'} in total. Progress shows below.
            </div>
          )}
          {errorMsg && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#c0392b', fontWeight: 600 }}>
              <Icon name="alertcircle" size={14} /> {errorMsg}
            </div>
          )}

          <WhatsAppConnection />

          <Panel title="Compose">
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Message</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', marginRight: 2 }}>Personalise — insert:</span>
              {MESSAGE_FIELDS.map(f => (
                <button key={f.key} type="button" onClick={() => insertField(f.key)} title={`Adds {{${f.key}}} — ${f.hint}`}
                  style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line-2)' }}>
                  + {f.label}
                </button>
              ))}
            </div>
            <textarea
              ref={messageRef}
              value={message}
              onChange={e => { setMessage(e.target.value); setResult(null); }}
              placeholder={'Hi {{first_name}}, thank you for serving in {{department|your department}}…'}
              rows={6}
              className="input"
              style={{ width: '100%', height: 'auto', padding: '12px 14px', resize: 'vertical', lineHeight: 1.45 }}
            />
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>
              {message.length} characters · Each person gets their own copy. Add a fallback for blank details with <code>{'{{cell|your cell}}'}</code>.
            </div>

            {unknown.length > 0 && (
              <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#c0392b' }}>
                Not a known detail: {unknown.map(u => `{{${u}}}`).join(', ')} — it will be sent exactly as typed. Use the buttons above.
              </div>
            )}
            {missing.length > 0 && (
              <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                {missing.map(m => (
                  <div key={m.key}>
                    <strong>{m.count}</strong> of {recipients.length} recipients have no {m.label.toLowerCase()} on file — that spot will be blank.
                    {' '}Try <code>{`{{${m.key}|…}}`}</code> with a fallback word.
                  </div>
                ))}
              </div>
            )}

            {message.trim() && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Preview as</span>
                  {recipients.length > 0 ? (
                    <select className="input" value={previewPerson?.id ?? ''} onChange={e => setPreviewId(e.target.value)} style={{ height: 32, maxWidth: 240, fontSize: 12.5, padding: '0 8px' }}>
                      {recipients.slice(0, 300).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--faint)' }}>an example member (pick an audience to see real people)</span>
                  )}
                </div>
                <div style={{ maxWidth: 380, padding: '10px 12px', borderRadius: '12px 12px 12px 4px', background: '#dcf8c6', color: '#111', fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                  {personalize(message, previewPerson ?? { name: 'Ada Obi', cell: 'Victory Cell', department: 'Choir', life_stage: 'professional', career_stage: 'Building (3–7 yrs)', industry: 'Technology', points: 120 })}
                  {'\n\n'}<i>Reply STOP to stop these messages.</i>
                </div>
              </div>
            )}
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
                      <div style={{ marginTop: 8, marginLeft: 32, maxWidth: 520 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <TextInput value={memberSearch} onChange={setMemberSearch} placeholder="Search by name or number…" />
                          </div>
                          <button onClick={selectAllShown} disabled={selectableShown.length === 0} className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}>
                            Select {memberSearch.trim() ? 'shown' : 'all'} ({selectableShown.length})
                          </button>
                          {audience.member_ids.length > 0 && (
                            <button onClick={() => setAudience({ type: 'specific', member_ids: [] })} className="btn btn-ghost btn-sm">Clear</button>
                          )}
                        </div>
                        <div className="slim-scroll" style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 10, background: 'var(--surface)' }}>
                          {shownMembers.length === 0 ? (
                            <div style={{ padding: '16px 12px', fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>No members match.</div>
                          ) : shownMembers.map(m => {
                            const checked = audience.member_ids.includes(m.id);
                            const off = !m.consent_contact;
                            return (
                              <label key={m.id} title={off ? 'This member has WhatsApp alerts switched off (or replied STOP), so broadcasts skip them.' : undefined}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--line)', cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.55 : 1, background: checked ? 'var(--navy-tint)' : 'transparent' }}>
                                <input type="checkbox" checked={checked} disabled={off} onChange={() => toggleSpecificMember(m.id)} style={{ width: 16, height: 16, accentColor: 'var(--navy)' }} />
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                                <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>{off ? 'WhatsApp alerts off' : m.whatsapp}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                          <strong style={{ color: 'var(--ink)' }}>{audience.member_ids.length}</strong> selected
                          {audience.member_ids.length > 0 && <> · {audience.member_ids.slice(0, 4).map(id => allMembers.find(x => x.id === id)?.name.split(' ')[0] ?? '…').join(', ')}{audience.member_ids.length > 4 ? ` +${audience.member_ids.length - 4} more` : ''}</>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--ink)' }}>{targetCount}</strong> member{targetCount === 1 ? '' : 's'} will receive this message
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)' }}>Only members who allow WhatsApp messages are included.</span>
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
                  <button onClick={send} disabled={sending} className="btn btn-primary btn-sm">{sending ? 'Queueing…' : 'Yes, send'}</button>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Recent messages">
            {history.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>No messages sent yet.</div>
            ) : (
              <div>
                <THead cols={['Sent', 'Message', 'Audience', 'Progress']} template="120px 1fr 160px 190px" />
                {history.map(h => (
                  <TRow key={h.id} template="120px 1fr 160px 190px">
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span title={h.body}>{h.body}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{summarizeAudience(h.audience, h.audience?.type === 'cell' ? cellNameById.get(h.audience.cell_id) : undefined)}</span>
                    <span style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{h.sent_count}/{h.recipient_count} sent{h.failed_count > 0 ? ` · ${h.failed_count} failed` : ''}{(h.pending_count ?? 0) > 0 ? ` · ${h.pending_count} waiting` : ''}</span>
                      {(h.pending_count ?? 0) > 0 && (
                        <button onClick={() => stopBroadcast(h.id)} className="btn btn-ghost btn-sm" style={{ height: 26, padding: '0 8px', fontSize: 11.5 }}>Stop</button>
                      )}
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
