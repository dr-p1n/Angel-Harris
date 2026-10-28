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

// Header, info drawer and footer are built here so every page shares one copy.
export function mountChrome(site, active) {
  const { settings } = site;
  const link = (href, label, key) =>
    h('a', { href, 'aria-current': active === key ? 'page' : null }, label);

  const info = buildInfo(site);
  const header = h(
    'header',
    { class: 'site-header' },
    h('a', { class: 'brand', href: '/' }, 'Angel Harris'),
    h(
      'nav',
      { class: 'site-nav', 'aria-label': 'Main' },
      link('/#work', 'Work', 'work'),
      link('/services', 'Services', 'services'),
      h('button', { type: 'button', class: 'nav-btn', onclick: () => info.showModal() }, 'Info'),
    ),
  );

  const year = new Date().getFullYear();
  const footer = h(
    'footer',
    { class: 'site-footer' },
    h('span', null, `© ${year} Angel Harris`),
    settings.email ? h('a', { href: `mailto:${settings.email}` }, settings.email) : null,
  );

  // Animated colour-blob backdrop shared by every page (pure CSS motion).
  const fx = h('div', { class: 'fx', 'aria-hidden': 'true' }, ['b1', 'b2', 'b3', 'b4'].map((c) => h('i', { class: c })));

  document.body.prepend(fx, header);
  document.body.append(footer, info);

  const onScroll = () => header.classList.toggle('is-solid', scrollY > 40 || active !== 'home');
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return header;
}

function buildInfo(site) {
  const { settings } = site;
  const socials = [
    ['Instagram', settings.instagram],
    ['Behance', settings.behance],
    ['LinkedIn', settings.linkedin],
  ].filter(([, u]) => safeLink(u));

  const dlg = h(
    'dialog',
    { class: 'info', 'aria-labelledby': 'info-title' },
    h(
      'div',
      { class: 'info__inner' },
      h('button', { type: 'button', class: 'info__close', 'aria-label': 'Close info', onclick: () => dlg.close() }, '×'),
      h('h2', { id: 'info-title', class: 'info__title' }, 'Info'),
      h('div', { class: 'info__about' }, settings.about ? paragraphs(settings.about) : h('p', null, settings.tagline)),
      settings.location ? h('p', { class: 'info__row' }, h('span', null, 'Based in'), settings.location) : null,
      settings.email
        ? h('p', { class: 'info__row' }, h('span', null, 'Contact'), h('a', { href: `mailto:${settings.email}` }, settings.email))
        : null,
      socials.length
        ? h(
            'p',
            { class: 'info__row' },
            h('span', null, 'Elsewhere'),
            socials.map(([label, url]) => h('a', { href: url, rel: 'noopener', target: '_blank' }, label)),
          )
        : null,
    ),
  );
  // Clicking the backdrop (the dialog element itself) closes it.
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  return dlg;
}

export const showError = (root, message) =>
  root.replaceChildren(h('p', { class: 'state', role: 'alert' }, message));
