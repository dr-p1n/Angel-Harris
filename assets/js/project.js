import { api, catLabel, clear, h, mountChrome, paragraphs, showError } from './common.js';

const app = document.getElementById('app');
const slug = (location.pathname.match(/^\/work\/([^/]+)\/?$/) || [])[1];

const EMBED_OK = /^https:\/\/(player\.vimeo\.com\/video\/\d+|www\.youtube-nocookie\.com\/embed\/[\w-]+)$/;

const mediaItem = (m, title) =>
  m.kind === 'embed' && EMBED_OK.test(m.url)
    ? h('figure', null, h('div', { class: 'embed' }, h('iframe', { src: m.url, title: m.caption || `${title} video`, loading: 'lazy', allow: 'fullscreen; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin' })), m.caption ? h('figcaption', null, m.caption) : null)
    : m.kind === 'image'
      ? h('figure', null, h('img', { src: m.url, alt: m.caption || '', loading: 'lazy', decoding: 'async' }), m.caption ? h('figcaption', null, m.caption) : null)
      : null;

function pagerLink(p, label, side) {
  return h('a', { href: `/work/${p.slug}`, rel: side }, p.cover_url ? h('img', { src: p.cover_url, alt: '', loading: 'lazy' }) : null, h('span', null, label), h('strong', null, p.title));
}

function render(site, { project: p, media, prev, next }) {
  document.title = `${p.title} | Angel Harris`;
  const facts = [
    ['Category', catLabel(site, p.category)],
    ['Year', p.year],
    ['Client', p.client],
    ['Role', p.role],
  ].filter(([, v]) => v);

  const hero = h(
    'section',
    { class: 'p-hero' },
    p.cover_url ? h('img', { src: p.cover_url, alt: '', fetchpriority: 'high' }) : null,
    h('a', { class: 'p-back', href: '/#work' }, '← All work'),
    h('div', { class: 'p-hero__cap' }, h('h1', { class: 'p-title' }, p.title)),
  );

  const meta = h(
    'aside',
    { class: 'p-meta' },
    p.summary ? h('p', { class: 'p-summary' }, p.summary) : null,
    p.body ? h('div', { class: 'p-body' }, paragraphs(p.body)) : null,
    facts.length ? h('dl', { class: 'p-facts' }, facts.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])) : null,
    p.tags.length ? h('ul', { class: 'tags', 'aria-label': 'Tags' }, p.tags.map((t) => h('li', null, t))) : null,
  );

  const body = h('div', { class: 'p-layout' }, meta, h('div', { class: 'p-media' }, media.map((m) => mediaItem(m, p.title))));

  const pager =
    prev && next
      ? h('nav', { class: 'pager', 'aria-label': 'More projects' }, pagerLink(prev, '← Previous', 'prev'), pagerLink(next, 'Next →', 'next'))
      : null;
  const all = h('p', { class: 'pager-all' }, h('a', { href: '/#work' }, 'Back to all work'));

  clear(app).append(hero, body, pager, all);

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowLeft' && prev) location.href = `/work/${prev.slug}`;
    if (e.key === 'ArrowRight' && next) location.href = `/work/${next.slug}`;
    if (e.key === 'Escape') location.href = '/#work';
  });
}

try {
  const site = await api('/api/site');
  mountChrome(site, 'project');
  if (!slug) throw Object.assign(new Error('Not found'), { status: 404 });
  render(site, await api(`/api/projects/${encodeURIComponent(slug)}`));
} catch (e) {
  if (e.status === 404) {
    document.title = 'Not found | Angel Harris';
    clear(app).append(h('div', { class: 'state' }, h('p', null, 'That project could not be found.'), h('p', null, h('a', { href: '/#work' }, 'Back to all work'))));
  } else {
    showError(app, e.message);
  }
}
