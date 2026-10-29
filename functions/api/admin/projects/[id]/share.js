import { HttpError, handle, intId, json, requireDb } from '../../../../_lib/http.js';
import { newToken } from '../../../../_lib/work.js';
import { clientPortalOn } from '../../../../_lib/features.js';

const gate = (env) => {
  if (!clientPortalOn(env)) throw new HttpError(404, 'Client links are switched off');
};

// POST creates or rotates the private client link (the old link stops working); DELETE disables it.
export const onRequestPost = handle(async ({ env, params }) => {
  gate(env);
  const db = requireDb(env);
  const token = newToken();
  const res = await db.prepare('UPDATE projects SET share_token = ? WHERE id = ?').bind(token, intId(params.id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Project not found');
  return json({ share_token: token });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  gate(env);
  const res = await requireDb(env).prepare('UPDATE projects SET share_token = NULL WHERE id = ?').bind(intId(params.id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Project not found');
  return json({ share_token: null });
});
