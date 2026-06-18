'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@/components/sode/icons';
import { Toast, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, FilterChip } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';

interface AdvPost {
  id: string;
  title: string;
  caption: string | null;
  pillar: string | null;
  status: string;
  media_url: string | null;
  canonical_link: string | null;
  platform_source: string | null;
  target_platforms: string[] | null;
  published_at: string | null;
  expires_at: string | null;
  share_count: number;
  click_count: number;
  created_at: string;
  created_by: string | null;
}

const PLATFORM_SOURCES = [
  { key: 'instagram', icon: 'camera',   label: 'Instagram' },
  { key: 'whatsapp',  icon: 'message',  label: 'WhatsApp'  },
  { key: 'facebook',  icon: 'grid',     label: 'Facebook'  },
  { key: 'x',         icon: 'share',    label: 'X'         },
  { key: 'youtube',   icon: 'play',     label: 'YouTube'   },
  { key: 'original',  icon: 'sparkles', label: 'Original'  },
];

const PLATFORM_TAGS = ['Instagram', 'WhatsApp', 'X', 'LinkedIn', 'Facebook'];
const PILLARS_LIST  = ['spiritual', 'career', 'business', 'character'];
const DURATIONS = [
  { hours: 24,  label: '24 hours' },
  { hours: 48,  label: '48 hours' },
  { hours: 72,  label: '72 hours' },
  { hours: 168, label: '1 week'   },
  { hours: 0,   label: 'Always'   },
];
const FILTERS = ['all', 'live', 'draft', 'ended', 'archived'] as const;

function getStatus(p: AdvPost): 'live' | 'draft' | 'ended' | 'archived' {
  if (p.status === 'archived') return 'archived';
  if (p.status === 'published') {
    if (p.expires_at && new Date(p.expires_at) < new Date()) return 'ended';
    return 'live';
  }
  return 'draft';
}

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  live:     { bg: '#d1fae5',            color: '#065f46',       label: 'Live'     },
  draft:    { bg: 'var(--surface-2)',   color: 'var(--muted)',  label: 'Draft'    },
  ended:    { bg: 'var(--surface-2)',   color: 'var(--muted)',  label: 'Ended'    },
  archived: { bg: '#f3f4f6',            color: '#6b7280',       label: 'Archived' },
};

const fieldStyle: React.CSSProperties = {
  width: '100%', borderRadius: 9, border: '1.5px solid var(--line-2)',
  background: 'var(--surface)', fontSize: 13.5, fontFamily: 'var(--font)',
  color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', padding: '9px 12px',
};

