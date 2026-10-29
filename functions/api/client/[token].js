import { HttpError, handle, json, requireDb } from '../../_lib/http.js';
import { clientPortalOn } from '../../_lib/features.js';

const TOKEN_RE = /^[a-f0-9]{32}$/;
const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };

// Read-only view of one project for its client. Knowing the link is the only credential,
// so unknown and malformed tokens get the same 404, and internal items are never returned.
export const onRequestGet = handle(async ({ env, params }) => {
  if (!clientPortalOn(env)) throw new HttpError(404, 'Not found');
  const db = requireDb(env);
  const token = String(params.token || '');
  const project = TOKEN_RE.test(token)
    ? await db
        .prepare('SELECT id, title, client, summary, status, progress, due_date, updated_at FROM projects WHERE share_token = ?')
        .bind(token)
        .first()
    : null;
  if (!project) throw new HttpError(404, 'Not found');

  const [m, d, u] = await Promise.all([
    db.prepare('SELECT title, due_date, done FROM milestones WHERE project_id = ? AND client_visible = 1 ORDER BY position, id').bind(project.id).all(),
    db.prepare('SELECT title, description, url, status FROM deliverables WHERE project_id = ? AND client_visible = 1 ORDER BY position, id').bind(project.id).all(),
    db.prepare('SELECT body, created_at FROM project_updates WHERE project_id = ? AND client_visible = 1 ORDER BY id DESC LIMIT 100').bind(project.id).all(),
  ]);

  const milestones = m.results.map((r) => ({ ...r, done: !!r.done }));
  const progress = milestones.length
    ? Math.round((milestones.filter((x) => x.done).length / milestones.length) * 100)
    : project.progress;

  return json(
    {
      project: { title: project.title, client: project.client, summary: project.summary, status: project.status, due_date: project.due_date, updated_at: project.updated_at, progress },
      milestones,
      deliverables: d.results,
      updates: u.results,
    },
    200,
    PRIVATE,
  );
});
