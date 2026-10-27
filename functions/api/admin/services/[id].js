import { HttpError, handle, json, readJson, requireDb } from '../../../_lib/http.js';
import { shapeService } from '../../../_lib/data.js';
import { cleanService } from '../../../_lib/services.js';

const getId = (params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid id');
  return id;
};

export const onRequestPut = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = getId(params);
  const s = cleanService(await readJson(request));
  const res = await db
    .prepare('UPDATE services SET title = ?, description = ?, details = ?, published = ? WHERE id = ?')
    .bind(s.title, s.description, s.details, s.published, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Service not found');
  const row = await db.prepare('SELECT * FROM services WHERE id = ?').bind(id).first();
  return json({ service: shapeService(row) });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  const res = await requireDb(env).prepare('DELETE FROM services WHERE id = ?').bind(getId(params)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Service not found');
  return json({ ok: true });
});
