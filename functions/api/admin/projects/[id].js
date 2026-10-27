import { HttpError, handle, isUniqueError, json, readJson, requireDb } from '../../../_lib/http.js';
import { readMedia, shapeProject } from '../../../_lib/data.js';
import { cleanProject, deleteOrphans, mediaStatements, uploadedKeys } from '../../../_lib/projects.js';
import { bool } from '../../../_lib/util.js';

const getId = (params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid id');
  return id;
};

async function load(db, id) {
  const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Project not found');
  return row;
}

export const onRequestGet = handle(async ({ env, params }) => {
  const db = requireDb(env);
  const row = await load(db, getId(params));
  return json({ project: shapeProject(row), media: await readMedia(db, row.id) });
});

export const onRequestPut = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = getId(params);
  const before = await load(db, id);
  const oldMedia = await readMedia(db, id);
  const p = cleanProject(await readJson(request));

  try {
    await db.batch([
      db
        .prepare(
          `UPDATE projects SET slug = ?, title = ?, category = ?, summary = ?, body = ?, year = ?, client = ?,
             role = ?, tags = ?, cover_url = ?, featured = ?, published = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .bind(p.slug, p.title, p.category, p.summary, p.body, p.year, p.client, p.role, p.tags, p.cover_url, p.featured, p.published, id),
      ...mediaStatements(db, id, p.media),
    ]);
  } catch (e) {
    if (isUniqueError(e)) throw new HttpError(409, 'That slug is already used by another project');
    throw e;
  }

  const kept = uploadedKeys(p.media, p.cover_url);
  await deleteOrphans(env, [...uploadedKeys(oldMedia, before.cover_url)].filter((k) => !kept.has(k)));

  const row = await load(db, id);
  return json({ project: shapeProject(row), media: await readMedia(db, id) });
});

// Quick toggles from the project list.
export const onRequestPatch = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = getId(params);
  const b = await readJson(request);
  const sets = [];
  const vals = [];
  for (const k of ['published', 'featured']) {
    if (k in b) {
      sets.push(`${k} = ?`);
      vals.push(bool(b[k]));
    }
  }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const res = await db
    .prepare(`UPDATE projects SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...vals, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Project not found');
  return json({ project: shapeProject(await load(db, id)) });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  const db = requireDb(env);
  const id = getId(params);
  const row = await load(db, id);
  const keys = uploadedKeys(await readMedia(db, id), row.cover_url);
  await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
  await deleteOrphans(env, [...keys]);
  return json({ ok: true });
});
