import { handle, json, requireDb } from '../../../_lib/http.js';

export const onRequestGet = handle(async ({ env }) => {
  const db = requireDb(env);
  const { results } = await db
    .prepare('SELECT id, name, email, message, is_read, created_at FROM messages ORDER BY id DESC LIMIT 500')
    .all();
  return json({
    messages: results.map((m) => ({ ...m, is_read: !!m.is_read })),
    unread: results.filter((m) => !m.is_read).length,
  });
});
