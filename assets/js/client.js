import { api, clear, h, mountChrome, paragraphs, showError } from './common.js';

const app = document.getElementById('app');
const token = (location.pathname.match(/^\/client\/([a-f0-9]{32})\/?$/) || [])[1];

const STATUS = { ongoing: 'In progress', on_hold: 'On hold', completed: 'Completed' };
const DELIVERABLE = { pending: 'In preparation', delivered: 'Ready for review', approved: 'Approved' };

const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const when = (sql) => new Date(`${String(sql).replace(' ', 'T')}Z`).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
const safeUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/.test(u || '') ? u : null);

function render({ project, milestones, deliverables, updates }) {
  document.title = `${project.title} | Project progress`;

  const bar = h('div', { class: 'cl-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': project.progress, 'aria-label': 'Overall progress' }, h('i'));
  bar.firstChild.style.setProperty('--p', `${project.progress}%`);

  const facts = [
    ['Status', STATUS[project.status] || project.status],
    project.due_date ? ['Target date', day(project.due_date)] : null,
    ['Last updated', when(project.updated_at)],
  ].filter(Boolean);

  clear(app).append(
    h('section', { class: 'page-head' },
      h('p', { class: 'stage__eyebrow' }, project.client ? `Prepared for ${project.client}` : 'Project progress'),
      h('h1', null, project.title),
      project.summary ? h('p', null, project.summary) : null),

    h('section', { class: 'cl-wrap' },
      h('div', { class: 'cl-summary' },
        h('div', { class: 'cl-progress' }, h('div', { class: 'cl-progress__top' }, h('strong', null, 'Overall progress'), h('span', null, `${project.progress}%`)), bar),
        h('dl', { class: 'p-facts cl-facts' }, facts.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))),

      milestones.length
        ? h('section', { class: 'cl-block' }, h('h2', null, 'Milestones'),
            h('ol', { class: 'cl-steps' }, milestones.map((m) =>
              h('li', { class: m.done ? 'is-done' : '' },
                h('span', { class: 'cl-mark', 'aria-hidden': 'true' }, m.done ? '✓' : ''),
                h('span', { class: 'cl-steps__title' }, m.title, h('span', { class: 'sr-only' }, m.done ? ' (done)' : ' (not done yet)')),
                m.due_date ? h('span', { class: 'cl-steps__date' }, day(m.due_date)) : null))))
        : null,

      deliverables.length
        ? h('section', { class: 'cl-block' }, h('h2', null, 'Deliverables'),
            h('ul', { class: 'cl-cards' }, deliverables.map((d) =>
              h('li', { class: 'cl-card' },
                h('div', { class: 'cl-card__top' }, h('strong', null, d.title), h('span', { class: `cl-status cl-status--${d.status}` }, DELIVERABLE[d.status] || d.status)),
                d.description ? h('p', null, d.description) : null,
                safeUrl(d.url) ? h('a', { class: 'cl-link', href: d.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open files ↗') : null))))
        : null,

      updates.length
        ? h('section', { class: 'cl-block' }, h('h2', null, 'Updates'),
            h('ol', { class: 'cl-updates' }, updates.map((u) => h('li', null, h('time', null, when(u.created_at)), paragraphs(u.body)))))
        : null,

      h('p', { class: 'cl-foot' }, 'Questions or feedback? ', h('a', { href: '/contact' }, 'Send a message'), '.')),
  );
}

try {
  if (!token) throw Object.assign(new Error('Not found'), { status: 404 });
  const [site, data] = await Promise.all([api('/api/site'), api(`/api/client/${token}`)]);
  mountChrome(site, 'client');
  render(data);
} catch (e) {
  if (e.status === 404) {
    try { mountChrome({ settings: {}, categories: [] }, 'client'); } catch { /* chrome is optional here */ }
    document.title = 'Link not active | Angel Harris';
    clear(app).append(h('div', { class: 'state' }, h('p', null, 'This link is not active. Please ask Angel for a new one.')));
  } else {
    showError(app, e.message);
  }
}
