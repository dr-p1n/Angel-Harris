import { HttpError, handle, json, readJson, requireDb } from '../../../_lib/http.js';
import { bool } from '../../../_lib/util.js';

const getId = (params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid id');
  return id;
};

export const onRequestPatch = handle(async ({ request, env, params }) => {
  const b = await readJson(request);
  const res = await requireDb(env)
    .prepare('UPDATE messages SET is_read = ? WHERE id = ?')
    .bind(bool(b.is_read), getId(params))
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Message not found');
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ env, params }) => {
  const res = await requireDb(env).prepare('DELETE FROM messages WHERE id = ?').bind(getId(params)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Message not found');
  return json({ ok: true });
});
