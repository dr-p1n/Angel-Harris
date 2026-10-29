import { handle, json, readJson, requireDb } from '../../../_lib/http.js';
import { cleanTask } from '../../../_lib/tasks.js';

const SELECT = `SELECT t.*, p.title AS project_title FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`;

export const onRequestGet = handle(async ({ env }) => {
  // Open tasks plus recently finished ones, so the Done column stays useful but short.
  const { results } = await requireDb(env)
    .prepare(`${SELECT} WHERE t.status != 'done' OR t.done_at >= datetime('now', '-30 days') OR t.done_at = '' ORDER BY t.id DESC LIMIT 1000`)
    .all();
  return json({ tasks: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const db = requireDb(env);
  const t = cleanTask(await readJson(request));
  const res = await db
    .prepare('INSERT INTO tasks (title, notes, priority, status, due_date, recurrence, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(t.title, t.notes, t.priority, t.status, t.due_date, t.recurrence, t.project_id)
    .run();
  const task = await db.prepare(`${SELECT} WHERE t.id = ?`).bind(res.meta.last_row_id).first();
  return json({ task }, 201);
});
