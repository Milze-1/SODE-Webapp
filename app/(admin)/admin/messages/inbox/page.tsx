'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Avatar } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Skeleton } from '@/components/admin/chrome';
import MessagesTabs from '@/components/admin/MessagesTabs';
import { refreshWhatsAppUnread } from '@/lib/hooks/useWhatsAppUnread';

interface Conversation {
  contact: string; phone: string | null; member_id: string | null; name: string;
  last_body: string; last_direction: 'in' | 'out'; last_status: Message['delivery_status']; last_at: string; unread: number;
}
interface Message {
  id: string; direction: 'in' | 'out'; body: string; created_at: string; read_at: string | null;
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed' | null;
}

// WhatsApp-style ticks on messages SODE sent: ✓ sent · ✓✓ delivered · blue ✓✓ read
function Ticks({ status }: { status?: Message['delivery_status'] }) {
  if (status === 'failed') return <span title="Not delivered" style={{ color: '#c0392b', fontWeight: 800 }}>!</span>;
  const double = status === 'delivered' || status === 'read';
  const color = status === 'read' ? '#34b7f1' : '#8696a0';
  const label = status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent';
  return (
    <svg width={double ? 16 : 11} height="11" viewBox={double ? '0 0 16 11' : '0 0 11 11'} aria-label={label} role="img" style={{ verticalAlign: '-1px', flex: 'none' }}>
      <title>{label}</title>
      <path d="M1 6l3 3 6-7" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {double && <path d="M7 8.2l.8.8 6-7" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
interface ThreadMember { id: string; name: string; consent_contact: boolean }
interface MemberOption { id: string; name: string; contact: string; consent_contact: boolean }

function when(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function InboxPage() {
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<'needs' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [member, setMember] = useState<ThreadMember | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);

  useEffect(() => {
    fetch('/api/admin/whatsapp/inbox?contact=*members').then(r => r.ok ? r.json() : { members: [] })
      .then((j: { members: MemberOption[] }) => setMembers(j.members)).catch(() => {});
  }, []);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/whatsapp/inbox');
      if (!r.ok) { setMissingTable(r.status === 500); return; }
      const j = await r.json() as { conversations: Conversation[] };
      setConversations(j.conversations);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (contact: string, scroll = true) => {
    const r = await fetch(`/api/admin/whatsapp/inbox?contact=${encodeURIComponent(contact)}`).catch(() => null);
    if (!r?.ok) return;
    const j = await r.json() as { messages: Message[]; member: ThreadMember | null };
    setMessages(prev => {
      if (scroll || j.messages.length !== prev.length) setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 30);
      return j.messages;
    });
    setMember(j.member);
    setConversations(cs => cs.map(c => c.contact === contact ? { ...c, unread: 0 } : c));
    refreshWhatsAppUnread();
  }, []);

  // Open ?c=<contact> when linked directly (e.g. from a push notification)
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) setActive(c);
    loadList();
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadList(); }, 20_000);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!active) return;
    setMessages([]); setMember(null); setError(null); setReply('');
    loadThread(active);
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadThread(active, false); }, 10_000);
    return () => clearInterval(t);
  }, [active, loadThread]);

  const send = async () => {
    if (!active || !reply.trim()) return;
    setSending(true); setError(null);
    try {
      const r = await fetch('/api/admin/whatsapp/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: active, body: reply }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) { setError(j.error ?? 'Could not send'); return; }
      setReply('');
      await Promise.all([loadThread(active), loadList()]);
    } catch {
      setError('Could not send. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const markUnread = async () => {
    if (!active) return;
    await fetch('/api/admin/whatsapp/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: active, unread: true }) });
    setActive(null);
    await loadList();
    refreshWhatsAppUnread();
  };

  const needsReply = conversations.filter(c => c.unread > 0).length;
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const matches = (name: string, phone: string | null) =>
    !q || name.toLowerCase().includes(q) || (qDigits.length >= 3 && (phone ?? '').includes(qDigits));
  const shown = conversations
    .filter(c => filter === 'all' || c.unread > 0)
    .filter(c => matches(c.name, c.phone));
  // Members with no conversation yet — searching lets you start one
  const withChat = new Set(conversations.map(c => c.contact));
  const memberResults = q ? members.filter(m => !withChat.has(m.contact) && matches(m.name, m.contact)).slice(0, 30) : [];
  const current = conversations.find(c => c.contact === active);
  const activeMember = members.find(m => m.contact === active);

  return (
    <>
      <AdminTopbar title="Messages" subtitle="WhatsApp conversations with members" actions={<MessagesTabs />} />
      <AdminBody>
        {loading ? (
          <div style={{ display: 'flex', gap: 16 }}><div style={{ width: 320 }}><Skeleton h={420} /></div><div style={{ flex: 1 }}><Skeleton h={420} /></div></div>
        ) : missingTable ? (
          <div className="card" style={{ padding: 24, fontSize: 13, color: 'var(--muted)' }}>
            The inbox isn&apos;t ready yet — run <code>db/migrations/021_whatsapp_inbox.sql</code> in Supabase.
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', minHeight: 520, height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
            {/* Conversation list */}
            <div style={{ width: 330, flex: 'none', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: 12, borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or start a chat — name or number…" style={{ height: 36 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['all', 'All'], ['needs', `Needs reply${needsReply ? ` (${needsReply})` : ''}`]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === k ? 'var(--navy)' : 'var(--surface)', color: filter === k ? '#fff' : 'var(--ink-2)', border: filter === k ? '1px solid var(--navy)' : '1px solid var(--line-2)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="slim-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {shown.length === 0 && memberResults.length === 0 ? (
                  <div style={{ padding: '36px 18px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
                    {q ? 'No conversations or members match.'
                      : conversations.length === 0
                        ? 'No WhatsApp messages yet. Search for a member above to start a chat, or wait for someone to message the SODE number.'
                        : filter === 'needs' ? 'All caught up — nobody is waiting for a reply.' : 'No conversations yet.'}
                  </div>
                ) : shown.map(c => {
                  const sel = c.contact === active;
                  return (
                    <button key={c.contact} onClick={() => setActive(c.contact)} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '11px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)', background: sel ? 'var(--navy-tint)' : 'transparent' }}>
                      <Avatar name={c.name} size={36} tone="grey" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: c.unread ? 800 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: c.unread ? '#1fa855' : 'var(--faint)', fontWeight: c.unread ? 700 : 500, flex: 'none' }}>{when(c.last_at)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ flex: 1, fontSize: 12, color: c.unread ? 'var(--ink-2)' : 'var(--muted)', fontWeight: c.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.last_direction === 'out' && <><Ticks status={c.last_status} />{' '}</>}{c.last_body}
                          </span>
                          {c.unread > 0 && (
                            <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#25d366', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{c.unread}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {memberResults.length > 0 && (
                  <>
                    <div style={{ padding: '10px 12px 6px', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
                      Start a new chat
                    </div>
                    {memberResults.map(m => {
                      const off = !m.consent_contact;
                      return (
                        <button key={m.id} disabled={off} onClick={() => { setActive(m.contact); setSearch(''); }}
                          title={off ? 'WhatsApp alerts are off for this member (or they replied STOP), so you can’t message them first.' : `Message ${m.name}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--line)', background: 'transparent', cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.5 : 1 }}>
                          <Avatar name={m.name} size={32} tone="grey" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{off ? 'WhatsApp alerts off' : `+${m.contact}`}</div>
                          </div>
                          {!off && <Icon name="message" size={16} color="var(--navy)" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Thread */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
              {!active ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: 24 }}>
                  <Icon name="message" size={28} color="var(--faint)" />
                  <div style={{ marginTop: 8 }}>Pick a conversation to read and reply.</div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)' }}>
                    <Avatar name={member?.name ?? current?.name ?? activeMember?.name ?? '?'} size={34} tone="grey" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{member?.name ?? current?.name ?? activeMember?.name ?? 'Conversation'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {current?.phone ? `+${current.phone}` : /^\d{10,15}$/.test(active) ? `+${active}` : 'Number hidden by WhatsApp'}
                        {member ? (member.consent_contact ? ' · WhatsApp alerts on' : ' · WhatsApp alerts off') : ' · Not linked to a member'}
                      </div>
                    </div>
                    <button onClick={markUnread} className="btn btn-ghost btn-sm" title="Keep this in Needs reply">Mark unread</button>
                  </div>

                  <div className="slim-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {messages.map((m, i) => {
                      const mine = m.direction === 'out';
                      const newDay = i === 0 || new Date(messages[i - 1].created_at).toDateString() !== new Date(m.created_at).toDateString();
                      return (
                        <div key={m.id} style={{ display: 'contents' }}>
                          {newDay && (
                            <div style={{ alignSelf: 'center', fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', margin: '8px 0' }}>
                              {new Date(m.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </div>
                          )}
                          <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '72%', padding: '8px 11px 6px', borderRadius: mine ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: mine ? '#dcf8c6' : 'var(--surface)', border: mine ? 'none' : '1px solid var(--line)', color: '#111', fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.body}
                            <div style={{ fontSize: 10.5, color: '#667', marginTop: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                              {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {mine && <Ticks status={m.delivery_status} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {messages.length === 0 && (
                      <div style={{ margin: 'auto', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>
                        No messages yet — write the first one below.
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div style={{ padding: 12, borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
                    {error && <div style={{ fontSize: 12, color: '#c0392b', fontWeight: 600, marginBottom: 8 }}><Icon name="alertcircle" size={13} /> {error}</div>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                        placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)"
                        rows={2}
                        className="input"
                        style={{ flex: 1, height: 'auto', padding: '10px 12px', resize: 'none', lineHeight: 1.45 }}
                      />
                      <button onClick={send} disabled={sending || !reply.trim()} className="btn btn-primary btn-sm" style={{ height: 40 }}>
                        <Icon name="arrowright" size={15} color="#fff" /> {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </AdminBody>
    </>
  );
}
