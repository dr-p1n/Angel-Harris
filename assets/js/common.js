import { h, paragraphs } from './dom.js';

export { h, clear, paragraphs } from './dom.js';

export async function api(path) {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(res.status === 404 ? 'Not found' : 'Could not load content');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const catLabel = (site, slug) => (site.categories.find((c) => c.slug === slug) || {}).label || slug;

export const safeLink = (u) => (/^https?:\/\//.test(u || '') ? u : null);

// Header and footer are built here so every page shares one copy.
export function mountChrome(site, active) {
  const { settings } = site;
  const link = (href, label, key) =>
    h('a', { href, 'aria-current': active === key ? 'page' : null }, label);

  const header = h(
    'header',
    { class: 'site-header' },
    h('a', { class: 'brand', href: '/' }, 'Angel Harris'),
    h(
      'nav',
      { class: 'site-nav', 'aria-label': 'Main' },
      link('/', 'Home', 'home'),
      link('/projects', 'Projects', 'projects'),
      link('/prints', '3D Prints', 'prints'),
      link('/services', 'Services', 'services'),
      link('/contact', 'Contact', 'contact'),
    ),
  );

  const socials = [
    ['Instagram', settings.instagram],
    ['Behance', settings.behance],
    ['LinkedIn', settings.linkedin],
  ].filter(([, u]) => safeLink(u));

  const year = new Date().getFullYear();
  const footer = h(
    'footer',
    { class: 'site-footer' },
    h('span', null, `© ${year} Angel Harris`),
    settings.location ? h('span', null, settings.location) : null,
    settings.email ? h('a', { href: `mailto:${settings.email}` }, settings.email) : null,
    socials.map(([label, url]) => h('a', { href: url, rel: 'noopener', target: '_blank' }, label)),
  );

  // Slow colour wash shared by every page (pure CSS motion).
  const fx = h('div', { class: 'fx', 'aria-hidden': 'true' }, ['b1', 'b2', 'b3'].map((c) => h('i', { class: c })));

  document.body.prepend(fx, header);
  document.body.append(footer);

  const onScroll = () => header.classList.toggle('is-solid', scrollY > 40 || active !== 'home');
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return header;
}

export const showError = (root, message) =>
  root.replaceChildren(h('p', { class: 'state', role: 'alert' }, message));
