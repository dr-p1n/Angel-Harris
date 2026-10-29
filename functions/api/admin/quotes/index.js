import { handle, json, requireDb } from '../../../_lib/http.js';

export const onRequestGet = handle(async ({ env }) => {
  const { results } = await requireDb(env)
    .prepare(
      `SELECT id, ref, name, email, material, finish, size, qty, rush, notes, file_url, est_low, est_high, status, created_at
         FROM quotes ORDER BY id DESC LIMIT 500`,
    )
    .all();
  return json({
    quotes: results.map((q) => ({ ...q, rush: !!q.rush })),
    open: results.filter((q) => q.status === 'new').length,
  });
});
