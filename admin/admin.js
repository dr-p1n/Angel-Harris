import { h, clear } from '/assets/js/dom.js';

const root = document.getElementById('admin');
const toastEl = document.getElementById('toast');
let toastTimer;

function toast(message, isError) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', !!isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), isError ? 6000 : 2500);
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Requested-With': 'admin-ui' };
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api/admin${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined), credentials: 'same-origin' });
  } catch {
    throw new Error('Could not reach the server. If you were signed out, reload this page to sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Runs an async action, surfacing failures as a toast instead of an unhandled rejection.
const attempt = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (e) {
    toast(e.message, true);
  }
};

const slugify = (s) =>
  String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const field = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
const text = (value, attrs) => h('input', { type: 'text', value: value ?? '', ...attrs });
const check = (label, checked, onchange) =>
  h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: checked ? '' : null, onchange: (e) => onchange(e.target.checked) }), label);

// Drag-to-reorder (via the handle) plus up/down buttons for keyboard users.
// Items need data-key; onChange receives the new key order.
function makeSortable(list, onChange) {
  let dragged = null;
  const keys = () => [...list.children].map((li) => li.dataset.key);

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.handle');
    if (handle) handle.closest('li').draggable = true;
  });
  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li');
    if (!li || li.parentElement !== list) return;
    dragged = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.key);
  });
  list.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const over = e.target.closest('li');
    if (!over || over === dragged || over.parentElement !== list) return;
    const r = over.getBoundingClientRect();
    list.insertBefore(dragged, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
  });
  list.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged.draggable = false;
    dragged = null;
    onChange(keys());
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn) return;
    const li = btn.closest('li');
    const up = btn.dataset.move === 'up';
    const sib = up ? li.previousElementSibling : li.nextElementSibling;
    if (!sib) return;
    up ? list.insertBefore(li, sib) : list.insertBefore(sib, li);
    btn.focus();
    onChange(keys());
  });
}

const dragControls = () => [
  h('span', { class: 'handle', title: 'Drag to reorder', 'aria-hidden': 'true' }, '⋮⋮'),
];
const moveButtons = () =>
  h('span', { class: 'mv' },
    h('button', { type: 'button', 'data-move': 'up', 'aria-label': 'Move up' }, '▲'),
    h('button', { type: 'button', 'data-move': 'down', 'aria-label': 'Move down' }, '▼'));

/* ---------------- Projects list ---------------- */

async function projectsView(main) {
  const { projects } = await api('/projects');
  const { categories } = await api('/settings');
  const label = (slug) => (categories.find((c) => c.slug === slug) || {}).label || slug || 'Uncategorised';

  const list = h('ol', { class: 'rows' });
  const toggle = attempt(async (id, patch) => {
    await api(`/projects/${id}`, { method: 'PATCH', body: patch });
    toast('Updated');
  });

  for (const p of projects) {
    list.append(
      h('li', { class: 'row', dataset: { key: p.id } },
        h('div', null, dragControls(), moveButtons()),
        p.cover_url ? h('img', { class: 'row__thumb', src: p.cover_url, alt: '' }) : h('div', { class: 'row__thumb' }),
        h('div', null,
          h('div', { class: 'row__title' }, p.title),
          h('div', { class: 'row__sub' }, [label(p.category), p.year, `/work/${p.slug}`].filter(Boolean).join(' · '))),
        h('div', { class: 'row__ctl' },
          check('Published', p.published, (v) => toggle(p.id, { published: v })),
          check('Featured', p.featured, (v) => toggle(p.id, { featured: v })),
          h('a', { class: 'btn btn--sm', href: `#/projects/${p.id}` }, 'Edit'))),
    );
  }
  makeSortable(list, attempt(async (keys) => {
    await api('/projects/reorder', { method: 'POST', body: { ids: keys.map(Number) } });
    toast('Order saved');
  }));

  main.append(
    h('div', { class: 'head' }, h('h1', null, 'Projects'), h('a', { class: 'btn btn--primary', href: '#/projects/new' }, 'New project')),
    projects.length ? h('p', { class: 'hint' }, 'Drag the handle (or use the arrows) to set the order shown on the site. Featured projects appear in the home hero.') : null,
    projects.length ? list : h('p', { class: 'hint' }, 'No projects yet. Create the first one.'),
  );
}

/* ---------------- Project editor ---------------- */

