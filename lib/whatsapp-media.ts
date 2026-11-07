import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';

// Images sent and received on WhatsApp live in the private `whatsapp-media`
// Storage bucket (paths saved on whatsapp_messages / whatsapp_queue /
// group_messages — db/migrations/023). Admin pages and the gateway only ever
// get short-lived signed links. Server-only.

type DB = ReturnType<typeof createAdminClient>;

export const MEDIA_BUCKET = 'whatsapp-media';
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit

let bucketReady = false;
async function ensureBucket(db: DB) {
  if (bucketReady) return;
  const { data } = await db.storage.getBucket(MEDIA_BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(MEDIA_BUCKET, { public: false, fileSizeLimit: 16 * 1024 * 1024 });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Storage: ${error.message}`);
  }
  bucketReady = true;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Store an image; returns its path in the bucket ("out/2026-11/…jpg").
export async function storeMedia(db: DB, bytes: ArrayBuffer | Buffer, mime: string, folder: 'out' | 'in'): Promise<string> {
  await ensureBucket(db);
  const month = new Date().toISOString().slice(0, 7);
  const path = `${folder}/${month}/${randomUUID()}.${EXT[mime] ?? 'bin'}`;
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function signedMediaUrl(db: DB, path: string, seconds = 3600): Promise<string | null> {
  const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function signedMediaUrls(db: DB, paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return out;
  const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(unique, seconds);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

// Paths we hand out are always ones this app created
export function isOurMediaPath(p: unknown): p is string {
  return typeof p === 'string' && /^(out|in)\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|bin)$/.test(p);
}
