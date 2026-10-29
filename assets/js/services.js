import { api, clear, h, mountChrome, showError } from './common.js';

const app = document.getElementById('app');

try {
  const [site, { services }] = await Promise.all([api('/api/site'), api('/api/services')]);
  mountChrome(site, 'services');

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
    h('section', { class: 'page-head' }, h('h1', null, 'Services'), h('p', null, site.settings.services_intro || 'Two things I make: digital animation and 3D prints. Here is what each involves and how to get started.')),
    h(
      'section',
      { class: 'offer' },
      h(
        'article',
        { class: 'offer__card' },
        h('h2', null, 'Digital animation'),
        h('p', null, site.settings.offer_animation || 'Shorts, motion and game-ready animation, from concept to final render. Tell me about your idea and I will reply with a plan and a price.'),
        h('a', { href: '/prints?for=animation' }, 'Brief me on a project'),
      ),
      h(
        'article',
        { class: 'offer__card' },
        h('h2', null, '3D printing'),
        h('p', null, site.settings.offer_prints || 'Custom prints, props and miniatures. Set the details, see an instant estimate and send the request.'),
        h('a', { href: '/prints' }, 'Get a print quote'),
      ),
    ),
    rows.length ? h('ul', { class: 'svc-list' }, rows) : h('p', { class: 'state' }, 'Services are being updated.'),
    h(
      'section',
      { class: 'cta' },
      h('h2', null, 'Have a project in mind?'),
      h('a', { href: '/prints' }, 'Get a quote'),
    ),
  );
} catch (e) {
  showError(app, e.message);
}
