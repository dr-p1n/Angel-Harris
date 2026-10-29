import { HttpError, handle, json, requireDb } from '../../_lib/http.js';
import { mediaKey } from '../../_lib/util.js';

const GRACE_MS = 24 * 60 * 60 * 1000; // a fresh upload may belong to a project that is still being edited

// Lists every uploaded image and works out which ones no project (or cover) refers to.
async function scan(env) {
  if (!env.MEDIA) throw new HttpError(503, 'Storage is not configured');
  const db = requireDb(env);
  const used = new Set();
  const { results } = await db.prepare("SELECT url AS u FROM project_media UNION SELECT cover_url FROM projects").all();
  for (const r of results) {
    const key = r.u && mediaKey(r.u);
    if (key) used.add(key);
  }
  let total = 0, bytes = 0, cursor;
  const unused = [];
  do {
    const page = await env.MEDIA.list({ prefix: 'u/', cursor, limit: 1000 });
    for (const o of page.objects) {
      total++;
      bytes += o.size;
      if (!used.has(o.key) && Date.now() - new Date(o.uploaded).getTime() > GRACE_MS) unused.push({ key: o.key, size: o.size });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { total, bytes, unused, unused_bytes: unused.reduce((n, o) => n + o.size, 0) };
}

export const onRequestGet = handle(async ({ env }) => json(await scan(env)));

// Recomputed on the server, so the browser can never name which files to delete.
export const onRequestDelete = handle(async ({ env }) => {
  const { unused } = await scan(env);
  for (let i = 0; i < unused.length; i += 1000) await env.MEDIA.delete(unused.slice(i, i + 1000).map((o) => o.key));
  return json({ deleted: unused.length });
});