export default function AdvocacyPage() {
  const [posts,    setPosts]   = useState<AdvPost[]>([]);
  const [filter,   setFilter]  = useState<typeof FILTERS[number]>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading,  setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [toast,    setToast]   = useState<ToastData | null>(null);

  // Editor fields
  const [editTitle,          setEditTitle]          = useState('');
  const [editCaption,        setEditCaption]        = useState('');
  const [editCanonicalLink,  setEditCanonicalLink]  = useState('');
  const [editMediaUrl,       setEditMediaUrl]       = useState('');
  const [editPlatformSource, setEditPlatformSource] = useState('');
  const [editPlatforms,      setEditPlatforms]      = useState<string[]>([]);
  const [editPillar,         setEditPillar]         = useState('');
  const [editExpiry,         setEditExpiry]         = useState(48);
  const [showUrlInput,       setShowUrlInput]       = useState(false);

  const autoSaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSave   = useRef(false);

  const selectedPost = posts.find(p => p.id === selectedId) ?? null;

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Load + realtime ──────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('advocacy_posts')
      .select('id,title,caption,status,pillar,platform_source,target_platforms,media_url,canonical_link,published_at,expires_at,share_count,click_count,created_at,created_by')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as AdvPost[];
    setPosts(rows);
    setLoading(false);
    return rows;
  }, []);

  useEffect(() => {
    loadPosts();
    const supabase = createClient();
    const ch = supabase.channel('admin-advocacy')
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'advocacy_posts' }, () => loadPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'advocacy_shares' }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPosts]);

  // ── Select post — populates editor ──────────────────────────────────────
  const selectPost = useCallback((post: AdvPost) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    skipAutoSave.current = true;
    setSelectedId(post.id);
    setEditTitle(post.title || '');
    setEditCaption(post.caption || '');
    setEditCanonicalLink(post.canonical_link || '');
    setEditMediaUrl(post.media_url || '');
    setEditPlatformSource(post.platform_source || '');
    setEditPlatforms(post.target_platforms || []);
    setEditPillar(post.pillar || '');
    setEditExpiry(48);
    setSaveState('saved');
    setShowUrlInput(false);
  }, []);

  // ── Auto-save (1 s debounce) ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    setSaveState('unsaved');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      const supabase = createClient();
      const patch = {
        title:            editTitle,
        caption:          editCaption,
        canonical_link:   editCanonicalLink  || null,
        media_url:        editMediaUrl       || null,
        platform_source:  editPlatformSource || null,
        target_platforms: editPlatforms,
        pillar:           editPillar         || null,
        updated_at:       new Date().toISOString(),
      };
      await supabase.from('advocacy_posts').update(patch).eq('id', selectedId);
      setPosts(ps => ps.map(p => p.id === selectedId ? { ...p, ...patch } : p));
      setSaveState('saved');
    }, 1000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editCaption, editCanonicalLink, editMediaUrl, editPlatformSource, editPlatforms, editPillar]);

  // ── New post ─────────────────────────────────────────────────────────────
  const handleNewPost = async () => {
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('No user session — please sign in again', 'x');
      setCreating(false);
      return;
    }
    // created_by references members.id (internal), not auth.users.id
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();
    const { data, error } = await supabase
      .from('advocacy_posts')
      .insert({
        title:      'Untitled post',
        caption:    '',
        status:     'draft',
        created_by: member?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      console.error('Create post error:', JSON.stringify(error, null, 2));
      showToast(`Failed to create post: ${error.message}`, 'x');
      setCreating(false);
      return;
    }
    const created = data as AdvPost;
    setPosts(ps => [created, ...ps]);
    selectPost(created);
    setFilter('all');
    setCreating(false);
  };

  // ── Publish ──────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!selectedId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const supabase = createClient();
    const expiresAt = editExpiry === 0
      ? null
      : new Date(Date.now() + editExpiry * 3600000).toISOString();
    const update = {
      title:            editTitle,
      caption:          editCaption,
      canonical_link:   editCanonicalLink  || null,
      media_url:        editMediaUrl       || null,
      platform_source:  editPlatformSource || null,
      target_platforms: editPlatforms,
      pillar:           editPillar         || null,
      status:           'published',
      published_at:     new Date().toISOString(),
      expires_at:       expiresAt,
      updated_at:       new Date().toISOString(),
    };
    const { error } = await supabase.from('advocacy_posts').update(update).eq('id', selectedId);
    if (!error) {
      setPosts(ps => ps.map(p => p.id === selectedId ? { ...p, ...update } : p));
      setSaveState('saved');
      showToast('Post published — visible to members now ✓', 'check');
    }
  };

  // ── Save draft ───────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!selectedId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const supabase = createClient();
    const patch = {
      title:            editTitle,
      caption:          editCaption,
      canonical_link:   editCanonicalLink  || null,
      media_url:        editMediaUrl       || null,
      platform_source:  editPlatformSource || null,
      target_platforms: editPlatforms,
      pillar:           editPillar         || null,
      updated_at:       new Date().toISOString(),
    };
    await supabase.from('advocacy_posts').update(patch).eq('id', selectedId);
    setPosts(ps => ps.map(p => p.id === selectedId ? { ...p, ...patch } : p));
    setSaveState('saved');
    showToast('Draft saved ✓', 'check');
  };

  // ── Unpublish ────────────────────────────────────────────────────────────
  const handleUnpublish = async () => {
    if (!selectedId) return;
    const supabase = createClient();
    const update = { status: 'draft', published_at: null, expires_at: null };
    await supabase.from('advocacy_posts').update(update).eq('id', selectedId);
    setPosts(ps => ps.map(p => p.id === selectedId ? { ...p, ...update } : p));
    showToast('Post unpublished — removed from member Share page', 'x');
  };

  // ── Archive ──────────────────────────────────────────────────────────────
  const handleArchive = async () => {
    if (!selectedId) return;
    const supabase = createClient();
    await supabase.from('advocacy_posts').update({ status: 'archived' }).eq('id', selectedId);
    setPosts(ps => ps.map(p => p.id === selectedId ? { ...p, status: 'archived' } : p));
    showToast('Post archived');
  };

  const filtered      = posts.filter(p => filter === 'all' || getStatus(p) === filter);
  const currentStatus = selectedPost ? getStatus(selectedPost) : 'draft';
  const isPublished   = currentStatus === 'live';

  return (
    <>
      <AdminTopbar
        title="Advocacy content"
        subtitle="Curate what members amplify"
        actions={
          <button onClick={handleNewPost} disabled={creating} className="btn btn-primary btn-sm">
            <Icon name="plus" size={16} stroke={2.4} color="#fff" />
            {creating ? 'Creating…' : '+ New post'}
          </button>
        }
      />
      <AdminBody>
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedPost ? '2fr 3fr' : '1fr',
          gap: 16,
          alignItems: 'start',
        }}>

          {/* ── LEFT: posts list ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <FilterChip
                  key={f}
                  active={filter === f}
                  label={f.charAt(0).toUpperCase() + f.slice(1)}
                  onClick={() => setFilter(f)}
                />
              ))}
            </div>

            <Panel pad={false}>
              {loading ? (
                <div style={{ padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>Loading posts…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Icon name="share" size={22} color="var(--faint)" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>No posts yet</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                    {filter !== 'all' ? `No ${filter} posts.` : "Click '+ New post' to create your first advocacy post"}
                  </p>
                  {filter === 'all' && (
                    <button onClick={handleNewPost} disabled={creating} className="btn btn-primary btn-sm">
                      <Icon name="plus" size={15} color="#fff" /> New post
                    </button>
                  )}
                </div>
              ) : filtered.map(po => {
                const active = selectedId === po.id;
                const s      = getStatus(po);
                const pill   = STATUS_PILL[s];
                return (
                  <div
                    key={po.id}
                    onClick={() => selectPost(po)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px', borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                      background:  active ? 'var(--navy-tint)' : 'transparent',
                      borderLeft:  active ? '3px solid var(--navy)' : '3px solid transparent',
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
                      {po.media_url
                        ? <img src={po.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name="share" size={18} color="var(--muted)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {po.title || 'Untitled post'}
                      </div>
                      <div className="tnum" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                        {po.share_count ?? 0} shares · {po.click_count ?? 0} clicks
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, background: pill.bg, color: pill.color, fontSize: 11.5, fontWeight: 700, flex: 'none' }}>
                      {pill.label}
                    </span>
                  </div>
                );
              })}
            </Panel>
          </div>

          {/* ── RIGHT: editor ────────────────────────────────────────────── */}
          {selectedPost && (
            <Panel
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    Post editor
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: saveState === 'saving' ? 'var(--navy)' : 'var(--muted)' }}>
                      {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : '● Unsaved'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4, display: 'flex', alignItems: 'center' }}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              }
            >
              {/* Thumbnail */}
              <div style={{ height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 12, position: 'relative', background: 'var(--surface-2)' }}>
                {editMediaUrl
                  ? <img src={editMediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'var(--navy)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Icon name="camera" size={28} color="rgba(255,255,255,.35)" />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', fontWeight: 600 }}>No thumbnail</span>
                    </div>}
                <button
                  type="button"
                  onClick={() => setShowUrlInput(v => !v)}
                  style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.55)', border: 'none', borderRadius: 7, padding: '5px 10px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Icon name="link" size={12} color="#fff" /> Replace media
                </button>
              </div>

              {showUrlInput && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    value={editMediaUrl}
                    onChange={e => setEditMediaUrl(e.target.value)}
                    placeholder="Paste image URL…"
                    autoFocus
                    style={{ ...fieldStyle, fontSize: 12.5 }}
                  />
                </div>
              )}

              {/* Content source */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Content source</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PLATFORM_SOURCES.map(ps => {
                    const active = editPlatformSource === ps.key;
                    return (
                      <button
                        key={ps.key}
                        type="button"
                        onClick={() => setEditPlatformSource(active ? '' : ps.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--navy)' : 'var(--line-2)'}`, background: active ? 'var(--navy)' : 'var(--surface)', fontSize: 12, fontWeight: 600, color: active ? '#fff' : 'var(--ink-2)', cursor: 'pointer' }}
                      >
                        <Icon name={ps.icon} size={13} color={active ? '#fff' : 'var(--muted)'} />
                        {ps.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Original post URL */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Original post URL</label>
                <input
                  type="text"
                  value={editCanonicalLink}
                  onChange={e => setEditCanonicalLink(e.target.value)}
                  placeholder="https://instagram.com/p/..."
                  style={{ ...fieldStyle, fontSize: 12.5 }}
                />
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>Members are redirected here when they click shared links</p>
              </div>

              {/* Title */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Post title"
                  style={{ ...fieldStyle, fontWeight: 600 }}
                />
              </div>

              {/* Caption */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Caption</label>
                <textarea
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                  placeholder="Suggested caption for members to use when sharing…"
                  rows={4}
                  style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>

              {/* Pillar */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Pillar</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {PILLARS_LIST.map(pl => {
                    const active = editPillar === pl;
                    return (
                      <button
                        key={pl}
                        type="button"
                        onClick={() => setEditPillar(active ? '' : pl)}
                        style={{ padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${active ? 'var(--navy)' : 'var(--line-2)'}`, background: active ? 'var(--navy)' : 'transparent', color: active ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                      >
                        {pl}
                      </button>
                    );
                  })}
                  {editPillar && (
                    <button
                      type="button"
                      onClick={() => setEditPillar('')}
                      style={{ padding: '4px 10px', borderRadius: 99, border: '1px solid var(--line)', background: 'transparent', color: 'var(--faint)', fontSize: 12, cursor: 'pointer' }}
                    >
                      None
                    </button>
                  )}
                </div>
              </div>

              {/* Share on (platforms) */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Share on</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {PLATFORM_TAGS.map(pt => {
                    const active = editPlatforms.includes(pt);
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setEditPlatforms(prev => active ? prev.filter(p => p !== pt) : [...prev, pt])}
                        style={{ padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${active ? 'var(--navy)' : 'var(--line-2)'}`, background: active ? 'var(--navy)' : 'transparent', color: active ? '#fff' : 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {pt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expiry */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Visible to members for</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DURATIONS.map(d => (
                    <button
                      key={d.hours}
                      type="button"
                      onClick={() => setEditExpiry(d.hours)}
                      style={{ padding: '5px 11px', borderRadius: 8, border: `1.5px solid ${editExpiry === d.hours ? 'var(--navy)' : 'var(--line-2)'}`, background: editExpiry === d.hours ? 'var(--navy)' : 'transparent', color: editExpiry === d.hours ? '#fff' : 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats row — published posts only */}
              {isPublished && (
                <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
                  {[
                    { v: String(selectedPost.share_count ?? 0), l: 'Shares' },
                    { v: String(selectedPost.click_count  ?? 0), l: 'Clicks' },
                    { v: STATUS_PILL[currentStatus]?.label ?? 'Draft', l: 'Status' },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>{s.v}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                {isPublished ? (
                  <>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleUnpublish}>
                      Unpublish
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--faint)' }} onClick={handleArchive}>
                      Archive
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleSaveDraft}>
                      Save draft
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePublish}>
                      Publish →
                    </button>
                  </>
                )}
              </div>
            </Panel>
          )}
        </div>
      </AdminBody>
      <Toast toast={toast} />
    </>
  );
}
