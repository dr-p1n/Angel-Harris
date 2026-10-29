import { HttpError, handle, json, readJson, requireDb } from '../_lib/http.js';
import { str, visitorHash } from '../_lib/util.js';

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const PER_VISITOR = 3; // messages per 15 minutes
const PER_HOUR = 60; // site-wide ceiling, protects the inbox from floods

export const onRequestPost = handle(async ({ request, env, waitUntil }) => {
  const db = requireDb(env);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked');

  const b = await readJson(request, 16 * 1024);

  // Bots fill the hidden field or submit instantly: pretend it worked, store nothing.
  if (b.website || Date.now() - Number(b.t || 0) < 2000) return json({ ok: true });

  const name = str(b.name, 100, 'Name');
  const email = str(b.email, 200, 'Email');
  const message = str(b.message, 4000, 'Message');
  if (!name) throw new HttpError(400, 'Please enter your name');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'That email address looks invalid');
  if (message.length < 10) throw new HttpError(400, 'Please write a slightly longer message');
  if ((message.match(/https?:\/\//gi) || []).length > 2) throw new HttpError(400, 'Please include at most two links');

  const hash = await visitorHash(request, env);
  const recent = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN ip_hash = ? AND created_at > datetime('now', '-15 minutes') THEN 1 ELSE 0 END) AS mine,
         COUNT(*) AS hour
       FROM messages WHERE created_at > datetime('now', '-1 hour')`,
    )
    .bind(hash)
    .first();
  if ((recent.mine || 0) >= PER_VISITOR || recent.hour >= PER_HOUR) {
    throw new HttpError(429, 'Too many messages right now. Please try again a little later.');
  }

  await db
    .prepare('INSERT INTO messages (name, email, message, ip_hash) VALUES (?, ?, ?, ?)')
    .bind(name, email, message, hash)
    .run();

  // Email Angel through the mailer Worker (service binding). The message is already
  // saved, so a failed or missing notification never affects the visitor.
  if (env.MAILER) {
    waitUntil(
      env.MAILER.fetch('https://mailer/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      }).catch((e) => console.error('notify failed', e)),
    );
  }
  return json({ ok: true }, 201);
});
