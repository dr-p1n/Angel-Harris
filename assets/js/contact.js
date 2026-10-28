import { api, clear, h, mountChrome, showError } from './common.js';

const app = document.getElementById('app');

function buildForm(onSent) {
  const started = Date.now();
  const status = h('p', { class: 'form-status', role: 'alert' });
  const send = h('button', { type: 'submit', class: 'btn-send' }, 'Send message');

  const field = (label, input) => h('label', { class: 'cf-field' }, h('span', null, label), input);
  const name = h('input', { type: 'text', name: 'name', required: '', maxlength: 100, autocomplete: 'name' });
  const email = h('input', { type: 'email', name: 'email', required: '', maxlength: 200, autocomplete: 'email' });
  const message = h('textarea', { name: 'message', required: '', minlength: 10, maxlength: 4000, rows: 7 });
  // Honeypot: real visitors never see or fill this.
  const trap = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });

  const form = h(
    'form',
    { class: 'contact-form', novalidate: '' },
    field('Your name', name),
    field('Your email', email),
    field('How can I help?', message),
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
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.value, email: email.value, message: message.value, website: trap.value, t: started }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      onSent();
    } catch (err) {
      status.textContent = err.message;
      send.disabled = false;
      send.textContent = 'Send message';
    }
  });
  return form;
}

try {
  const site = await api('/api/site');
  mountChrome(site, 'contact');

  const body = h('div', { class: 'contact-body' });
  const showThanks = () =>
    clear(body).append(
      h('div', { class: 'contact-thanks', role: 'status' }, h('h2', null, 'Thank you.'), h('p', null, 'Your message is on its way. I will get back to you soon.')),
    );
  body.append(buildForm(showThanks));

  clear(app).append(
    h('section', { class: 'page-head' }, h('h1', null, 'Contact'), h('p', null, 'Tell me a little about your project and I will reply by email.')),
    body,
  );
} catch (e) {
  showError(app, e.message);
}
