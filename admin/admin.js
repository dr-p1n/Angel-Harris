import { h, clear } from '/assets/js/dom.js';
import { api, attempt, check, dragControls, features, field, formatWhen, makeSortable, moveButtons, toast } from './lib.js';
import { projectEditor, projectsView } from './projects.js';
import { operationsView } from './ops.js';
import { printsView } from './prints.js';

const root = document.getElementById('admin');

/* ---------------- Messages (contact form inbox) ---------------- */

async function messagesView(main) {
  const { messages, unread } = await api('/messages');
  setUnread(unread);
  const list = h('ol', { class: 'rows msgs' });

  for (const m of messages) {
    const item = h('li', { class: `panel msg${m.is_read ? '' : ' is-unread'}` });
    const readBtn = h('button', { type: 'button', class: 'btn btn--sm' });
    const draw = () => {
      readBtn.textContent = m.is_read ? 'Mark unread' : 'Mark read';
      item.classList.toggle('is-unread', !m.is_read);
    };
    readBtn.addEventListener('click', attempt(async () => {
      await api(`/messages/${m.id}`, { method: 'PATCH', body: { is_read: !m.is_read } });
      m.is_read = !m.is_read;
      draw();
      setUnread(messages.filter((x) => !x.is_read).length);
    }));
    const subject = encodeURIComponent('Re: your message on angelharrisportfolio.com');
    item.append(
      h('div', { class: 'msg__head' },
        h('div', null, h('strong', null, m.name), ' ', h('a', { href: `mailto:${m.email}?subject=${subject}` }, m.email)),
        h('span', { class: 'hint' }, formatWhen(m.created_at))),
      h('p', { class: 'msg__body' }, m.message),
      h('div', { class: 'actions msg__actions' },
        h('a', { class: 'btn btn--sm btn--primary', href: `mailto:${m.email}?subject=${subject}` }, 'Reply by email'),
        readBtn,
        h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: attempt(async () => {
          if (!confirm(`Delete the message from ${m.name}? This cannot be undone.`)) return;
          await api(`/messages/${m.id}`, { method: 'DELETE' });
          toast('Deleted');
          await render();
        }) }, 'Delete')),
    );
    draw();
    list.append(item);
  }

  main.append(
    h('div', { class: 'head' }, h('h1', null, 'Messages')),
    messages.length ? h('p', { class: 'hint' }, 'Sent from the Contact page on the site. Newest first.') : h('p', { class: 'hint' }, 'No messages yet. They will appear here when visitors use the Contact form.'),
    list,
  );
}

/* ---------------- Public services page editor (lives in Settings) ---------------- */

async function mountServices(box) {
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
      await mountServices(box);
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
    await mountServices(box);
  });
  clear(box).append(
    h('div', { class: 'head head--sub' },
      h('div', null, h('h2', null, 'Public Services page'), h('p', { class: 'hint' }, 'What visitors see at /services. New entries start unpublished: tick “Published” and save.')),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: add }, 'Add service')),
    services.length ? list : h('p', { class: 'hint' }, 'No services yet.'),
  );
}

/* ---------------- Storage: uploaded images no project uses any more ---------------- */

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

