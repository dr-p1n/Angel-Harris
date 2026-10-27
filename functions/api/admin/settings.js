import { HttpError, handle, json, readJson, requireDb } from '../../_lib/http.js';
import { readSettings } from '../../_lib/data.js';
import { httpUrlOrEmpty, slugify, str } from '../../_lib/util.js';

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export const onRequestGet = handle(async ({ env }) => json(await readSettings(requireDb(env))));

export const onRequestPut = handle(async ({ request, env }) => {
  const db = requireDb(env);
  const b = await readJson(request);
  const s = b.settings || {};

  const email = str(s.email, 200, 'Email');
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Email address looks invalid');

  const values = {
    tagline: str(s.tagline, 160, 'Tagline'),
    about: str(s.about, 5000, 'About'),
    location: str(s.location, 120, 'Location'),
    email,
    instagram: httpUrlOrEmpty(s.instagram, 'Instagram'),
    behance: httpUrlOrEmpty(s.behance, 'Behance'),
    linkedin: httpUrlOrEmpty(s.linkedin, 'LinkedIn'),
  };

  const seen = new Set();
  const categories = (Array.isArray(b.categories) ? b.categories : [])
    .slice(0, 12)
    .map((c) => {
      const label = str(c.label, 40, 'Category');
      return { slug: slugify(c.slug || label), label };
    })
    .filter((c) => c.label && c.slug && !seen.has(c.slug) && seen.add(c.slug));
  values.categories = JSON.stringify(categories);

  await db.batch(
    Object.entries(values).map(([k, v]) =>
      db
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(k, v),
    ),
  );
  return json(await readSettings(db));
});
