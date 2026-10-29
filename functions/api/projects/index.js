import { handle, json, requireDb } from '../../_lib/http.js';
import { shapeProject } from '../../_lib/data.js';

export const onRequestGet = handle(async ({ env }) => {
  const { results } = await requireDb(env)
    .prepare(
      `SELECT id, slug, title, category, summary, year, tags, cover_url, featured, published, position
         FROM projects WHERE published = 1 ORDER BY position, id`,
    )
    .all();
  return json({ projects: results.map((r) => shapeProject({ ...r, body: '', client: '', role: '' })) });
});
