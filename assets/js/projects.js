import { api, catLabel, clear, h, mountChrome, showError } from './common.js';

const app = document.getElementById('app');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const cover = (p, attrs) => h('img', { src: p.cover_url, alt: '', decoding: 'async', ...attrs });

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

  // Cards ease in as they scroll into view (skipped for reduced motion / no observer).
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    cards.forEach((c, i) => {
      c.classList.add('reveal');
      c.style.transitionDelay = `${(i % 3) * 70}ms`;
      io.observe(c);
    });
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
  mountChrome(site, 'projects');
  clear(app).append(
    h('section', { class: 'page-head' }, h('h1', null, 'Projects'), h('p', null, 'Digital animation and 3D prints.')),
    buildWork(projects, site),
  );
} catch (e) {
  showError(app, e.message);
}
