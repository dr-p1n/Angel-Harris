import { handle, json, requireDb } from '../../_lib/http.js';
import { cleanDate } from '../../_lib/work.js';

// Everything with a date in [from, to], for the calendar view.
export const onRequestGet = handle(async ({ request, env }) => {
  const db = requireDb(env);
  const q = new URL(request.url).searchParams;
  const from = cleanDate(q.get('from'), 'from') || '0000-01-01';
  const to = cleanDate(q.get('to'), 'to') || '9999-12-31';

  const [tasks, milestones, projects] = await Promise.all([
    db.prepare(`SELECT id, title, priority, status, due_date, recurrence FROM tasks WHERE due_date != '' AND due_date BETWEEN ? AND ?`).bind(from, to).all(),
    db
      .prepare(
        `SELECT m.id, m.title, m.due_date, m.done, m.project_id, p.title AS project_title
           FROM milestones m JOIN projects p ON p.id = m.project_id
          WHERE m.due_date != '' AND m.due_date BETWEEN ? AND ?`,
      )
      .bind(from, to)
      .all(),
    db
      .prepare(`SELECT id, title, due_date, status FROM projects WHERE due_date != '' AND status != 'completed' AND due_date BETWEEN ? AND ?`)
      .bind(from, to)
      .all(),
  ]);
  return json({
    tasks: tasks.results,
    milestones: milestones.results.map((m) => ({ ...m, done: !!m.done })),
    projects: projects.results,
  });
});
