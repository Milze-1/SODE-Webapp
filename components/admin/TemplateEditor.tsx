'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MESSAGE_FIELDS } from '@/lib/message-fields';

// Message box where personal details ({{first_name}}, {{cell|your cell}}, …)
// show as pills instead of raw text. The value stays a plain template string,
// so sending and personalising are unchanged. Clicking a pill sets the word
// used when a member has no value for it (the fallback).

export interface TemplateEditorHandle { insertField: (key: string) => void; focus: () => void }

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  disabled?: boolean;
}

const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;
const CHIP_STYLE = 'display:inline-block;margin:0 1px;padding:0 7px;border-radius:999px;background:var(--navy-tint, #e8edf7);color:var(--navy, #1e2a5a);border:1px solid rgba(30,42,90,.18);font-size:.92em;font-weight:700;line-height:1.55;cursor:pointer;user-select:none;white-space:nowrap;vertical-align:baseline';

const fieldLabel = (key: string) => MESSAGE_FIELDS.find(f => f.key === key)?.label ?? key;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chipHtml(key: string, fallback?: string): string {
  const token = `{{${key}${fallback !== undefined && fallback !== '' ? `|${fallback}` : ''}}}`;
  const label = fieldLabel(key) + (fallback ? ` · or “${fallback}”` : '');
  return `<span contenteditable="false" data-token="${escapeHtml(token).replace(/"/g, '&quot;')}" data-key="${key}" title="Click to set a word for members with no ${escapeHtml(fieldLabel(key).toLowerCase())}, or remove" style="${CHIP_STYLE}">${escapeHtml(label)}</span>`;
}

// template string → editor HTML (known fields become pills; anything else stays text)
function toHtml(template: string): string {
  let html = '', last = 0;
  for (const m of Array.from(template.matchAll(TOKEN))) {
    const key = m[1].toLowerCase();
    if (!MESSAGE_FIELDS.some(f => f.key === key)) continue;
    html += escapeHtml(template.slice(last, m.index));
    html += chipHtml(key, m[2]?.trim());
    last = (m.index ?? 0) + m[0].length;
  }
  html += escapeHtml(template.slice(last));
  return html.replace(/\n/g, '<br>');
}

// editor DOM → template string
function serialize(root: Node): string {
  let out = '';
  root.childNodes.forEach((n, i) => {
    if (n.nodeType === Node.TEXT_NODE) { out += (n.textContent ?? '').replace(/ /g, ' '); return; }
    if (!(n instanceof HTMLElement)) return;
    if (n.dataset.token) { out += n.dataset.token; return; }
    if (n.tagName === 'BR') { out += '\n'; return; }
    const block = n.tagName === 'DIV' || n.tagName === 'P';
    if (block && i > 0 && !out.endsWith('\n')) out += '\n';
    out += serialize(n);
  });
  return out;
}

