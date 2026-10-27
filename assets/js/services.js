import { api, clear, h, mountChrome, showError } from './common.js';

const app = document.getElementById('app');

try {
  const [site, { services }] = await Promise.all([api('/api/site'), api('/api/services')]);
  mountChrome(site, 'services');
  const { email } = site.settings;

  const rows = services.map((s, i) =>
    h(
      'li',
      { class: 'svc' },
      h('span', { class: 'svc__n' }, String(i + 1).padStart(2, '0')),
      h('h2', { class: 'svc__title' }, s.title),
      h(
        'div',
        null,
        s.description ? h('p', { class: 'svc__desc' }, s.description) : null,
        s.details.length ? h('ul', { class: 'tags' }, s.details.map((d) => h('li', null, d))) : null,
      ),
    ),
  );

  clear(app).append(
    h('section', { class: 'page-head' }, h('h1', null, 'Services'), h('p', null, 'What I can help you make.')),
    rows.length ? h('ul', { class: 'svc-list' }, rows) : h('p', { class: 'state' }, 'Services are being updated.'),
    h(
      'section',
      { class: 'cta' },
      h('h2', null, 'Have a project in mind?'),
      email ? h('a', { href: `mailto:${email}` }, 'Get in touch') : null,
    ),
  );
} catch (e) {
  showError(app, e.message);
}
