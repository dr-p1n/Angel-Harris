import { HttpError, handle, intId, json, readJson, requireDb } from '../../../_lib/http.js';
import { TASK_STATUSES, cleanTask, nextDue, todayUtc } from '../../../_lib/tasks.js';

const SELECT = `SELECT t.*, p.title AS project_title FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`;

export const onRequestPut = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = intId(params.id);
  const t = cleanTask(await readJson(request));
  const res = await db
    .prepare(
      `UPDATE tasks SET title = ?, notes = ?, priority = ?, status = ?, due_date = ?, recurrence = ?, project_id = ?,
         done_at = CASE WHEN ? = 'done' THEN COALESCE(NULLIF(done_at, ''), datetime('now')) ELSE '' END WHERE id = ?`,
    )
    .bind(t.title, t.notes, t.priority, t.status, t.due_date, t.recurrence, t.project_id, t.status, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Task not found');
  return json({ task: await db.prepare(`${SELECT} WHERE t.id = ?`).bind(id).first() });
});

// Quick status change from the board. Completing a recurring task schedules its next
// occurrence instead of closing it.
export const onRequestPatch = handle(async ({ request, env, params }) => {
  const db = requireDb(env);
  const id = intId(params.id);
  const { status } = await readJson(request);
  if (!TASK_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  if (!task) throw new HttpError(404, 'Task not found');

  if (status === 'done' && task.recurrence !== 'none') {
    await db
      .prepare(`UPDATE tasks SET due_date = ?, status = 'todo', done_at = datetime('now') WHERE id = ?`)
      .bind(nextDue(task.due_date, task.recurrence, todayUtc()), id)
      .run();
  } else {
    await db
      .prepare(`UPDATE tasks SET status = ?, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE '' END WHERE id = ?`)
      .bind(status, status, id)
      .run();
  }
  return json({ task: await db.prepare(`${SELECT} WHERE t.id = ?`).bind(id).first(), advanced: status === 'done' && task.recurrence !== 'none' });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  const res = await requireDb(env).prepare('DELETE FROM tasks WHERE id = ?').bind(intId(params.id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Task not found');
  return json({ ok: true });
});
