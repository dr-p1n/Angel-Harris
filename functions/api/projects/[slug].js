import { HttpError, handle, json, requireDb } from '../../_lib/http.js';
import { readMedia, shapeProject } from '../../_lib/data.js';

export const onRequestGet = handle(async ({ env, params }) => {
  const db = requireDb(env);
  const row = await db.prepare('SELECT * FROM projects WHERE slug = ? AND published = 1').bind(params.slug).first();
  if (!row) throw new HttpError(404, 'Project not found');

  const [media, { results: order }] = await Promise.all([
    readMedia(db, row.id),
    db.prepare('SELECT slug, title, cover_url FROM projects WHERE published = 1 ORDER BY position, id').all(),
  ]);

  // prev/next wrap around so the pager always has somewhere to go.
  const i = order.findIndex((o) => o.slug === row.slug);
  const prev = order.length > 1 ? order[(i - 1 + order.length) % order.length] : null;
  const next = order.length > 1 ? order[(i + 1) % order.length] : null;

  return json({ project: shapeProject(row), media, prev, next });
});
