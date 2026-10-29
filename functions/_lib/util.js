import { HttpError } from './http.js';

export const slugify = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export function str(v, max, field) {
  const s = v == null ? '' : String(v).trim();
  if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
  return s;
}

export const bool = (v) => (v ? 1 : 0);

// Accepts a Vimeo or YouTube page URL and returns its embeddable player URL.
export function normalizeEmbed(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  let m;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    m = u.pathname.match(/(\d{5,})/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/) || [])[1];
  }
  return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

// Only uploaded media, bundled assets, or https images are allowed as image URLs.
export const isImageUrl = (u) =>
  /^\/(media|assets)\/[\w./-]+$/.test(u) && !u.includes('..') || /^https:\/\/[^\s"'<>]+$/.test(u);

export const mediaKey = (url) => (url.startsWith('/media/') ? url.slice('/media/'.length) : null);

export const httpUrlOrEmpty = (v, field) => {
  const s = str(v, 300, field);
  if (s && !/^https?:\/\/[^\s"'<>]+$/.test(s)) throw new HttpError(400, `${field} must be a http(s) link`);
  return s;
};

// Visitors are identified only by a salted hash of their IP address, used for rate limiting.
export async function visitorHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const data = new TextEncoder().encode(`${env.CONTACT_SALT || 'angel-harris'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
