import { handle, json, requireDb } from '../_lib/http.js';
import { shapeService } from '../_lib/data.js';

export const onRequestGet = handle(async ({ env }) => {
  const { results } = await requireDb(env)
    .prepare('SELECT * FROM services WHERE published = 1 ORDER BY position, id')
    .all();
  return json({ services: results.map(shapeService) });
});
