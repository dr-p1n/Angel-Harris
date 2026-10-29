import { HttpError } from './http.js';

// Verifies the Cloudflare Access JWT on every admin request, so the API stays
// closed even if the Access policy is ever misconfigured. Fails closed when the
// ACCESS_TEAM_DOMAIN / ACCESS_AUD variables are missing.

const TEAM_RE = /^[a-z0-9-]+\.cloudflareaccess\.com$/;
let jwks = { at: 0, keys: null };

const b64u = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), (c) => c.charCodeAt(0));
};
const decodePart = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));

async function getKeys(team, force) {
  if (!force && jwks.keys && Date.now() - jwks.at < 3600e3) return jwks.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new HttpError(503, 'Auth keys unavailable');
  const { keys } = await res.json();
  jwks = { at: Date.now(), keys };
  return keys;
}

export async function requireAdmin(request, env) {
  const host = new URL(request.url).hostname;
  // Local `wrangler pages dev` only; a deployed site is never served on these hosts.
  if (host === 'localhost' || host === '127.0.0.1') return { email: 'dev@localhost' };

  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!team || !aud || !TEAM_RE.test(team)) throw new HttpError(503, 'Admin auth is not configured');

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new HttpError(401, 'Sign-in required');

  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) throw new Error('malformed');
    const header = decodePart(h);
    const payload = decodePart(p);
    if (header.alg !== 'RS256') throw new Error('alg');

    let jwk = (await getKeys(team)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await getKeys(team, true)).find((k) => k.kid === header.kid);
    if (!jwk) throw new Error('kid');

    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(`${h}.${p}`),
    );
    if (!ok) throw new Error('signature');

    const now = Math.floor(Date.now() / 1000);
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) throw new Error('aud');
    if (payload.iss !== `https://${team}`) throw new Error('iss');
    if (!payload.exp || payload.exp < now) throw new Error('exp');
    if (payload.nbf && payload.nbf > now + 60) throw new Error('nbf');

    return { email: String(payload.email || '') };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, 'Not authorised');
  }
}
