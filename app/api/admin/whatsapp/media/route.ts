import { requireAdmin } from '@/lib/admin-auth';
import { storeMedia, signedMediaUrl, IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/whatsapp-media';

export const dynamic = 'force-dynamic';

// POST multipart { file } → { path, url }
// An image to attach to a WhatsApp message (Inbox reply or broadcast). The
// page shrinks big photos before uploading, so this stays under the limit.
export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Choose an image to attach.' }, { status: 400 });
  if (!IMAGE_TYPES.includes(file.type)) return Response.json({ error: 'Only JPG, PNG or WebP images can be sent.' }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: 'That image is too large (max 4 MB).' }, { status: 400 });

  try {
    const path = await storeMedia(a.db, await file.arrayBuffer(), file.type, 'out');
    return Response.json({ path, url: await signedMediaUrl(a.db, path) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