const TemplateEditor = forwardRef<TemplateEditorHandle, Props>(function TemplateEditor(
  { value, onChange, placeholder, minHeight = 120, maxHeight = 360, onKeyDown, disabled }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);

  // Re-render only when the value changes from outside (e.g. cleared after sending)
  useEffect(() => {
    if (!el.current || value === emitted.current) return;
    el.current.innerHTML = toHtml(value);
    emitted.current = value;
  }, [value]);

  const emit = useCallback(() => {
    if (!el.current) return;
    let v = serialize(el.current);
    if (v === '\n') v = '';
    emitted.current = v;
    onChange(v);
  }, [onChange]);

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && el.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  // Remember the cursor wherever it moves inside the box (typing, arrows, clicks),
  // so an insert button drops the pill exactly there
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && el.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const placeCaretAfter = (node: Node) => {
    const r = document.createRange();
    r.setStartAfter(node); r.collapse(true);
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
    savedRange.current = r.cloneRange();
  };

  useImperativeHandle(ref, () => ({
    focus: () => el.current?.focus(),
    insertField: (key: string) => {
      const root = el.current;
      if (!root) return;
      root.focus();
      let range = savedRange.current && root.contains(savedRange.current.startContainer) ? savedRange.current : null;
      if (!range) { range = document.createRange(); range.selectNodeContents(root); range.collapse(false); }
      range.deleteContents();
      const tmp = document.createElement('span');
      tmp.innerHTML = chipHtml(key);
      const chip = tmp.firstChild!;
      range.insertNode(chip);
      // a space after the pill so typing continues naturally
      const space = document.createTextNode(' ');
      chip.parentNode!.insertBefore(space, chip.nextSibling);
      placeCaretAfter(space);
      emit();
    },
  }), [emit]);

  // Click a pill → small panel to set its fallback word or remove it
  const [editing, setEditing] = useState<{ chip: HTMLElement; key: string; top: number; left: number } | null>(null);
  const [fallback, setFallback] = useState('');
  const onClick = (e: React.MouseEvent) => {
    const chip = (e.target as HTMLElement).closest('[data-token]') as HTMLElement | null;
    if (!chip || disabled || !wrap.current) return;
    const box = wrap.current.getBoundingClientRect(), r = chip.getBoundingClientRect();
    setFallback(/\|([^}]*)\}\}$/.exec(chip.dataset.token ?? '')?.[1] ?? '');
    setEditing({ chip, key: chip.dataset.key ?? '', top: r.bottom - box.top + 6, left: Math.max(0, Math.min(r.left - box.left, box.width - 280)) });
  };
  const saveFallback = () => {
    if (!editing) return;
    const tmp = document.createElement('span');
    tmp.innerHTML = chipHtml(editing.key, fallback.trim().replace(/[{}|]/g, ''));
    if (editing.chip.isConnected) editing.chip.replaceWith(tmp.firstChild!);
    setEditing(null);
    emit();
  };
  const removeChip = () => {
    if (editing?.chip.isConnected) editing.chip.remove();
    setEditing(null);
    emit();
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter') {
      // a plain line break, not a <div> per line
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // Typed {{first_name}} by hand → turn it into a pill when leaving the box
  const onBlur = () => {
    saveRange();
    const root = el.current;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let typed = false;
    for (let n = walker.nextNode(); n && !typed; n = walker.nextNode()) {
      typed = Array.from((n.textContent ?? '').matchAll(TOKEN)).some(m => MESSAGE_FIELDS.some(f => f.key === m[1].toLowerCase()));
    }
    if (typed) { root.innerHTML = toHtml(serialize(root)); savedRange.current = null; }
  };

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      {editing && (
        <div role="dialog" aria-label={`${fieldLabel(editing.key)} options`}
          style={{ position: 'absolute', zIndex: 20, top: editing.top, left: editing.left, width: 280, padding: 12, borderRadius: 10, background: 'var(--surface, #fff)', border: '1px solid var(--line-2)', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>If someone has no {fieldLabel(editing.key).toLowerCase()} on file, use:</div>
          <input autoFocus className="input" value={fallback} onChange={e => setFallback(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveFallback(); } if (e.key === 'Escape') setEditing(null); }}
            placeholder="e.g. your cell (or leave empty)" style={{ height: 34, fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={removeChip} className="btn btn-ghost btn-sm" style={{ marginRight: 'auto', color: '#c0392b' }}>Remove</button>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="button" onClick={saveFallback} className="btn btn-primary btn-sm">Save</button>
          </div>
        </div>
      )}
      {!value && placeholder && (
        <div aria-hidden style={{ position: 'absolute', top: 11, left: 14, right: 14, color: 'var(--faint)', fontSize: 13.5, lineHeight: 1.55, pointerEvents: 'none' }}>
          {placeholder}
        </div>
      )}
      <div
        ref={el}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? 'Message'}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onKeyDown={onKey}
        onKeyUp={saveRange}
        onMouseUp={saveRange}
        onBlur={onBlur}
        onPaste={onPaste}
        onClick={onClick}
        className="input slim-scroll"
        style={{ height: 'auto', minHeight, maxHeight, overflowY: 'auto', padding: '10px 14px', lineHeight: 1.55, fontSize: 13.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', outline: 'none' }}
      />
    </div>
  );
});

export default TemplateEditor;

// The "+ First name" row of insert buttons
export function FieldButtons({ onInsert, compact }: { onInsert: (key: string) => void; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: compact ? 5 : 6 }}>
      {!compact && <span style={{ fontSize: 11.5, color: 'var(--muted)', marginRight: 2 }}>Personalise — insert:</span>}
      {MESSAGE_FIELDS.map(f => (
        <button key={f.key} type="button" onMouseDown={e => e.preventDefault()} onClick={() => onInsert(f.key)} title={`Insert their ${f.label.toLowerCase()} — ${f.hint}`}
          style={{ padding: compact ? '3px 9px' : '4px 10px', borderRadius: 999, fontSize: compact ? 11.5 : 12, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line-2)' }}>
          + {f.label}
        </button>
      ))}
    </div>
  );
}
