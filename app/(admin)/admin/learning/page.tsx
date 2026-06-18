'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@/components/sode/icons';
import { Toggle, TextInput, OptionChips, Toast, Segmented, type ToastData } from '@/components/sode/ui';
import { AdminTopbar, AdminBody, Panel, THead, TRow } from '@/components/admin/chrome';
import { createClient } from '@/lib/supabase';
import { PILLAR_OPTIONS } from '@/lib/forms-audience';

const CONTENT_TYPES = [
  { value: 'article', label: 'Article', icon: 'list' },
  { value: 'video', label: 'Video', icon: 'camera' },
  { value: 'podcast', label: 'Podcast', icon: 'message' },
  { value: 'book', label: 'Book', icon: 'bookopen' },
  { value: 'course', label: 'Course', icon: 'sparkles' },
];
const TYPE_ICON: Record<string, string> = Object.fromEntries(CONTENT_TYPES.map(t => [t.value, t.icon]));
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface ContentRow {
  id: string; title: string; content_type: string; description: string | null;
  author: string | null; url: string | null; thumbnail_url: string | null;
  pillar: string | null; month_number: number | null; is_published: boolean;
  estimated_minutes: number | null; tags: string[] | null;
}

const emptyForm = {
  id: null as string | null,
  title: '', content_type: 'article', description: '', author: '', url: '',
  thumbnail_url: '', pillar: '', month_number: '', estimated_minutes: '',
  tags: '', is_published: false,
};

