import { HttpError, json, readJson, requireDb } from './http.js';

// Shared by /projects/reorder and /services/reorder: body is { ids: [3, 1, 2] }.
export async function reorder(request, env, table) {
  const db = requireDb(env);
  const { ids } = await readJson(request);
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
    throw new HttpError(400, 'ids must be a list of integers');
  }
  await db.batch(ids.map((id, i) => db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).bind(i + 1, id)));
  return json({ ok: true });
}
