import { HttpError, handle, isUniqueError, json, readJson, requireDb } from '../../../_lib/http.js';
import { readMedia, shapeProject } from '../../../_lib/data.js';
import { cleanProject, mediaStatements } from '../../../_lib/projects.js';

export const onRequestGet = handle(async ({ env }) => {
  const { results } = await requireDb(env)
    .prepare('SELECT * FROM projects ORDER BY position, id')
    .all();
  return json({ projects: results.map(shapeProject) });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const db = requireDb(env);
  const p = cleanProject(await readJson(request));
  let id;
  try {
    const res = await db
      .prepare(
        `INSERT INTO projects (slug, title, category, summary, body, year, client, role, tags, cover_url, featured, published, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM projects))`,
      )
      .bind(p.slug, p.title, p.category, p.summary, p.body, p.year, p.client, p.role, p.tags, p.cover_url, p.featured, p.published)
      .run();
    id = res.meta.last_row_id;
  } catch (e) {
    if (isUniqueError(e)) throw new HttpError(409, 'That slug is already used by another project');
    throw e;
  }
  try {
    await db.batch(mediaStatements(db, id, p.media));
  } catch (e) {
    await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
    throw e;
  }
  const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  return json({ project: shapeProject(row), media: await readMedia(db, id) }, 201);
});
