import { api, catLabel, clear, h, mountChrome, showError } from './common.js';

const app = document.getElementById('app');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const cover = (p, attrs) => h('img', { src: p.cover_url, alt: '', decoding: 'async', ...attrs });

function buildHero(items, site) {
  if (!items.length) {
    return h('section', { class: 'hero hero--empty' }, h('p', null, site.settings.tagline || 'Portfolio'));
  }

  const slides = items.map((p, i) =>
    h(
      'a',
      { class: 'hero__slide', href: `/work/${p.slug}`, 'aria-label': `${p.title}, view project` },
      cover(p, i === 0 ? { fetchpriority: 'high' } : { loading: 'lazy' }),
      h(
        'div',
        { class: 'hero__cap' },
        h('p', { class: 'hero__kicker' }, [catLabel(site, p.category), p.year].filter(Boolean).join(' · ')),
        h('h2', { class: 'hero__title' }, p.title),
        h('span', { class: 'hero__cta' }, 'View project →'),
      ),
    ),
  );

  const count = h('span', { class: 'hero__count', 'aria-live': 'off' });
  const root = h('section', { class: 'hero', 'aria-roledescription': 'carousel', 'aria-label': 'Featured work' }, slides);

  let idx = 0;
  let timer = null;
  const show = (n) => {
    idx = (n + items.length) % items.length;
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === idx);
      s.inert = i !== idx;
    });
    count.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  };
  const stop = () => clearInterval(timer);
  const start = () => {
    stop();
    if (items.length > 1 && !reduceMotion) timer = setInterval(() => show(idx + 1), 6500);
  };

  if (items.length > 1) {
    const btn = (label, glyph, delta) =>
      h('button', { type: 'button', class: 'hero__btn', 'aria-label': label, onclick: () => { show(idx + delta); start(); } }, glyph);
    root.append(h('div', { class: 'hero__ctl' }, count, h('div', { class: 'hero__btns' }, btn('Previous project', '←', -1), btn('Next project', '→', 1))));
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }
  show(0);
  start();
  return root;
}

function buildWork(projects, site) {
  const used = site.categories.filter((c) => projects.some((p) => p.category === c.slug));
  const cards = projects.map((p) =>
    h(
      'a',
      { class: 'card', href: `/work/${p.slug}`, dataset: { cat: p.category } },
      cover(p, { loading: 'lazy' }),
      h(
        'div',
        { class: 'card__meta' },
        h('p', { class: 'card__kicker' }, [catLabel(site, p.category), p.year].filter(Boolean).join(' · ')),
        h('h3', { class: 'card__title' }, p.title),
      ),
    ),
  );

  const grid = h('div', { class: 'grid', id: 'grid' }, cards);
  const section = h('section', { class: 'work', id: 'work', 'aria-label': 'Work' });
  if (!projects.length) {
    section.append(h('p', { class: 'state' }, 'New work is on its way.'));
    return section;
  }

  const chips = [{ slug: '', label: 'All', n: projects.length }, ...used.map((c) => ({ ...c, n: projects.filter((p) => p.category === c.slug).length }))].map(
    (c) => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { cat: c.slug } }, c.label, h('small', null, c.n)),
  );
  const bar = h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter work by category' }, used.length ? chips : []);

  const apply = (slug, animate) => {
    const run = () => {
      cards.forEach((c, i) => (c.hidden = !!slug && projects[i].category !== slug));
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === slug)));
    };
    // Transitions only run (and call back) while the page is rendering.
    if (animate && document.startViewTransition && !reduceMotion && document.visibilityState === 'visible') {
      const t = document.startViewTransition(run);
      for (const p of [t.ready, t.finished, t.updateCallbackDone]) p.catch(() => {});
    } else {
      run();
    }
    const url = new URL(location.href);
    slug ? url.searchParams.set('c', slug) : url.searchParams.delete('c');
    history.replaceState(null, '', url);
  };
  chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.cat, true)));

  const initial = new URLSearchParams(location.search).get('c') || '';
  section.append(...(used.length ? [bar] : []), grid);
  apply(used.some((c) => c.slug === initial) ? initial : '');
  return section;
}

try {
  const [site, { projects }] = await Promise.all([api('/api/site'), api('/api/projects')]);
  mountChrome(site, 'home');
  const featured = projects.filter((p) => p.featured && p.cover_url);
  const heroItems = (featured.length ? featured : projects.filter((p) => p.cover_url)).slice(0, 5);
  clear(app).append(h('h1', { class: 'sr-only' }, 'Angel Harris, portfolio'), buildHero(heroItems, site), buildWork(projects, site));
  if (location.hash === '#work') document.getElementById('work')?.scrollIntoView();
} catch (e) {
  showError(app, e.message);
}
