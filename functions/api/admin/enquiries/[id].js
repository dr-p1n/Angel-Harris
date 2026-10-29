import { HttpError, handle, intId, json, readJson, requireDb } from '../../../_lib/http.js';
import { QUOTE_STATUSES } from '../../../_lib/prints.js';

export const onRequestPatch = handle(async ({ request, env, params }) => {
  const b = await readJson(request);
  if (!QUOTE_STATUSES.includes(b.status)) throw new HttpError(400, 'Unknown status');
  const res = await requireDb(env).prepare('UPDATE enquiries SET status = ? WHERE id = ?').bind(b.status, intId(params.id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Enquiry not found');
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  const res = await requireDb(env).prepare('DELETE FROM enquiries WHERE id = ?').bind(intId(params.id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Enquiry not found');
  return json({ ok: true });
});
