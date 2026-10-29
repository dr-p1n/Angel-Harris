// Print pricing: one model used by the public quote page (live estimate) and by the server,
// which recomputes every estimate itself so a tampered browser can't set its own price.
// All numbers below are PLACEHOLDERS until Angel sets real ones in the admin (3D Prints > Pricing).

export const DEFAULT_PRICING = {
  currency: 'USD',
  fill: 0.25, // share of the bounding box that is actually plastic
  speed: 12, // cm³ printed per hour
  rate: 2.5, // machine time, per hour
  setup: 5, // flat fee per order
  minimum: 15, // smallest order total
  rush: 1.35, // multiplier for a rush order
  range: 15, // estimate shown as +/- this percent
  max_dim: 250, // longest side we can print, in mm
  note: 'This is an estimate. Angel confirms the final price by email before anything is printed.',
  materials: [
    { id: 'pla', label: 'PLA', per_cm3: 0.12, note: 'Everyday material, matte finish, good detail' },
    { id: 'petg', label: 'PETG', per_cm3: 0.15, note: 'Tougher and slightly flexible, good for parts' },
    { id: 'resin', label: 'Resin', per_cm3: 0.45, note: 'Very fine detail, best for miniatures' },
  ],
  finishes: [
    { id: 'raw', label: 'As printed', per_unit: 0 },
    { id: 'sanded', label: 'Sanded and primed', per_unit: 8 },
    { id: 'painted', label: 'Hand painted', per_unit: 20 },
  ],
  discounts: [
    { qty: 5, pct: 5 },
    { qty: 10, pct: 10 },
  ],
};

const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const slug = (v) => text(v, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Turns anything (a stored value, an admin form) into a safe, complete pricing object.
export function cleanPricing(raw) {
  const d = DEFAULT_PRICING;
  const r = raw && typeof raw === 'object' ? raw : {};
  const list = (arr, max, make) => {
    const seen = new Set();
    return (Array.isArray(arr) ? arr : []).slice(0, max).map(make).filter((x) => x && !seen.has(x.id) && seen.add(x.id));
  };
  const materials = list(r.materials, 8, (m) => {
    const label = text(m?.label, 40);
    const id = slug(m?.id || label);
    return label && id ? { id, label, per_cm3: num(m.per_cm3, 0, 100, 0), note: text(m.note, 120) } : null;
  });
  const finishes = list(r.finishes, 6, (f) => {
    const label = text(f?.label, 40);
    const id = slug(f?.id || label);
    return label && id ? { id, label, per_unit: num(f.per_unit, 0, 1000, 0) } : null;
  });
  const discounts = (Array.isArray(r.discounts) ? r.discounts : [])
    .slice(0, 5)
    .map((x) => ({ qty: Math.round(num(x?.qty, 0, 10000, 0)), pct: num(x?.pct, 0, 90, 0) }))
    .filter((x) => x.qty >= 2 && x.pct > 0)
    .sort((a, b) => a.qty - b.qty);
  return {
    currency: text(r.currency || d.currency, 3).toUpperCase() || d.currency,
    fill: num(r.fill, 0.02, 1, d.fill),
    speed: num(r.speed, 0.1, 1000, d.speed),
    rate: num(r.rate, 0, 1000, d.rate),
    setup: num(r.setup, 0, 10000, d.setup),
    minimum: num(r.minimum, 0, 100000, d.minimum),
    rush: num(r.rush, 1, 5, d.rush),
    range: num(r.range, 0, 50, d.range),
    max_dim: Math.round(num(r.max_dim, 20, 2000, d.max_dim)),
    note: text(r.note ?? d.note, 300),
    materials: materials.length ? materials : d.materials,
    finishes: finishes.length ? finishes : d.finishes,
    discounts,
  };
}

// input: { material, finish, l, w, h (mm), qty, rush }. Returns { error } or the estimate.
export function estimate(pricing, input) {
  const p = pricing;
  const material = p.materials.find((m) => m.id === input.material);
  const finish = p.finishes.find((f) => f.id === input.finish) || p.finishes[0];
  if (!material) return { error: 'Choose a material' };
  const dims = [input.l, input.w, input.h].map(Number);
  if (dims.some((x) => !Number.isFinite(x) || x < 5)) return { error: 'Enter the size in millimetres (at least 5 mm each way)' };
  if (dims.some((x) => x > p.max_dim)) return { error: `Each side can be up to ${p.max_dim} mm. For anything bigger, send a message instead.` };
  const qty = Math.round(Number(input.qty));
  if (!(qty >= 1 && qty <= 500)) return { error: 'Quantity must be between 1 and 500' };

  const volume = (dims[0] * dims[1] * dims[2]) / 1000 * p.fill; // cm³ of plastic
  const hours = volume / p.speed;
  const unit = volume * material.per_cm3 + hours * p.rate + finish.per_unit;
  const discount = p.discounts.reduce((best, d) => (qty >= d.qty ? d.pct : best), 0);
  let total = p.setup + unit * qty * (1 - discount / 100);
  if (input.rush) total *= p.rush;
  total = Math.max(total, p.minimum);

  const spread = p.range / 100;
  return {
    material: material.id,
    finish: finish.id,
    qty,
    volume: Math.round(volume * 10) / 10,
    hours: Math.round(hours * 10) / 10,
    discount,
    rush: !!input.rush,
    total: Math.round(total),
    low: Math.max(Math.round(total * (1 - spread)), Math.round(p.minimum)),
    high: Math.round(total * (1 + spread)),
  };
}
