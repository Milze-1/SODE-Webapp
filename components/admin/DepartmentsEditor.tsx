'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/sode/icons';
import { Panel } from '@/components/admin/chrome';
import { loadDepartments } from '@/lib/departments';

// Admin → Settings → Church departments: the list members pick from in their
// profile ("Department / serving"). Saved to app_settings.departments.
export default function DepartmentsEditor({ notify }: { notify: (msg: string, kind?: 'error') => void }) {
  const [list, setList] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadDepartments(true).then(l => { setList(l); setSaved(l); }).catch(() => setList([])); }, []);

  if (!list) return <Panel title="Church departments"><div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div></Panel>;

  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const move = (i: number, d: -1 | 1) => setList(l => { const n = [...l!]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const add = () => {
    const v = adding.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (list.some(x => x.toLowerCase() === v.toLowerCase())) { notify(`"${v}" is already on the list.`, 'error'); return; }
    // keep "Not yet" at the end
    const notYet = list.findIndex(x => x.toLowerCase() === 'not yet');
    setList(notYet >= 0 ? [...list.slice(0, notYet), v, ...list.slice(notYet)] : [...list, v]);
    setAdding('');
  };
  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/departments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ departments: list }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) as { error?: string; departments?: string[] } : {};
    setSaving(false);
    if (!res?.ok) { notify(json.error ?? 'Could not save departments.', 'error'); return; }
    const clean = json.departments ?? list;
    setList(clean); setSaved(clean);
    await loadDepartments(true);
    notify('Departments saved');
  };

  return (
    <Panel title="Church departments" pad={false}>
      <div style={{ padding: '10px 16px 4px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
        Members choose from this list in their profile. They can also type their own under &ldquo;Other&rdquo;.
      </div>
      <div style={{ padding: '6px 10px' }}>
        {list.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
            <input
              className="input" value={d} aria-label={`Department ${i + 1}`}
              onChange={e => setList(l => l!.map((x, j) => (j === i ? e.target.value : x)))}
              style={{ flex: 1, height: 34, fontSize: 13.5 }}
            />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" style={{ padding: 5, color: 'var(--muted)', opacity: i === 0 ? 0.3 : 1 }}><Icon name="arrowup" size={15} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down" style={{ padding: 5, color: 'var(--muted)', opacity: i === list.length - 1 ? 0.3 : 1 }}><Icon name="arrowdown" size={15} /></button>
            <button type="button" onClick={() => setList(l => l!.filter((_, j) => j !== i))} aria-label={`Remove ${d}`} style={{ padding: 5, color: '#c53030' }}><Icon name="x" size={15} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            className="input" value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a department…"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            style={{ flex: 1, height: 34, fontSize: 13.5 }}
          />
          <button type="button" onClick={add} className="btn btn-ghost btn-sm"><Icon name="plus" size={14} /> Add</button>
        </div>
      </div>
      <div style={{ padding: '10px 16px 14px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {dirty && <button type="button" onClick={() => setList(saved)} className="btn btn-ghost btn-sm">Undo changes</button>}
        <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Save departments'}</button>
      </div>
    </Panel>
  );
}
