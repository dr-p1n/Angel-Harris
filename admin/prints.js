import { h, clear } from '/assets/js/dom.js';
import { DEFAULT_PRICING, cleanPricing, estimate } from '/assets/js/pricing.js';
import { api, attempt, field, formatWhen, toast } from './lib.js';

let sub = 'quotes'; // remembered while the admin stays open
const STATUS = [['new', 'New'], ['quoted', 'Quoted'], ['accepted', 'Accepted'], ['declined', 'Declined']];
const safeLink = (u) => (/^https?:\/\/[^\s"'<>]+$/.test(u || '') ? u : null);

export async function printsView(main, { setOpen }) {
  const body = h('div');
  const chips = h('div', { class: 'filter-chips', role: 'group', 'aria-label': '3D prints sections' });
  const draw = async () => {
    clear(chips).append(...[['quotes', 'Quote requests'], ['pricing', 'Pricing']].map(([k, label]) =>
      h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(sub === k), onclick: () => { sub = k; draw(); } }, label)));
    clear(body);
    try {
      if (sub === 'quotes') await quotesList(body, setOpen);
      else await pricingEditor(body);
    } catch (e) {
      body.append(h('p', { class: 'state', role: 'alert' }, e.message));
    }
  };
  main.append(h('div', { class: 'head' }, h('h1', null, '3D Prints')), chips, body);
  await draw();
}

/* ---------------- Quote requests ---------------- */

async function quotesList(box, setOpen) {
  const { quotes, open } = await api('/quotes');
  setOpen(open);
  if (!quotes.length) {
    box.append(h('p', { class: 'hint' }, 'No quote requests yet. They appear here, and in your email, when visitors use the 3D Prints page.'));
    return;
  }
  const list = h('ol', { class: 'rows msgs' });
  for (const q of quotes) {
    const subject = encodeURIComponent(`Your print quote ${q.ref}`);
    const select = h('select', { class: 'cap cap--auto', 'aria-label': `Status of ${q.ref}`, onchange: attempt(async (e) => {
      await api(`/quotes/${q.id}`, { method: 'PATCH', body: { status: e.target.value } });
      q.status = e.target.value;
      setOpen(quotes.filter((x) => x.status === 'new').length);
      toast('Status updated');
    }) }, STATUS.map(([v, l]) => h('option', { value: v, selected: v === q.status ? '' : null }, l)));
    const file = safeLink(q.file_url);
    list.append(
      h('li', { class: `panel msg${q.status === 'new' ? ' is-unread' : ''}` },
        h('div', { class: 'msg__head' },
          h('div', null, h('strong', null, q.ref), ' · ', q.name, ' ', h('a', { href: `mailto:${q.email}?subject=${subject}` }, q.email)),
          h('span', { class: 'hint' }, formatWhen(q.created_at))),
        h('p', { class: 'msg__body' }, [
          `Estimate shown: ${q.est_low} to ${q.est_high}`,
          `${q.qty} × ${q.material}${q.finish ? `, ${q.finish}` : ''}, ${q.size}${q.rush ? ', RUSH' : ''}`,
          q.notes ? `\n${q.notes}` : '',
        ].join('\n')),
        file ? h('p', { class: 'hint' }, '3D file: ', h('a', { href: file, target: '_blank', rel: 'noopener noreferrer' }, file)) : h('p', { class: 'hint' }, 'No 3D file provided.'),
        h('div', { class: 'actions msg__actions' },
          h('a', { class: 'btn btn--sm btn--primary', href: `mailto:${q.email}?subject=${subject}` }, 'Reply by email'),
          field('Status', select),
          h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: attempt(async () => {
            if (!confirm(`Delete quote ${q.ref} from ${q.name}? This cannot be undone.`)) return;
            await api(`/quotes/${q.id}`, { method: 'DELETE' });
            toast('Deleted');
            clear(box);
            await quotesList(box, setOpen);
          }) }, 'Delete'))),
    );
  }
  box.append(h('p', { class: 'hint' }, 'Newest first. The estimate is what the visitor saw; send them the final price by email.'), list);
}

/* ---------------- Pricing ---------------- */

