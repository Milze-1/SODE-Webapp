'use client';
import { useRef } from 'react';
import { Icon } from '@/components/sode/icons';

// Attaching an image to a WhatsApp message (Inbox reply, broadcast).
// Big phone photos are shrunk in the browser first (longest side 1600 px,
// JPEG) so uploads are quick and stay under the server's 4 MB limit.

export interface Attachment { path: string; url: string | null; name: string }

const MAX_SIDE = 1600;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function shrink(file: File): Promise<Blob> {
  const small = file.size <= 1.5 * 1024 * 1024;
  if (small && OK_TYPES.includes(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('That file isn’t an image we can read. Try a JPG or PNG.');
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the image.');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background, as WhatsApp shows them
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not prepare the image.');
  return blob;
}

export async function uploadImage(file: File): Promise<Attachment> {
  if (!file.type.startsWith('image/')) throw new Error('Only images can be attached (JPG, PNG or WebP).');
  const blob = await shrink(file);
  const body = new FormData();
  const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg';
  body.append('file', blob instanceof File ? blob : new File([blob], name, { type: blob.type }));
  const r = await fetch('/api/admin/whatsapp/media', { method: 'POST', body });
  const j = await r.json().catch(() => ({})) as { path?: string; url?: string | null; error?: string };
  if (!r.ok || !j.path) throw new Error(j.error ?? 'Upload failed');
  return { path: j.path, url: j.url ?? null, name: file.name };
}

// 📎 button that opens the file picker
export function AttachButton({ onFile, disabled, label = 'Image' }: { onFile: (f: File) => void; disabled?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={disabled} className="btn btn-ghost btn-sm"
        title="Attach an image" aria-label="Attach an image" style={{ height: 40, whiteSpace: 'nowrap' }}>
        <Icon name="camera" size={15} /> {label}
      </button>
    </>
  );
}

// Thumbnail of the attached image with a remove ×
export function AttachmentPreview({ attachment, uploading, onRemove }: { attachment: Attachment | null; uploading: boolean; onRemove: () => void }) {
  if (!attachment && !uploading) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: 6, paddingRight: 10, borderRadius: 10, border: '1px solid var(--line-2)', background: 'var(--surface)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 7, overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        {uploading || !attachment?.url
          ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{uploading ? 'Uploading…' : '📷'}</span>
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={attachment.url} alt="Attached image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ minWidth: 0, maxWidth: 180 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment?.name ?? 'Image'}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{uploading ? 'Preparing…' : 'Your text becomes the caption'}</div>
      </div>
      {!uploading && (
        <button type="button" onClick={onRemove} aria-label="Remove image" title="Remove image"
          style={{ display: 'flex', padding: 4, borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--line-2)', cursor: 'pointer' }}>
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}
