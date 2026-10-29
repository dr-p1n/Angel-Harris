// Shared row -> API shaping and settings helpers.

export const PUBLIC_SETTINGS = ['tagline', 'about', 'location', 'email', 'instagram', 'behance', 'linkedin'];

export const splitList = (s, sep) => String(s || '').split(sep).map((x) => x.trim()).filter(Boolean);

export const effectiveProgress = (r) => (r.ms_total ? Math.round((r.ms_done / r.ms_total) * 100) : r.progress || 0);

const DAY = 86400000;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Schedule health for the admin list: green on track, yellow due soon, orange slipping,
// red overdue. Completed work is green; paused work is neutral so it doesn't cry wolf.
export function projectHealth(r, today = new Date().toISOString().slice(0, 10)) {
  if (r.status === 'completed') return { level: 'green', label: 'Completed' };
  if (r.status === 'on_hold') return { level: 'paused', label: 'On hold' };
  const late = r.ms_late || 0;
  const pct = effectiveProgress(r);
  const days = r.due_date ? Math.round((Date.parse(`${r.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY) : null;
  if (days !== null && days < 0) return { level: 'red', label: `Overdue by ${plural(-days, 'day')}` };
  if (late) return { level: 'orange', label: `${plural(late, 'milestone')} overdue` };
  if (days !== null && days <= 7 && pct < 75) return { level: 'orange', label: `Due ${days === 0 ? 'today' : `in ${plural(days, 'day')}`}, ${pct}% done` };
  if (days !== null && days <= 14) return { level: 'yellow', label: days === 0 ? 'Due today' : `Due in ${plural(days, 'day')}` };
  return { level: 'green', label: 'On track' };
}

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
        health: projectHealth(r),
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
