import { HttpError, handle, json, readJson, requireDb } from '../_lib/http.js';
import { httpUrlOrEmpty, str, visitorHash } from '../_lib/util.js';
import { newQuoteRef } from '../_lib/prints.js';
import { PROJECT_TYPES } from '../../assets/js/enquiry.js';

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const PER_VISITOR = 3; // enquiries per 15 minutes
const PER_HOUR = 60; // site-wide ceiling

// A visitor sends an animation brief. Saved under a random reference and emailed to Angel.
export const onRequestPost = handle(async ({ request, env, waitUntil }) => {
  const db = requireDb(env);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked');

  const b = await readJson(request, 16 * 1024);
  if (b.website || Date.now() - Number(b.t || 0) < 2000) return json({ ok: true, ref: 'AH-000000' }); // bots

  const name = str(b.name, 100, 'Name');
  const email = str(b.email, 200, 'Email');
  const projectType = str(b.project_type, 60, 'Project type');
  const scope = str(b.scope, 200, 'Length or scope');
  const deadline = str(b.deadline, 100, 'Deadline');
  const budget = str(b.budget, 100, 'Budget');
  const link = httpUrlOrEmpty(str(b.link, 500, 'Reference link'), 'Reference link');
  const notes = str(b.notes, 3000, 'Notes');
  if (!name) throw new HttpError(400, 'Please enter your name');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'That email address looks invalid');
  if (!PROJECT_TYPES.includes(projectType)) throw new HttpError(400, 'Please choose a project type');
  if (notes.length < 10) throw new HttpError(400, 'Please tell Angel a little more about the project');
  if ((notes.match(/https?:\/\//gi) || []).length > 2) throw new HttpError(400, 'Please include at most two links in the notes');

  const hash = await visitorHash(request, env);
  const recent = await db
    .prepare(
      `SELECT SUM(CASE WHEN ip_hash = ? AND created_at > datetime('now', '-15 minutes') THEN 1 ELSE 0 END) AS mine, COUNT(*) AS hour
         FROM enquiries WHERE created_at > datetime('now', '-1 hour')`,
    )
    .bind(hash)
    .first();
  if ((recent.mine || 0) >= PER_VISITOR || recent.hour >= PER_HOUR) {
    throw new HttpError(429, 'Too many requests right now. Please try again a little later.');
  }

  let ref;
  for (let attempt = 0; attempt < 5; attempt++) {
    ref = newQuoteRef();
    try {
      await db
        .prepare(
          `INSERT INTO enquiries (ref, name, email, project_type, scope, deadline, budget, link, notes, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(ref, name, email, projectType, scope, deadline, budget, link, notes, hash)
        .run();
      break;
    } catch (e) {
      if (attempt === 4 || !/UNIQUE/i.test(String(e.message))) throw e;
    }
  }

  const summary = [
    `Animation enquiry ${ref}`,
    `Type: ${projectType}`,
    scope ? `Length or scope: ${scope}` : null,
    deadline ? `Deadline: ${deadline}` : null,
    budget ? `Budget: ${budget}` : null,
    link ? `Reference: ${link}` : null,
    `\nNotes:\n${notes}`,
  ].filter(Boolean).join('\n');

  if (env.MAILER) {
    waitUntil(
      env.MAILER.fetch('https://mailer/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message: summary, subject: `Animation enquiry ${ref} from ${name}` }),
      }).catch((e) => console.error('notify failed', e)),
    );
  }
  return json({ ok: true, ref }, 201);
});
