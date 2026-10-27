import { HttpError, handle } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/auth.js';

// Every /api/admin/* request must carry a valid Cloudflare Access identity.
// Writes additionally need our custom header and a same-origin request, which
// blocks cross-site form posts.
export const onRequest = handle(async (ctx) => {
  const { request, env } = ctx;
  ctx.data.admin = await requireAdmin(request, env);

  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-Requested-With') !== 'admin-ui' || (origin && origin !== new URL(request.url).origin)) {
      throw new HttpError(403, 'Cross-site request blocked');
    }
  }
  return ctx.next();
});
