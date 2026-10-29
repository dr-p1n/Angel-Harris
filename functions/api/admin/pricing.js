import { handle, json, readJson, requireDb } from '../../_lib/http.js';
import { readPricing } from '../../_lib/prints.js';
import { cleanPricing } from '../../../assets/js/pricing.js';

export const onRequestGet = handle(async ({ env }) => json({ pricing: await readPricing(requireDb(env)) }));

export const onRequestPut = handle(async ({ request, env }) => {
  const db = requireDb(env);
  const pricing = cleanPricing((await readJson(request, 64 * 1024)).pricing);
  await db
    .prepare("INSERT INTO settings (key, value) VALUES ('print_pricing', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify(pricing))
    .run();
  return json({ pricing });
});
