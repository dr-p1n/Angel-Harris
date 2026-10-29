import { DEFAULT_PRICING, cleanPricing } from '../../assets/js/pricing.js';

// Quote numbers: six characters without O/0/I/1/L so they can be read out over the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newQuoteRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `AH-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

export async function readPricing(db) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'print_pricing'").first();
  if (!row) return cleanPricing(DEFAULT_PRICING);
  try {
    return cleanPricing(JSON.parse(row.value));
  } catch {
    return cleanPricing(DEFAULT_PRICING);
  }
}

export const QUOTE_STATUSES = ['new', 'quoted', 'accepted', 'declined'];
