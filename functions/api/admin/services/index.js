import { handle, json, readJson, requireDb } from '../../../_lib/http.js';
import { shapeService } from '../../../_lib/data.js';
import { cleanService } from '../../../_lib/services.js';

export const onRequestGet = handle(async ({ env }) => {
  const { results } = await requireDb(env).prepare('SELECT * FROM services ORDER BY position, id').all();
  return json({ services: results.map(shapeService) });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const db = requireDb(env);
  const s = cleanService(await readJson(request));
  const res = await db
    .prepare(
      `INSERT INTO services (title, description, details, published, position)
       VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM services))`,
    )
    .bind(s.title, s.description, s.details, s.published)
    .run();
  const row = await db.prepare('SELECT * FROM services WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ service: shapeService(row) }, 201);
});