async function pricingEditor(box, draft) {
  const p = draft || cleanPricing((await api('/pricing')).pricing);
  const trial = { material: p.materials[0].id, finish: p.finishes[0].id, l: 60, w: 60, h: 40, qty: 1, rush: false };

  const num = (obj, key, attrs = {}) => {
    const el = h('input', { type: 'number', step: 'any', min: 0, value: obj[key], ...attrs });
    el.addEventListener('input', () => { obj[key] = el.value === '' ? 0 : Number(el.value); drawTrial(); });
    return el;
  };
  const txt = (obj, key, attrs = {}) => {
    const el = h('input', { type: 'text', value: obj[key] ?? '', ...attrs });
    el.addEventListener('input', () => { obj[key] = el.value; drawTrial(); });
    return el;
  };

  const rows = (title, hint, arr, cols, blank) => {
    const wrap = h('div', { class: 'panel' });
    const drawRows = () => {
      clear(wrap).append(h('strong', null, title), h('p', { class: 'hint' }, hint));
      arr.forEach((item, i) => wrap.append(h('div', { class: 'price-row' }, ...cols(item), h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { arr.splice(i, 1); drawRows(); drawTrial(); } }, 'Remove'))));
      wrap.append(h('div', { class: 'add-media' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { arr.push(blank()); drawRows(); drawTrial(); } }, 'Add')));
    };
    drawRows();
    return wrap;
  };

  const trialBox = h('div', { class: 'panel trial' });
  const drawTrial = () => {
    const live = cleanPricing(p);
    const mat = h('select', { class: 'cap', onchange: (e) => { trial.material = e.target.value; drawTrial(); } }, live.materials.map((m) => h('option', { value: m.id, selected: m.id === trial.material ? '' : null }, m.label)));
    const fin = h('select', { class: 'cap', onchange: (e) => { trial.finish = e.target.value; drawTrial(); } }, live.finishes.map((f) => h('option', { value: f.id, selected: f.id === trial.finish ? '' : null }, f.label)));
    const n = (k) => h('input', { class: 'cap', type: 'number', min: 1, value: trial[k], 'aria-label': k, onchange: (e) => { trial[k] = e.target.value; drawTrial(); } });
    const est = estimate(live, trial);
    clear(trialBox).append(
      h('strong', null, 'Try it'),
      h('p', { class: 'hint' }, 'Uses the numbers above, even before you save, so you can see what a visitor would get.'),
      h('div', { class: 'grid2' }, field('Material', mat), field('Finish', fin), field('Length mm', n('l')), field('Width mm', n('w')), field('Height mm', n('h')), field('Quantity', n('qty'))),
      h('p', { class: 'trial__out' }, est.error ? est.error : `${live.currency} ${est.low} to ${est.high} (about ${est.volume} cm³, ${est.hours} h per piece${est.discount ? `, ${est.discount}% off` : ''})`),
    );
  };

  const save = attempt(async () => {
    const data = await api('/pricing', { method: 'PUT', body: { pricing: p } });
    Object.assign(p, data.pricing);
    toast('Pricing saved');
    clear(box);
    await pricingEditor(box);
  });

  box.append(
    h('p', { class: 'hint' }, 'These numbers drive the instant estimate on the 3D Prints page. The starting values are placeholders: replace them with real prices before launch.'),
    h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      h('div', { class: 'panel' },
        h('strong', null, 'Basics'),
        h('div', { class: 'grid2' },
          field('Currency', txt(p, 'currency', { maxlength: 3 })),
          field('Setup fee per order', num(p, 'setup')),
          field('Minimum order', num(p, 'minimum')),
          field('Machine time, per hour', num(p, 'rate')),
          field('Print speed (cm³ per hour)', num(p, 'speed', { min: 0.1 })),
          field('Share of the box that is plastic (0.25 = a quarter)', num(p, 'fill', { min: 0.02, max: 1 })),
          field('Rush multiplier (1.35 = 35% more)', num(p, 'rush', { min: 1, max: 5 })),
          field('Estimate range (± %)', num(p, 'range', { max: 50 })),
          field('Longest side we can print (mm)', num(p, 'max_dim', { min: 20 }))),
        field('Note shown under the estimate', txt(p, 'note', { maxlength: 300 }))),
      rows('Materials', 'Price per cm³ of plastic. Shown as choices on the page.', p.materials,
        (m) => [field('Name', txt(m, 'label', { maxlength: 40 })), field('Price per cm³', num(m, 'per_cm3')), field('Short description', txt(m, 'note', { maxlength: 120 }))],
        () => ({ id: '', label: '', per_cm3: 0.12, note: '' })),
      rows('Finishes', 'Extra cost per piece. Keep “As printed” at 0.', p.finishes,
        (f) => [field('Name', txt(f, 'label', { maxlength: 40 })), field('Extra per piece', num(f, 'per_unit'))],
        () => ({ id: '', label: '', per_unit: 0 })),
      rows('Quantity discounts', 'The biggest matching quantity wins.', p.discounts,
        (d) => [field('From quantity', num(d, 'qty', { min: 2, step: 1 })), field('Discount %', num(d, 'pct', { max: 90 }))],
        () => ({ qty: 5, pct: 5 })),
      trialBox,
      h('div', { class: 'actions' },
        h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save pricing'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (confirm('Reset every number to the placeholder starting values? Nothing is saved until you press Save.')) { clear(box); pricingEditor(box, cleanPricing(structuredClone(DEFAULT_PRICING))); } } }, 'Reset to placeholders'))),
  );
  drawTrial();
}
