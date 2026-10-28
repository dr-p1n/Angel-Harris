import { HttpError } from './http.js';
import { bool, isImageUrl, mediaKey, normalizeEmbed, slugify, str } from './util.js';
import { STATUSES, cleanDate } from './work.js';

const cleanTags = (v) => {
  const raw = Array.isArray(v) ? v : String(v || '').split(',');
  const seen = new Set();
  for (const t of raw) {
    const s = String(t).trim().slice(0, 30);
    if (s) seen.add(s);
  }
  return [...seen].slice(0, 12).join(',');
};

export function cleanProject(b) {
  const title = str(b.title, 120, 'Title');
  if (!title) throw new HttpError(400, 'Title is required');
  const slug = slugify(b.slug || title);
  if (!slug) throw new HttpError(400, 'Slug is required');

  const media = (Array.isArray(b.media) ? b.media : []).slice(0, 60).map((m) => {
    const caption = str(m.caption, 300, 'Caption');
    if (m.kind === 'embed') {
      const url = normalizeEmbed(m.url);
      if (!url) throw new HttpError(400, 'Only Vimeo or YouTube links can be embedded');
      return { kind: 'embed', url, caption };
    }
    const url = String(m.url || '');
    if (!isImageUrl(url)) throw new HttpError(400, 'Invalid image URL');
    return { kind: 'image', url, caption };
  });

  const images = media.filter((m) => m.kind === 'image').map((m) => m.url);
  const cover = images.includes(b.cover_url) ? b.cover_url : images[0] || '';

  return {
    slug,
    title,
    category: slugify(str(b.category, 60, 'Category')),
    summary: str(b.summary, 400, 'Summary'),
    body: str(b.body, 8000, 'Description'),
    year: str(b.year, 10, 'Year'),
    client: str(b.client, 120, 'Client'),
    role: str(b.role, 120, 'Role'),
    tags: cleanTags(b.tags),
    cover_url: cover,
    featured: bool(b.featured),
    published: bool(b.published),
    status: STATUSES.includes(b.status) ? b.status : 'completed',
    progress: Math.min(100, Math.max(0, Math.round(Number(b.progress) || 0))),
    due_date: cleanDate(b.due_date, 'Due date'),
    media,
  };
}

// Statements that replace a project's media rows (run inside a db.batch for atomicity).
export const mediaStatements = (db, projectId, media) => [
  db.prepare('DELETE FROM project_media WHERE project_id = ?').bind(projectId),
  ...media.map((m, i) =>
    db
      .prepare('INSERT INTO project_media (project_id, kind, url, caption, position) VALUES (?, ?, ?, ?, ?)')
      .bind(projectId, m.kind, m.url, m.caption, i),
  ),
];

// R2 keys used by a project: media images plus cover.
export const uploadedKeys = (rows, cover) =>
  new Set([...rows.map((r) => r.url), cover].map((u) => mediaKey(u || '')).filter(Boolean));

// Deletes objects from R2 that are no longer referenced by any project.
export async function deleteOrphans(env, keys) {
  if (!env.MEDIA) return;
  for (const key of keys) {
    const used = await env.DB.prepare('SELECT 1 FROM project_media WHERE url = ? LIMIT 1').bind(`/media/${key}`).first();
    if (!used) await env.MEDIA.delete(key).catch(() => {});
  }
}
