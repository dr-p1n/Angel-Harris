// Serves uploaded images from R2. Keys are random UUIDs, so responses are immutable.
export const onRequestGet = async ({ request, env, params }) => {
  if (!env.MEDIA) return new Response('Storage is not configured', { status: 503 });
  const key = [].concat(params.path || []).join('/');
  if (!/^u\/[\w-]+\.(jpg|png|webp|avif)$/.test(key)) return new Response('Not found', { status: 404 });

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const etag = obj.httpEtag;
  const headers = {
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ETag: etag,
  };
  if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
};
