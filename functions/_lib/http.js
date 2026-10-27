export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
      ...BASE_HEADERS,
      ...extra,
    },
  });
}

export const fail = (status, message) => json({ error: message }, status, { 'Cache-Control': 'no-store' });

// Wraps a handler so thrown HttpErrors become JSON error responses.
export const handle = (fn) => async (ctx) => {
  try {
    return await fn(ctx);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'Server error');
  }
};

export async function readJson(request, max = 512 * 1024) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    throw new HttpError(415, 'Expected application/json');
  }
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'Request too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function requireDb(env) {
  if (!env.DB) throw new HttpError(503, 'Database is not configured');
  return env.DB;
}

export const isUniqueError = (e) => /UNIQUE constraint/i.test(String(e && e.message));
