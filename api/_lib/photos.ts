// Photos uploaded in the admin dashboard. Stored privately in Vercel Blob and
// served through GET /api/photo?id=<sha256>, cached for a year: the ID is the
// hash of the file, so a given address always means the same image.

import { createHash } from 'node:crypto';
import { BlobNotFoundError, get, head, put } from '@vercel/blob';
import { hasBlobStore, json } from './http.js';

const MAX_BYTES = 1_500_000;
const PREFIX = 'photos/';

/** Recognises the image types we accept from their first bytes, not the declared type. */
export function sniffImageType(bytes: Uint8Array): 'image/webp' | 'image/jpeg' | 'image/png' | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  return null;
}

const dimension = (v: string | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 4000 ? n : null;
};

/** POST /api/admin?action=photo&width=…&height=… with the image as the body. Admin only (checked by the caller). */
export async function handlePhotoUpload(request: Request): Promise<Response> {
  if (!hasBlobStore()) return json({ error: 'No Blob store is connected, so photos can’t be uploaded.' }, 503);
  const url = new URL(request.url);
  const width = dimension(url.searchParams.get('width'));
  const height = dimension(url.searchParams.get('height'));
  if (!width || !height) return json({ error: 'Width and height are required.' }, 400);

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return json({ error: 'Photo is too large (max 1.5 MB).' }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_BYTES) return json({ error: 'Photo is too large (max 1.5 MB).' }, 413);
  const type = sniffImageType(bytes);
  if (!type) return json({ error: 'Only WebP, JPEG and PNG images can be uploaded.' }, 415);

  const id = createHash('sha256').update(bytes).digest('hex');
  const pathname = `${PREFIX}${id}`;
  // The same file uploaded twice is stored once.
  const exists = await head(pathname).then(
    () => true,
    err => (err instanceof BlobNotFoundError ? false : Promise.reject(err)),
  );
  if (!exists) await put(pathname, Buffer.from(bytes), { access: 'private', contentType: type });

  return json({ src: `/api/photo?id=${id}`, width, height }, 201);
}

/** GET /api/photo?id=<sha256>: serves an uploaded photo. */
export async function handlePhotoServe(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f]{64}$/.test(id)) return json({ error: 'Not found.' }, 404);
  if (!hasBlobStore()) return json({ error: 'Not found.' }, 404);
  const result = await get(`${PREFIX}${id}`, { access: 'private' }).catch(() => null);
  if (!result?.stream) return json({ error: 'Not found.' }, 404);
  const type = result.blob.contentType;
  if (!/^image\/(webp|jpeg|png)$/.test(type)) return json({ error: 'Not found.' }, 404);
  return new Response(result.stream, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
