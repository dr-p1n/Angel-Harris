// Serves the client progress page shell at /client/:token. The page itself is rendered
// client-side from /api/client/:token. Responses are never cached or indexed, and send no
// Referer, so the private link can't leak through links on the page.
const TOKEN_RE = /^[a-f0-9]{32}$/;

export const onRequestGet = async ({ request, env, params }) => {
  const shell = await env.ASSETS.fetch(new URL('/client', request.url));

  let known = false;
  const token = String(params.token || '');
  if (TOKEN_RE.test(token)) {
    try {
      known = !!(await env.DB.prepare('SELECT 1 FROM projects WHERE share_token = ?').bind(token).first());
    } catch {
      /* no database yet: the page will show "not found" */
    }
  }

  const headers = new Headers(shell.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(shell.body, { status: known ? 200 : 404, headers });
};
