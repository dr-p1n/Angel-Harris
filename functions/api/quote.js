import { HttpError, handle, json, readJson, requireDb } from '../_lib/http.js';
import { httpUrlOrEmpty, str } from '../_lib/util.js';
import { newQuoteRef, readPricing } from '../_lib/prints.js';
import { estimate } from '../../assets/js/pricing.js';

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const PER_VISITOR = 4; // requests per 15 minutes
const PER_HOUR = 60; // site-wide ceiling

async function visitorHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const data = new TextEncoder().encode(`${env.CONTACT_SALT || 'angel-harris'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A visitor asks for a print quote. The price is recomputed here from the stored price list,
// whatever the browser claims, and the request is saved under a random quote number.
export const onRequestPost = handle(async ({ request, env, waitUntil }) => {
  const db = requireDb(env);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked');

  const b = await readJson(request, 16 * 1024);
  if (b.website || Date.now() - Number(b.t || 0) < 2000) return json({ ok: true, ref: 'AH-000000' }); // bots

  const name = str(b.name, 100, 'Name');
  const email = str(b.email, 200, 'Email');
  const notes = str(b.notes, 2000, 'Notes');
  const fileUrl = httpUrlOrEmpty(str(b.file_url, 500, 'File link'), 'File link');
  if (!name) throw new HttpError(400, 'Please enter your name');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'That email address looks invalid');
  if ((notes.match(/https?:\/\//gi) || []).length > 2) throw new HttpError(400, 'Please include at most two links in the notes');

  const pricing = await readPricing(db);
  const est = estimate(pricing, { material: b.material, finish: b.finish, l: b.l, w: b.w, h: b.h, qty: b.qty, rush: !!b.rush });
  if (est.error) throw new HttpError(400, est.error);

  const hash = await visitorHash(request, env);
  const recent = await db
    .prepare(
      `SELECT SUM(CASE WHEN ip_hash = ? AND created_at > datetime('now', '-15 minutes') THEN 1 ELSE 0 END) AS mine, COUNT(*) AS hour
         FROM quotes WHERE created_at > datetime('now', '-1 hour')`,
    )
    .bind(hash)
    .first();
  if ((recent.mine || 0) >= PER_VISITOR || recent.hour >= PER_HOUR) {
    throw new HttpError(429, 'Too many requests right now. Please try again a little later.');
  }

  const size = `${Number(b.l)} x ${Number(b.w)} x ${Number(b.h)} mm`;
  let ref;
  for (let attempt = 0; attempt < 5; attempt++) {
    ref = newQuoteRef();
    try {
      await db
        .prepare(
          `INSERT INTO quotes (ref, name, email, material, finish, size, qty, rush, notes, file_url, est_low, est_high, details, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(ref, name, email, est.material, est.finish, size, est.qty, est.rush ? 1 : 0, notes, fileUrl, est.low, est.high, JSON.stringify(est), hash)
        .run();
      break;
    } catch (e) {
      if (attempt === 4 || !/UNIQUE/i.test(String(e.message))) throw e;
    }
  }

  const matLabel = pricing.materials.find((m) => m.id === est.material)?.label || est.material;
  const finLabel = pricing.finishes.find((f) => f.id === est.finish)?.label || est.finish;
  const summary = [
    `Quote ${ref}`,
    `Estimate: ${pricing.currency} ${est.low} to ${est.high} (midpoint ${est.total})`,
    `Material: ${matLabel}`,
    `Finish: ${finLabel}`,
    `Size: ${size}`,
    `Quantity: ${est.qty}${est.discount ? ` (${est.discount}% quantity discount)` : ''}`,
    est.rush ? 'Rush order: yes' : null,
    fileUrl ? `3D file: ${fileUrl}` : '3D file: none provided, Angel may need to model it',
    notes ? `\nNotes:\n${notes}` : null,
  ].filter(Boolean).join('\n');

  // Same route as contact messages: the request is already saved, so a failed email never blocks the visitor.
  if (env.MAILER) {
    waitUntil(
      env.MAILER.fetch('https://mailer/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message: summary, subject: `Print quote ${ref} from ${name}` }),
      }).catch((e) => console.error('notify failed', e)),
    );
  }
  return json({ ok: true, ref, low: est.low, high: est.high, currency: pricing.currency }, 201);
});
