import { api, clear, h, mountChrome, showError } from './common.js';
import { estimate } from './pricing.js';

const app = document.getElementById('app');
const money = (cur, n) => `${cur} ${n.toLocaleString('en-US')}`;

function buildQuote(pricing) {
  const started = Date.now();
  const state = { material: pricing.materials[0].id, finish: pricing.finishes[0].id, l: 60, w: 60, h: 40, qty: 1, rush: false };

  const card = h('aside', { class: 'qt-card', 'aria-live': 'polite' });
  const status = h('p', { class: 'form-status', role: 'alert' });
  const send = h('button', { type: 'submit', class: 'btn-send' }, 'Request this quote');

  const drawEstimate = () => {
    const est = estimate(pricing, state);
    clear(card);
    if (est.error) {
      card.append(h('p', { class: 'qt-card__label' }, 'Your estimate'), h('p', { class: 'qt-card__hint' }, est.error));
      send.disabled = true;
      return;
    }
    send.disabled = false;
    card.append(
      h('p', { class: 'qt-card__label' }, 'Your estimate'),
      h('p', { class: 'qt-card__price' }, `${money(pricing.currency, est.low)} – ${est.high.toLocaleString('en-US')}`),
      h('ul', { class: 'qt-card__lines' },
        h('li', null, `About ${est.volume} cm³ of material per piece`),
        h('li', null, `Roughly ${est.hours} h print time per piece`),
        est.discount ? h('li', null, `${est.discount}% quantity discount applied`) : null,
        est.rush ? h('li', null, 'Rush order included') : null),
      pricing.note ? h('p', { class: 'qt-card__note' }, pricing.note) : null,
    );
  };

  const field = (label, input, hint) => h('label', { class: 'cf-field' }, h('span', null, label), input, hint ? h('small', { class: 'qt-hint' }, hint) : null);
  const numInput = (key, min, max) =>
    h('input', { type: 'number', inputmode: 'numeric', min, max, step: 1, value: state[key], required: '', oninput: (e) => { state[key] = e.target.value; drawEstimate(); } });

  const materials = h('div', { class: 'qt-options', role: 'radiogroup', 'aria-label': 'Material' },
    pricing.materials.map((m) =>
      h('label', { class: 'qt-opt' },
        h('input', { type: 'radio', name: 'material', value: m.id, checked: m.id === state.material, onchange: () => { state.material = m.id; drawEstimate(); } }),
        h('span', { class: 'qt-opt__body' }, h('strong', null, m.label), m.note ? h('small', null, m.note) : null))));

  const finish = h('select', { onchange: (e) => { state.finish = e.target.value; drawEstimate(); } },
    pricing.finishes.map((f) => h('option', { value: f.id }, f.per_unit ? `${f.label} (+${money(pricing.currency, f.per_unit)} each)` : f.label)));

  const name = h('input', { type: 'text', name: 'name', required: '', maxlength: 100, autocomplete: 'name' });
  const email = h('input', { type: 'email', name: 'email', required: '', maxlength: 200, autocomplete: 'email' });
  const fileUrl = h('input', { type: 'url', name: 'file_url', maxlength: 500, placeholder: 'https://…' });
  const notes = h('textarea', { name: 'notes', maxlength: 2000, rows: 4, placeholder: 'What is it for? Any colours, details or deadlines?' });
  const trap = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });

  const body = h('div', { class: 'qt' });
  const form = h('form', { class: 'contact-form qt-form', novalidate: '' },
    h('fieldset', { class: 'qt-group' }, h('legend', null, '1 · Material'), materials),
    h('fieldset', { class: 'qt-group' },
      h('legend', null, '2 · Size and quantity'),
      h('div', { class: 'qt-dims qt-dims--3' }, field('Length (mm)', numInput('l', 5, pricing.max_dim)), field('Width (mm)', numInput('w', 5, pricing.max_dim)), field('Height (mm)', numInput('h', 5, pricing.max_dim))),
      h('p', { class: 'qt-hint' }, `The box the piece fits in, up to ${pricing.max_dim} mm per side.`),
      h('div', { class: 'qt-dims' },
        field('Quantity', numInput('qty', 1, 500)),
        field('Finish', finish)),
      h('label', { class: 'qt-check' }, h('input', { type: 'checkbox', onchange: (e) => { state.rush = e.target.checked; drawEstimate(); } }), 'Rush order (faster turnaround)')),
    h('fieldset', { class: 'qt-group' },
      h('legend', null, '3 · Your file and notes'),
      field('Link to your 3D file (optional)', fileUrl, 'A Drive, Dropbox or similar link to an STL or OBJ. No file? Describe it below and Angel can model it.'),
      field('Notes (optional)', notes)),
    h('fieldset', { class: 'qt-group' },
      h('legend', null, '4 · Where to send the quote'),
      h('div', { class: 'qt-dims qt-dims--2' }, field('Your name', name), field('Your email', email))),
    h('div', { class: 'cf-trap', 'aria-hidden': 'true' }, trap),
    h('div', { class: 'cf-actions' }, send, status),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    send.disabled = true;
    send.textContent = 'Sending…';
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, name: name.value, email: email.value, notes: notes.value, file_url: fileUrl.value, website: trap.value, t: started }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      clear(body).append(
        h('div', { class: 'contact-thanks qt-thanks', role: 'status' },
          h('h2', null, 'Quote requested.'),
          h('p', { class: 'qt-ref' }, 'Your quote number ', h('strong', null, data.ref)),
          h('p', null, `Estimate: ${money(data.currency || pricing.currency, data.low)} – ${data.high.toLocaleString('en-US')}. Angel will confirm the final price by email before anything is printed. Keep the number if you need to ask about it.`)),
      );
      scrollTo({ top: 0 });
    } catch (err) {
      status.textContent = err.message;
      send.disabled = false;
      send.textContent = 'Request this quote';
    }
  });

  body.append(form, card);
  drawEstimate();
  return body;
}

try {
  const [site, { pricing }] = await Promise.all([api('/api/site'), api('/api/prints')]);
  mountChrome(site, 'prints');
  clear(app).append(
    h('section', { class: 'page-head' }, h('h1', null, 'Get a quote'), h('p', null, 'Custom 3D prints, props and miniatures: set the details, see an instant estimate, then send the request and Angel confirms the final price. Need animation instead? ', h('a', { href: '/contact' }, 'Send a brief'), '.')),
    h('div', { class: 'qt-wrap' }, buildQuote(pricing)),
  );
} catch (e) {
  showError(app, e.message);
}