async function projectEditor(main, id) {
  const { categories } = await api('/settings');
  let p = { title: '', slug: '', category: categories[0]?.slug || '', summary: '', body: '', year: String(new Date().getFullYear()), client: '', role: '', tags: [], featured: false, published: false, cover_url: '' };
  let media = [];
  if (id) {
    const data = await api(`/projects/${id}`);
    p = data.project;
    media = data.media;
  }
  let seq = 0;
  media = media.map((m) => ({ ...m, _k: ++seq }));
  let slugTouched = !!id;

  const slugInput = text(p.slug, { placeholder: 'auto-generated from the title' });
  slugInput.addEventListener('input', () => { slugTouched = true; p.slug = slugInput.value; });
  const titleInput = text(p.title, { maxlength: 120, required: '' });
  titleInput.addEventListener('input', () => {
    p.title = titleInput.value;
    if (!slugTouched) { p.slug = slugify(p.title); slugInput.value = p.slug; }
  });

  const catOptions = [...categories];
  if (p.category && !catOptions.some((c) => c.slug === p.category)) catOptions.push({ slug: p.category, label: p.category });
  const catSelect = h('select', { onchange: (e) => (p.category = e.target.value) }, [h('option', { value: '' }, 'Uncategorised'), ...catOptions.map((c) => h('option', { value: c.slug, selected: c.slug === p.category ? '' : null }, c.label))]);

  const bind = (key, attrs, tag = 'input') => {
    const el = h(tag, { ...(tag === 'input' ? { type: 'text' } : {}), ...attrs });
    el.value = Array.isArray(p[key]) ? p[key].join(', ') : p[key] ?? '';
    el.addEventListener('input', () => (p[key] = el.value));
    return el;
  };

  /* media manager */
  const mediaList = h('ul', { class: 'media-list' });
  const renderMedia = () => {
    clear(mediaList);
    if (!media.length) mediaList.append(h('li', { class: 'hint' }, 'No media yet. Upload images or add a video link below.'));
    for (const m of media) {
      const isCover = m.kind === 'image' && m.url === p.cover_url;
      mediaList.append(
        h('li', { class: 'mitem', dataset: { key: m._k } },
          h('div', null, dragControls(), moveButtons()),
          m.kind === 'image' ? h('img', { class: 'mitem__thumb', src: m.url, alt: '' }) : h('div', { class: 'mitem__thumb' }, 'Video'),
          h('div', { class: 'mitem__body' },
            h('input', { class: 'cap', type: 'text', value: m.caption || '', placeholder: 'Caption (optional)', maxlength: 300, 'aria-label': 'Caption', oninput: (e) => (m.caption = e.target.value) }),
            h('div', { class: 'mitem__ctl' },
              m.kind === 'image' ? h('button', { type: 'button', class: `btn btn--sm ${isCover ? 'is-cover' : ''}`, 'aria-pressed': String(isCover), onclick: () => { p.cover_url = m.url; renderMedia(); } }, isCover ? 'Cover image' : 'Set as cover') : h('span', { class: 'badge' }, 'Embed'),
              h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { media = media.filter((x) => x !== m); if (p.cover_url === m.url) p.cover_url = ''; renderMedia(); } }, 'Remove')),
            h('div', { class: 'mitem__url' }, m.url))),
      );
    }
  };
  makeSortable(mediaList, (keys) => {
    const byKey = new Map(media.map((m) => [String(m._k), m]));
    media = keys.map((k) => byKey.get(k));
  });

  const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', multiple: '', hidden: '' });
  const uploadStatus = h('span', { class: 'hint' });
  fileInput.addEventListener('change', attempt(async () => {
    const files = [...fileInput.files];
    for (const [i, f] of files.entries()) {
      uploadStatus.textContent = `Uploading ${i + 1} of ${files.length}…`;
      const form = new FormData();
      form.append('file', f);
      try {
        const { url } = await api('/upload', { method: 'POST', form });
        media.push({ _k: ++seq, kind: 'image', url, caption: '' });
        if (!p.cover_url) p.cover_url = url;
        renderMedia();
      } catch (e) {
        toast(`${f.name}: ${e.message}`, true);
      }
    }
    uploadStatus.textContent = '';
    fileInput.value = '';
  }));

  const embedInput = h('input', { type: 'url', class: 'cap', placeholder: 'Vimeo or YouTube link', 'aria-label': 'Video link' });
  const addEmbed = () => {
    const url = embedInput.value.trim();
    if (!url) return;
    media.push({ _k: ++seq, kind: 'embed', url, caption: '' });
    embedInput.value = '';
    renderMedia();
  };
  renderMedia();

  const save = attempt(async () => {
    if (!p.title.trim()) { toast('Add a title first', true); titleInput.focus(); return; }
    const body = { ...p, tags: String(p.tags), media: media.map(({ kind, url, caption }) => ({ kind, url, caption })) };
    const data = id ? await api(`/projects/${id}`, { method: 'PUT', body }) : await api('/projects', { method: 'POST', body });
    toast('Saved');
    if (id) await render(); else location.hash = `#/projects/${data.project.id}`;
  });
  const remove = attempt(async () => {
    if (!confirm(`Delete "${p.title}"? This also removes its uploaded images and cannot be undone.`)) return;
    await api(`/projects/${id}`, { method: 'DELETE' });
    toast('Deleted');
    location.hash = '#/projects';
  });

  main.append(
    h('div', { class: 'head' }, h('h1', null, id ? 'Edit project' : 'New project'), h('a', { class: 'btn', href: '#/projects' }, '← All projects')),
    h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      field('Title', titleInput),
      h('div', { class: 'grid2' },
        field('URL slug', slugInput),
        field('Category', catSelect)),
      field('Short summary (shown on the project page and in link previews)', bind('summary', { maxlength: 400 })),
      field('Description (blank line = new paragraph)', bind('body', { maxlength: 8000 }, 'textarea')),
      h('div', { class: 'grid2' },
        field('Year', bind('year', { maxlength: 10 })),
        field('Client', bind('client', { maxlength: 120 })),
        field('Role', bind('role', { maxlength: 120 }))),
      field('Tags (comma separated)', bind('tags', { maxlength: 200 })),
      h('div', { class: 'panel' },
        h('strong', null, 'Media'),
        h('p', { class: 'hint' }, 'JPEG, PNG, WebP or AVIF, up to 10 MB each. Resize large images first for fast loading.'),
        mediaList,
        h('div', { class: 'add-media' },
          h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Upload images'),
          fileInput, uploadStatus),
        h('div', { class: 'add-media' }, embedInput, h('button', { type: 'button', class: 'btn', onclick: addEmbed }, 'Add video'))),
      h('div', { class: 'grid2' },
        check('Published (visible on the site)', p.published, (v) => (p.published = v)),
        check('Featured (shown in the home hero)', p.featured, (v) => (p.featured = v))),
      h('div', { class: 'actions' },
        h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save project'),
        id && p.published ? h('a', { class: 'btn', href: `/work/${p.slug}`, target: '_blank', rel: 'noopener' }, 'View live') : null,
        id ? h('button', { type: 'button', class: 'btn btn--danger', onclick: remove }, 'Delete') : null)),
  );
}

