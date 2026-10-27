import { handle, json, requireDb } from '../_lib/http.js';
import { PUBLIC_SETTINGS, readSettings } from '../_lib/data.js';

export const onRequestGet = handle(async ({ env }) => {
  const { settings, categories } = await readSettings(requireDb(env));
  const pub = Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, settings[k] || '']));
  return json({ settings: pub, categories });
});
