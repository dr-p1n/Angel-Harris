import { HttpError, handle, json } from '../../_lib/http.js';

const MAX_BYTES = 10 * 1024 * 1024;

// Identify the real image type from magic bytes rather than trusting the client.
function sniff(b) {
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', type: 'image/png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]/.test(ascii(8, 12))) return { ext: 'avif', type: 'image/avif' };
  return null;
}

export const onRequestPost = handle(async ({ request, env }) => {
  if (!env.MEDIA) throw new HttpError(503, 'Storage is not configured');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BYTES + 64 * 1024) throw new HttpError(413, 'Image is too large (max 10 MB)');

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'Expected a file upload');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'No file provided');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'Image is too large (max 10 MB)');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new HttpError(415, 'Only JPEG, PNG, WebP and AVIF images are allowed');

  const key = `u/${crypto.randomUUID()}.${kind.ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type } });
  return json({ url: `/media/${key}` }, 201);
});
