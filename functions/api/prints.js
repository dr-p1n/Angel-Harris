import { handle, json, requireDb } from '../_lib/http.js';
import { readPricing } from '../_lib/prints.js';

// The public price list. The quote page uses it for the live estimate; /api/quote recomputes it.
export const onRequestGet = handle(async ({ env }) => json({ pricing: await readPricing(requireDb(env)) }));