async function mountStorage(box) {
  let info;
  try {
    info = await api('/media');
  } catch (e) {
    clear(box).append(h('p', { class: 'hint' }, `Storage: ${e.message}`));
    return;
  }
  const clean = attempt(async () => {
    if (!confirm(`Delete ${info.unused.length} unused image${info.unused.length === 1 ? '' : 's'} (${mb(info.unused_bytes)}) for good? This cannot be undone.`)) return;
    const done = await api('/media', { method: 'DELETE' });
    toast(`Deleted ${done.deleted} image${done.deleted === 1 ? '' : 's'}`);
    await mountStorage(box);
  });
  clear(box).append(
    h('div', { class: 'head head--sub' },
      h('div', null,
        h('h2', null, 'Storage'),
        h('p', { class: 'hint' }, `${info.total} uploaded image${info.total === 1 ? '' : 's'} (${mb(info.bytes)}). `,
          info.unused.length
            ? `${info.unused.length} not used by any project (${mb(info.unused_bytes)}). Images uploaded in the last day are never listed.`
            : 'Every image is in use.')),
      info.unused.length ? h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: clean }, 'Delete unused images') : null),
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

  const servicesBox = h('section', { class: 'settings-services' });

  const storageBox = h('section', { class: 'settings-storage' });

  main.append(
    h('div', { class: 'head' }, h('h1', null, 'Settings')),
    h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      field('Home page headline', bindK('tagline', { maxlength: 160 })),
      field('Short bio (shown on the Home page under the headline; blank line = new paragraph)', bindK('about', { maxlength: 5000 }, 'textarea')),
      field('Showreel link (Vimeo or YouTube, shown on the Home page)', bindK('showreel', { type: 'url', placeholder: 'https://vimeo.com/…', maxlength: 300 })),
      h('fieldset', { class: 'panel' },
        h('legend', null, 'Page text'),
        h('p', { class: 'hint fieldset-note' }, 'Wording on the public pages. Leave a box empty to use the standard text.'),
        field('Line above the Home headline', bindK('eyebrow', { maxlength: 120, placeholder: 'Angel Harris · Digital animator' })),
        field('Services page intro', bindK('services_intro', { maxlength: 300 }, 'textarea')),
        field('Services: Digital animation card', bindK('offer_animation', { maxlength: 400 }, 'textarea')),
        field('Services: 3D printing card', bindK('offer_prints', { maxlength: 400 }, 'textarea')),
        field('Get a quote: 3D print intro', bindK('quote_intro', { maxlength: 400 }, 'textarea'))),
      h('div', { class: 'grid2' },
        field('Location', bindK('location', { maxlength: 120 })),
        field('Public contact email (optional; the Contact form works without it)', bindK('email', { type: 'email', maxlength: 200 }))),
      h('div', { class: 'grid2' },
        field('Instagram link', bindK('instagram', { type: 'url', placeholder: 'https://…' })),
        field('Behance link', bindK('behance', { type: 'url', placeholder: 'https://…' })),
        field('LinkedIn link', bindK('linkedin', { type: 'url', placeholder: 'https://…' }))),
      h('fieldset', { class: 'panel' },
        h('legend', null, 'Project types (the filters on the Projects page; Digital animation and 3D prints)'),
        catBox,
        h('div', { class: 'add-media' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { cats.push({ slug: '', label: '' }); renderCats(); catBox.querySelector('.cat:last-child input').focus(); } }, 'Add category')),
        h('p', { class: 'hint' }, 'Renaming a category keeps its projects. Removing one leaves its projects visible under “All”.')),
      h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save settings'))),
    h('hr', { class: 'divider' }),
    servicesBox,
    h('hr', { class: 'divider' }),
    storageBox,
  );
  await mountServices(servicesBox);
  await mountStorage(storageBox);
}

/* ---------------- Shell and routing ---------------- */

const TABS = [['projects', 'Projects'], ['prints', 'Quotes'], ['operations', 'Operations'], ['messages', 'Messages'], ['settings', 'Settings']];
const main = h('main', { class: 'main' });
const tabs = h('nav', { class: 'tabs', 'aria-label': 'Admin sections' },
  ...TABS.map(([k, label]) => h('a', { href: `#/${k}`, dataset: { tab: k } }, label)));

// Shows how many print quotes and animation enquiries are still new next to the Quotes tab.
const openCount = { quotes: 0, enquiries: 0 };
function setOpenQuotes(kind, n) {
  openCount[kind] = n;
  const total = openCount.quotes + openCount.enquiries;
  const a = tabs.querySelector('[data-tab="prints"]');
  if (a) a.textContent = total > 0 ? `Quotes (${total})` : 'Quotes';
}

// Shows the unread count next to the Messages tab.
function setUnread(n) {
  const a = tabs.querySelector('[data-tab="messages"]');
  if (a) a.textContent = n > 0 ? `Messages (${n})` : 'Messages';
}

async function render() {
  const [section, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const tab = TABS.some(([k]) => k === section) ? section : 'projects';
  tabs.querySelectorAll('a').forEach((a) => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  clear(main);
  main.classList.toggle('main--wide', tab === 'operations');
  try {
    if (tab === 'projects' && arg) await projectEditor(main, arg === 'new' ? null : Number(arg), { render });
    else if (tab === 'projects') await projectsView(main);
    else if (tab === 'prints') await printsView(main, { setOpen: setOpenQuotes });
    else if (tab === 'operations') await operationsView(main);
    else if (tab === 'messages') await messagesView(main);
    else await settingsView(main);
  } catch (e) {
    clear(main).append(h('p', { class: 'state', role: 'alert' }, e.message));
  }
  scrollTo(0, 0);
}

try {
  const meData = await api('/me');
  const me = meData.email;
  Object.assign(features, meData.features);
  clear(root).append(
    h('div', { class: 'shell' },
      h('header', { class: 'topbar' }, h('strong', null, 'Angel Harris · Admin'), tabs, h('div', { class: 'who' }, h('span', null, me), h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'))),
      main),
  );
  addEventListener('hashchange', render);
  api('/messages').then((d) => setUnread(d.unread)).catch(() => {});
  api('/quotes').then((d) => setOpenQuotes('quotes', d.open)).catch(() => {});
  api('/enquiries').then((d) => setOpenQuotes('enquiries', d.open)).catch(() => {});
  await render();
} catch (e) {
  clear(root).append(h('p', { class: 'state', role: 'alert' }, e.message));
}