/* ---------------- Services ---------------- */

async function servicesView(main) {
  const { services } = await api('/services');
  const list = h('ol', { class: 'rows' });

  for (const s of services) {
    const st = { ...s, details: s.details.join('\n') };
    const save = attempt(async () => {
      await api(`/services/${s.id}`, { method: 'PUT', body: st });
      toast('Saved');
    });
    const remove = attempt(async () => {
      if (!confirm(`Delete "${st.title}"?`)) return;
      await api(`/services/${s.id}`, { method: 'DELETE' });
      toast('Deleted');
      await render();
    });
    const bindS = (key, attrs, tag = 'input') => {
      const el = h(tag, { ...(tag === 'input' ? { type: 'text' } : {}), ...attrs });
      el.value = st[key];
      el.addEventListener('input', () => (st[key] = el.value));
      return el;
    };
    list.append(
      h('li', { class: 'panel svc-card', dataset: { key: s.id } },
        h('div', { class: 'row__ctl' }, dragControls(), moveButtons(), h('span', { class: 'hint' }, 'Order on the site')),
        field('Title', bindS('title', { maxlength: 120 })),
        field('Description', bindS('description', { maxlength: 1000 }, 'textarea')),
        field('Included items (one per line)', bindS('details', {}, 'textarea')),
        h('div', { class: 'actions' },
          check('Published', st.published, (v) => (st.published = v)),
          h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: save }, 'Save'),
          h('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: remove }, 'Delete'))),
    );
  }
  makeSortable(list, attempt(async (keys) => {
    await api('/services/reorder', { method: 'POST', body: { ids: keys.map(Number) } });
    toast('Order saved');
  }));

  const add = attempt(async () => {
    await api('/services', { method: 'POST', body: { title: 'New service', published: false } });
    await render();
  });
  main.append(
    h('div', { class: 'head' }, h('h1', null, 'Services'), h('button', { type: 'button', class: 'btn btn--primary', onclick: add }, 'Add service')),
    h('p', { class: 'hint' }, 'New services start unpublished. Tick “Published” and save to show them on the Services page.'),
    list,
  );
}

/* ---------------- Settings ---------------- */

async function settingsView(main) {
  const { settings, categories } = await api('/settings');
  const s = { ...settings };
  let cats = categories.map((c) => ({ ...c }));

  const bindK = (key, attrs, tag = 'input') => {
    const el = h(tag, { ...(tag === 'input' ? { type: 'text' } : {}), ...attrs });
    el.value = s[key] || '';
    el.addEventListener('input', () => (s[key] = el.value));
    return el;
  };

  const catBox = h('div', { class: 'cats' });
  const renderCats = () => {
    clear(catBox);
    cats.forEach((c, i) =>
      catBox.append(h('div', { class: 'cat' },
        h('input', { class: 'cap', type: 'text', value: c.label, maxlength: 40, 'aria-label': `Category ${i + 1}`, oninput: (e) => (c.label = e.target.value) }),
        h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { cats.splice(i, 1); renderCats(); } }, 'Remove'))),
    );
  };
  renderCats();

  const save = attempt(async () => {
    const data = await api('/settings', { method: 'PUT', body: { settings: s, categories: cats.map((c) => ({ slug: c.slug, label: c.label })) } });
    cats = data.categories;
    renderCats();
    toast('Settings saved');
  });

  main.append(
    h('div', { class: 'head' }, h('h1', null, 'Settings')),
    h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      field('Tagline (home page, when there is no featured work)', bindK('tagline', { maxlength: 160 })),
      field('About (shown in the Info panel; blank line = new paragraph)', bindK('about', { maxlength: 5000 }, 'textarea')),
      h('div', { class: 'grid2' },
        field('Location', bindK('location', { maxlength: 120 })),
        field('Contact email', bindK('email', { type: 'email', maxlength: 200 }))),
      h('div', { class: 'grid2' },
        field('Instagram link', bindK('instagram', { type: 'url', placeholder: 'https://…' })),
        field('Behance link', bindK('behance', { type: 'url', placeholder: 'https://…' })),
        field('LinkedIn link', bindK('linkedin', { type: 'url', placeholder: 'https://…' }))),
      h('fieldset', { class: 'panel' },
        h('legend', null, 'Project categories (filters on the home page)'),
        catBox,
        h('div', { class: 'add-media' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { cats.push({ slug: '', label: '' }); renderCats(); catBox.querySelector('.cat:last-child input').focus(); } }, 'Add category')),
        h('p', { class: 'hint' }, 'Renaming a category keeps its projects. Removing one leaves its projects visible under “All”.')),
      h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save settings'))),
  );
}

