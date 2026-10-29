import { handle, json } from '../../_lib/http.js';
import { clientPortalOn } from '../../_lib/features.js';

export const onRequestGet = handle(async ({ data, env }) =>
  json({ email: data.admin.email, features: { clientPortal: clientPortalOn(env) } }),
);
