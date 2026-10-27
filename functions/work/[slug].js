// Serves the project page shell at /work/:slug with per-project meta tags so
// shared links get a proper title and preview image. The page itself is
// rendered client-side from /api/projects/:slug.
export const onRequestGet = async ({ request, env, params }) => {
  const url = new URL(request.url);
  const shell = await env.ASSETS.fetch(new URL('/project', url));

  let row = null;
  try {
    row = await env.DB.prepare('SELECT title, summary, cover_url FROM projects WHERE slug = ? AND published = 1')
      .bind(String(params.slug))
      .first();
  } catch {
    /* no database yet: fall back to the plain shell */
  }

  const res = new Response(shell.body, { status: row ? 200 : 404, headers: shell.headers });
  if (!row) return res;

  const set = (attr, value) => ({ element: (e) => e.setAttribute(attr, value) });
  const abs = (u) => (u ? new URL(u, url).href : '');
  return new HTMLRewriter()
    .on('title', { element: (e) => e.setInnerContent(`${row.title} | Angel Harris`) })
    .on('meta[name="description"]', set('content', row.summary))
    .on('meta[property="og:title"]', set('content', row.title))
    .on('meta[property="og:description"]', set('content', row.summary))
    .on('meta[property="og:image"]', set('content', abs(row.cover_url)))
    .on('link[rel="canonical"]', set('href', `${url.origin}/work/${params.slug}`))
    .transform(res);
};
