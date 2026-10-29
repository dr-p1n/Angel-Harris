import { HttpError } from './http.js';
import { bool, str } from './util.js';

export const STATUSES = ['ongoing', 'on_hold', 'completed'];
export const DELIVERABLE_STATUSES = ['pending', 'delivered', 'approved'];

// '' or a real YYYY-MM-DD date.
export function cleanDate(v, field) {
  const s = v == null ? '' : String(v).trim();
  if (s === '') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new HttpError(400, `${field} must be a date (YYYY-MM-DD)`);
  }
  return s;
}

const cleanUrl = (v) => {
  const s = str(v, 500, 'Link');
  if (s && !/^https?:\/\/[^\s"'<>]+$/.test(s)) throw new HttpError(400, 'Deliverable links must start with http:// or https://');
  return s;
};

export function cleanWork(b) {
  const milestones = (Array.isArray(b.milestones) ? b.milestones : [])
    .slice(0, 60)
    .map((m) => ({
      title: str(m.title, 120, 'Milestone'),
      due_date: cleanDate(m.due_date, 'Milestone date'),
      done: bool(m.done),
      client_visible: bool(m.client_visible),
    }))
    .filter((m) => m.title);

  const deliverables = (Array.isArray(b.deliverables) ? b.deliverables : [])
    .slice(0, 60)
    .map((d) => ({
      title: str(d.title, 120, 'Deliverable'),
      description: str(d.description, 500, 'Deliverable description'),
      url: cleanUrl(d.url),
      status: DELIVERABLE_STATUSES.includes(d.status) ? d.status : 'pending',
      client_visible: bool(d.client_visible),
    }))
    .filter((d) => d.title);

  return { milestones, deliverables };
}

// Replace a project's milestones and deliverables (run inside db.batch).
export const workStatements = (db, projectId, { milestones, deliverables }) => [
  db.prepare('DELETE FROM milestones WHERE project_id = ?').bind(projectId),
  db.prepare('DELETE FROM deliverables WHERE project_id = ?').bind(projectId),
  ...milestones.map((m, i) =>
    db
      .prepare('INSERT INTO milestones (project_id, title, due_date, done, client_visible, position) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(projectId, m.title, m.due_date, m.done, m.client_visible, i),
  ),
  ...deliverables.map((d, i) =>
    db
      .prepare('INSERT INTO deliverables (project_id, title, description, url, status, client_visible, position) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(projectId, d.title, d.description, d.url, d.status, d.client_visible, i),
  ),
];

export async function readWork(db, projectId) {
  const [m, d, u] = await Promise.all([
    db.prepare('SELECT id, title, due_date, done, client_visible FROM milestones WHERE project_id = ? ORDER BY position, id').bind(projectId).all(),
    db.prepare('SELECT id, title, description, url, status, client_visible FROM deliverables WHERE project_id = ? ORDER BY position, id').bind(projectId).all(),
    db.prepare('SELECT id, body, client_visible, created_at FROM project_updates WHERE project_id = ? ORDER BY id DESC LIMIT 200').bind(projectId).all(),
  ]);
  const flag = (r) => ({ ...r, client_visible: !!r.client_visible });
  return {
    milestones: m.results.map((r) => ({ ...flag(r), done: !!r.done })),
    deliverables: d.results.map(flag),
    updates: u.results.map(flag),
  };
}

// Random unguessable token for the private client link (128 bits).
export const newToken = () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
