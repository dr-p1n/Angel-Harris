import { api, clear, h, mountChrome, paragraphs, showError } from './common.js';

const app = document.getElementById('app');

const FALLBACK_TAGLINE = '3D animation and 3D printing.';
const FALLBACK_BIO =
  'Placeholder bio. Angel Harris is a 3D animator who makes animated shorts and games, and takes on custom 3D printing. A few honest sentences about the work, the tools and what drives it will go here.';

// The showreel is the whole point of the page: an embedded Vimeo/YouTube video, or a framed placeholder until one is set.
function buildReel(embed) {
  if (embed) {
    return h('div', { class: 'reel' },
      h('iframe', {
        src: embed,
        title: 'Showreel',
        allow: 'fullscreen; picture-in-picture; encrypted-media',
        allowfullscreen: '',
        loading: 'lazy',
        referrerpolicy: 'strict-origin-when-cross-origin',
      }));
  }
  return h('div', { class: 'reel reel--empty', role: 'img', 'aria-label': 'Showreel placeholder' },
    h('span', { class: 'reel__play', 'aria-hidden': 'true' }, h('i')),
    h('p', { class: 'reel__label' }, 'Showreel placeholder'),
    h('small', null, 'Angel’s reel goes here'));
}

try {
  const site = await api('/api/site');
  mountChrome(site, 'home');
  const { settings } = site;

  const words = (settings.tagline || FALLBACK_TAGLINE).split(/\s+/);
  const headline = h('h1', { class: 'headline' });
  words.forEach((word, i) => headline.append(words.length > 2 && i === 1 ? h('em', null, word) : word, ' '));

  clear(app).append(
    h('section', { class: 'home' },
      h('div', { class: 'home__copy' },
        h('p', { class: 'stage__eyebrow' }, settings.eyebrow || 'Angel Harris · Digital animator'),
        headline,
        h('div', { class: 'home__bio' }, settings.about ? paragraphs(settings.about) : h('p', null, FALLBACK_BIO))),
      buildReel(settings.showreel)),
  );
} catch (e) {
  showError(app, e.message);
}
