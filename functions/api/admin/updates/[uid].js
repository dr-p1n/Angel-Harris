import { HttpError, handle, intId, json, readJson, requireDb } from '../../../_lib/http.js';
import { bool } from '../../../_lib/util.js';

export const onRequestPatch = handle(async ({ request, env, params }) => {
  const b = await readJson(request);
  const res = await requireDb(env)
    .prepare('UPDATE project_updates SET client_visible = ? WHERE id = ?')
    .bind(bool(b.client_visible), intId(params.uid))
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Update not found');
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  const res = await requireDb(env).prepare('DELETE FROM project_updates WHERE id = ?').bind(intId(params.uid)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Update not found');
  return json({ ok: true });
});