/* ---------------- Shell and routing ---------------- */

let me = '';
const main = h('main', { class: 'main' });
const tabs = h('nav', { class: 'tabs', 'aria-label': 'Admin sections' },
  ...[['projects', 'Projects'], ['services', 'Services'], ['settings', 'Settings']].map(([k, label]) => h('a', { href: `#/${k}`, dataset: { tab: k } }, label)));

async function render() {
  const [section, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const tab = ['projects', 'services', 'settings'].includes(section) ? section : 'projects';
  tabs.querySelectorAll('a').forEach((a) => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  clear(main);
  try {
    if (tab === 'projects' && arg) await projectEditor(main, arg === 'new' ? null : Number(arg));
    else if (tab === 'projects') await projectsView(main);
    else if (tab === 'services') await servicesView(main);
    else await settingsView(main);
  } catch (e) {
    clear(main).append(h('p', { class: 'state', role: 'alert' }, e.message));
  }
  scrollTo(0, 0);
}

try {
  me = (await api('/me')).email;
  clear(root).append(
    h('div', { class: 'shell' },
      h('header', { class: 'topbar' }, h('strong', null, 'Angel Harris · Admin'), tabs, h('div', { class: 'who' }, h('span', null, me), h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'))),
      main),
  );
  addEventListener('hashchange', render);
  await render();
} catch (e) {
  clear(root).append(h('p', { class: 'state', role: 'alert' }, e.message));
}