export default function LearningAdminPage() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('library');
  const [content, setContent] = useState<ContentRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('learning_content').select('id,title,content_type,description,author,url,thumbnail_url,pillar,month_number,is_published,estimated_minutes,tags').order('created_at', { ascending: false });
    setContent((data ?? []) as ContentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm); setShowModal(true); };
  const openEdit = (row: ContentRow) => {
    setForm({
      id: row.id, title: row.title, content_type: row.content_type, description: row.description ?? '',
      author: row.author ?? '', url: row.url ?? '', thumbnail_url: row.thumbnail_url ?? '',
      pillar: row.pillar ?? '', month_number: row.month_number != null ? String(row.month_number) : '',
      estimated_minutes: row.estimated_minutes != null ? String(row.estimated_minutes) : '',
      tags: (row.tags ?? []).join(', '), is_published: row.is_published,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        title: form.title.trim(),
        content_type: form.content_type,
        description: form.description.trim() || null,
        author: form.author.trim() || null,
        url: form.url.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        pillar: form.pillar || null,
        month_number: form.month_number ? Number(form.month_number) : null,
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        is_published: form.is_published,
        updated_at: new Date().toISOString(),
      };
      if (form.id) {
        await supabase.from('learning_content').update(payload).eq('id', form.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('learning_content').insert({ ...payload, created_by: user?.id });
      }
      showToast(form.id ? 'Content updated ✓' : 'Content added ✓', 'check');
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await createClient().from('learning_content').delete().eq('id', id);
    setContent(rows => rows.filter(r => r.id !== id));
    setDeleteConfirmId(null);
    showToast('Content removed', 'check');
  };

  const moveToMonth = async (id: string, month: number | null) => {
    setContent(rows => rows.map(r => r.id === id ? { ...r, month_number: month } : r));
    await createClient().from('learning_content').update({ month_number: month }).eq('id', id);
  };

  return (
    <>
      <AdminTopbar
        title="Learning"
        subtitle="Content library · schedule"
        actions={
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            <Icon name="pluscircle" size={16} color="#fff" /> Add content
          </button>
        }
      />
      <AdminBody>
        <div style={{ marginBottom: 16 }}>
          <Segmented options={[{ value: 'library', label: 'Content library' }, { value: 'schedule', label: 'Schedule' }]} value={tab} onChange={setTab} />
        </div>

        {loading ? (
          <div style={{ height: 200, borderRadius: 'var(--r-md)', background: 'rgba(0,0,0,.06)' }} />
        ) : tab === 'library' ? (
          <Panel pad={false}>
            <THead cols={['Title', 'Type', 'Pillar', 'Month', 'Status', 'Actions']} template="1.6fr .8fr .8fr .7fr .8fr .8fr" />
            {content.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No content yet — add your first piece.</div>
            ) : content.map(row => (
              <TRow key={row.id} template="1.6fr .8fr .8fr .7fr .8fr .8fr">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <Icon name={TYPE_ICON[row.content_type] ?? 'bookopen'} size={16} color="var(--muted)" /> {row.title}
                </div>
                <div style={{ textTransform: 'capitalize' }}>{row.content_type}</div>
                <div style={{ textTransform: 'capitalize' }}>{row.pillar ?? '—'}</div>
                <div className="tnum">{row.month_number ?? 'Always'}</div>
                <div style={{ color: row.is_published ? 'var(--navy)' : 'var(--muted)', fontWeight: 600 }}>{row.is_published ? 'Published' : 'Draft'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {deleteConfirmId === row.id ? (
                    <>
                      <button onClick={() => setDeleteConfirmId(null)} className="btn btn-ghost btn-sm" style={{ height: 26, fontSize: 11 }}>Cancel</button>
                      <button onClick={() => remove(row.id)} className="btn btn-primary btn-sm" style={{ height: 26, fontSize: 11 }}>Yes</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openEdit(row)} style={{ color: 'var(--muted)' }}><Icon name="pencil" size={16} /></button>
                      <button onClick={() => setDeleteConfirmId(row.id)} style={{ color: 'var(--muted)' }}><Icon name="x" size={16} /></button>
                    </>
                  )}
                </div>
              </TRow>
            ))}
          </Panel>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId) moveToMonth(dragId, null); setDragId(null); }}
              className="card"
              style={{ minHeight: 140, padding: 10, background: 'var(--navy-tint)' }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Always available</div>
              {content.filter(c => c.month_number == null).map(c => (
                <div key={c.id} draggable onDragStart={() => setDragId(c.id)} className="card card-pad" style={{ marginBottom: 6, padding: 8, fontSize: 12, fontWeight: 600, cursor: 'grab' }}>
                  {c.title}
                </div>
              ))}
            </div>
            {MONTHS.map(m => (
              <div
                key={m}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId) moveToMonth(dragId, m); setDragId(null); }}
                className="card"
                style={{ minHeight: 140, padding: 10 }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Month {m}</div>
                {content.filter(c => c.month_number === m).map(c => (
                  <div key={c.id} draggable onDragStart={() => setDragId(c.id)} className="card card-pad" style={{ marginBottom: 6, padding: 8, fontSize: 12, fontWeight: 600, cursor: 'grab' }}>
                    {c.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </AdminBody>

      {showModal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(17,20,28,.4)' }} />
          <div className="noscroll" style={{ position: 'relative', background: 'var(--bg)', borderRadius: 20, padding: 28, width: 460, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--sh-pop)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 16 }}>{form.id ? 'Edit content' : 'Add content'}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Type</label>
              <OptionChips options={CONTENT_TYPES} value={form.content_type} onChange={v => setForm(f => ({ ...f, content_type: v as string }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Title</label>
              <TextInput value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Content title" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Author</label>
                <TextInput value={form.author} onChange={v => setForm(f => ({ ...f, author: v }))} placeholder="Author / creator" />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Estimated time (min)</label>
                <input value={form.estimated_minutes} onChange={e => setForm(f => ({ ...f, estimated_minutes: e.target.value }))} type="number" className="input" style={{ width: '100%' }} placeholder="15" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Description</label>
              <TextInput value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline rows={3} placeholder="What is this content about?" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>URL</label>
              <TextInput value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://…" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Thumbnail URL</label>
              <TextInput value={form.thumbnail_url} onChange={v => setForm(f => ({ ...f, thumbnail_url: v }))} placeholder="https://…" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Pillar</label>
                <select value={form.pillar} onChange={e => setForm(f => ({ ...f, pillar: e.target.value }))} className="input" style={{ width: '100%' }}>
                  <option value="">All pillars</option>
                  {PILLAR_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Month</label>
                <select value={form.month_number} onChange={e => setForm(f => ({ ...f, month_number: e.target.value }))} className="input" style={{ width: '100%' }}>
                  <option value="">Always available</option>
                  {MONTHS.map(m => <option key={m} value={m}>Month {m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Tags (comma separated)</label>
              <TextInput value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="leadership, prayer, focus" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Published</span>
              <Toggle on={form.is_published} onChange={v => setForm(f => ({ ...f, is_published: v }))} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={save} disabled={saving || !form.title.trim()} className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add content'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}
