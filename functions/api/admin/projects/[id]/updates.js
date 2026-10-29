import { HttpError, handle, intId, json, readJson, requireDb } from '../../../../_lib/http.js';
import { bool, str } from '../../../../_lib/util.js';

export const onRequestPost = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = intId(params.id);
  const b = await readJson(request);
  const body = str(b.body, 2000, 'Update');
  if (!body) throw new HttpError(400, 'Write something first');
  if (!(await db.prepare('SELECT 1 FROM projects WHERE id = ?').bind(id).first())) throw new HttpError(404, 'Project not found');

  const res = await db
    .prepare('INSERT INTO project_updates (project_id, body, client_visible) VALUES (?, ?, ?)')
    .bind(id, body, bool(b.client_visible))
    .run();
  await db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").bind(id).run();
  const row = await db
    .prepare('SELECT id, body, client_visible, created_at FROM project_updates WHERE id = ?')
    .bind(res.meta.last_row_id)
    .first();
  return json({ update: { ...row, client_visible: !!row.client_visible } }, 201);
});
