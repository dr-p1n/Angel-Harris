import { HttpError, handle, intId, json, readJson, requireDb } from '../../../../_lib/http.js';
import { cleanWork, readWork, workStatements } from '../../../../_lib/work.js';

async function exists(db, id) {
  const row = await db.prepare('SELECT share_token FROM projects WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Project not found');
  return row;
}

export const onRequestGet = handle(async ({ env, params }) => {
  const db = requireDb(env);
  const id = intId(params.id);
  const { share_token } = await exists(db, id);
  return json({ ...(await readWork(db, id)), share_token: share_token || null });
});

export const onRequestPut = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = intId(params.id);
  await exists(db, id);
  const work = cleanWork(await readJson(request));
  await db.batch(workStatements(db, id, work));
  await db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return json(await readWork(db, id));
});
