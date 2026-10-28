import { HttpError, handle, json } from '../../_lib/http.js';

// "Email me the digest now": asks the mailer Worker to build and send today's digest.
export const onRequestPost = handle(async ({ env }) => {
  if (!env.MAILER) throw new HttpError(503, 'Email is not set up on this deployment');
  const res = await env.MAILER.fetch('https://mailer/digest', { method: 'POST' });
  if (!res.ok) throw new HttpError(502, 'The digest could not be sent');
  return json(await res.json());
});
