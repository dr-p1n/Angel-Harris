// Shared row -> API shaping and settings helpers.

export const PUBLIC_SETTINGS = ['tagline', 'about', 'location', 'email', 'instagram', 'behance', 'linkedin'];

export const splitList = (s, sep) => String(s || '').split(sep).map((x) => x.trim()).filter(Boolean);

export const effectiveProgress = (r) => (r.ms_total ? Math.round((r.ms_done / r.ms_total) * 100) : r.progress || 0);

// Workspace fields (status, progress, due date, client link) are admin-only.
export const shapeProject = (r, admin = false) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  category: r.category,
  summary: r.summary,
  body: r.body,
  year: r.year,
  client: r.client,
  role: r.role,
  tags: splitList(r.tags, ','),
  cover_url: r.cover_url,
  featured: !!r.featured,
  published: !!r.published,
  position: r.position,
  ...(admin
    ? {
        status: r.status,
        progress: r.progress,
        due_date: r.due_date,
        has_share: !!r.share_token,
        progress_effective: effectiveProgress(r),
      }
    : {}),
});

export const shapeService = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  details: splitList(r.details, '\n'),
  published: !!r.published,
  position: r.position,
});

export async function readSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const map = Object.fromEntries(results.map((r) => [r.key, r.value]));
  let categories = [];
  try {
    categories = JSON.parse(map.categories || '[]');
  } catch {
    /* ignore corrupt value */
  }
  delete map.categories;
  return { settings: map, categories };
}

export async function readMedia(db, projectId) {
  const { results } = await db
    .prepare('SELECT id, kind, url, caption, position FROM project_media WHERE project_id = ? ORDER BY position, id')
    .bind(projectId)
    .all();
  return results;
}
