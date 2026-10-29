import { handle, json, requireDb } from '../../../_lib/http.js';

export const onRequestGet = handle(async ({ env }) => {
  const { results } = await requireDb(env)
    .prepare(
      `SELECT id, ref, name, email, project_type, scope, deadline, budget, link, notes, status, created_at
         FROM enquiries ORDER BY id DESC LIMIT 500`,
    )
    .all();
  return json({ enquiries: results, open: results.filter((q) => q.status === 'new').length });
});
