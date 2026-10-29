import { h, clear } from '/assets/js/dom.js';
import { STATUS_LABEL, features, api, attempt, check, dragControls, field, formatWhen, makeSortable, moveButtons, prettyDate, slugify, text, toast } from './lib.js';

let filter = 'all'; // remembered while the admin stays open

const HEALTH_LEVELS = [['green', 'On track'], ['yellow', 'Due within 2 weeks'], ['orange', 'Slipping'], ['red', 'Overdue']];
const healthTag = (health) => (health ? h('span', { class: `health health--${health.level}` }, health.label) : null);

const progressBar = (pct) => {
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('i'));
  bar.firstChild.style.setProperty('--p', `${pct}%`);
  return bar;
};

/* ---------------- Projects list ---------------- */

export async function projectsView(main) {
  const [{ projects }, { categories }] = await Promise.all([api('/projects'), api('/settings')]);
  const label = (slug) => (categories.find((c) => c.slug === slug) || {}).label || slug || 'Uncategorised';
  const count = (s) => (s === 'all' ? projects.length : projects.filter((p) => p.status === s).length);

  const toggle = attempt(async (id, patch) => {
    await api(`/projects/${id}`, { method: 'PATCH', body: patch });
    toast('Updated');
  });

  const listBox = h('div');
  const chipBar = h('div', { class: 'filter-chips', role: 'group', 'aria-label': 'Filter by status' });

  const drawList = () => {
    const shown = filter === 'all' ? projects : projects.filter((p) => p.status === filter);
    const reorderable = filter === 'all';
    const list = h('ol', { class: 'rows' });
    for (const p of shown) {
      const tracking = p.status !== 'completed';
      list.append(
        h('li', { class: `row${reorderable ? '' : ' row--plain'}${tracking && HEALTH_LEVELS.some(([l]) => l === p.health?.level) ? ` has-health health--${p.health.level}` : ''}`, dataset: { key: p.id } },
          reorderable ? h('div', null, dragControls(), moveButtons()) : h('div'),
          p.cover_url ? h('img', { class: 'row__thumb', src: p.cover_url, alt: '' }) : h('div', { class: 'row__thumb' }),
          h('div', null,
            h('div', { class: 'row__title' }, p.title, ' ', h('span', { class: `pill pill--${p.status}` }, STATUS_LABEL[p.status] || p.status)),
            h('div', { class: 'row__sub' }, [p.client, p.due_date ? `Due ${prettyDate(p.due_date)}` : '', p.published ? `/work/${p.slug}` : 'Not on the site', p.has_share && features.clientPortal ? 'Client link on' : ''].filter(Boolean).join(' · ')),
            tracking ? h('div', { class: 'row__sub' }, healthTag(p.health)) : null,
            tracking ? h('div', { class: 'row__progress' }, progressBar(p.progress_effective), h('span', { class: 'hint' }, `${p.progress_effective}%`)) : null),
          h('div', { class: 'row__ctl' },
            check('On site', p.published, (v) => toggle(p.id, { published: v })),
            h('a', { class: 'btn btn--sm', href: `#/projects/${p.id}` }, 'Open'))),
      );
    }
    if (reorderable) {
      makeSortable(list, attempt(async (keys) => {
        await api('/projects/reorder', { method: 'POST', body: { ids: keys.map(Number) } });
        toast('Order saved');
      }));
    }
    clear(listBox).append(shown.length ? list : h('p', { class: 'hint' }, projects.length ? 'No projects with this status.' : 'No projects yet. Create the first one.'));
  };

  const drawChips = () => {
    clear(chipBar);
    for (const [key, text_] of [['all', 'All'], ['ongoing', 'Ongoing'], ['on_hold', 'On hold'], ['completed', 'Completed']]) {
      chipBar.append(h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(filter === key), onclick: () => { filter = key; drawChips(); drawList(); } }, `${text_} `, h('small', null, count(key))));
    }
  };
  drawChips();
  drawList();

  main.append(
    h('div', { class: 'head' }, h('h1', null, 'Projects'), h('a', { class: 'btn btn--primary', href: '#/projects/new' }, 'New project')),
    h('p', { class: 'hint' }, 'Track client work here (status, milestones, deliverables, updates). “On site” puts a finished piece in the public portfolio; drag to set the order in “All”.'),
    chipBar,
    h('div', { class: 'legend hint', 'aria-label': 'Colour key' }, HEALTH_LEVELS.map(([level, text_]) => h('span', { class: `health health--${level}` }, text_))),
    listBox,
  );
}

/* ---------------- Project editor ---------------- */

// Lets image files be dropped onto a box. Reordering uses a different drag (no files), so the two never clash.
function dropZone(box, onFiles) {
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  box.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); box.classList.add('is-drop'); } });
  box.addEventListener('dragleave', (e) => { if (!box.contains(e.relatedTarget)) box.classList.remove('is-drop'); });
  box.addEventListener('drop', attempt(async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    box.classList.remove('is-drop');
    const images = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) throw new Error('Drop image files (JPEG, PNG, WebP or AVIF)');
    await onFiles(images);
  }));
  return box;
}

export async function projectEditor(main, id, { render }) {
  const [{ categories }, loaded, loadedWork] = await Promise.all([
    api('/settings'),
    id ? api(`/projects/${id}`) : null,
    id ? api(`/projects/${id}/work`) : null,
  ]);
  let p = loaded
    ? loaded.project
    : { title: '', slug: '', category: categories[0]?.slug || '', summary: '', body: '', year: String(new Date().getFullYear()), client: '', role: '', tags: [], featured: false, published: false, cover_url: '', status: 'ongoing', progress: 0, due_date: '' };
  let media = loaded ? loaded.media : [];
  const work = loadedWork || { milestones: [], deliverables: [], updates: [], share_token: null };
  let seq = 0;
  media = media.map((m) => ({ ...m, _k: ++seq }));
  let milestones = work.milestones.map((m) => ({ ...m, _k: ++seq }));
  let deliverables = work.deliverables.map((d) => ({ ...d, _k: ++seq }));
  let updates = work.updates;
  let shareToken = work.share_token;
  let slugTouched = !!id;

  const bind = (key, attrs, tag = 'input') => {
    const el = h(tag, { ...(tag === 'input' ? { type: 'text' } : {}), ...attrs });
    el.value = Array.isArray(p[key]) ? p[key].join(', ') : p[key] ?? '';
    el.addEventListener('input', () => (p[key] = el.value));
    return el;
  };

  /* --- overview --- */
  const slugInput = text(p.slug, { placeholder: 'auto-generated from the title' });
  slugInput.addEventListener('input', () => { slugTouched = true; p.slug = slugInput.value; });
  const titleInput = text(p.title, { maxlength: 120, required: '' });
  titleInput.addEventListener('input', () => {
    p.title = titleInput.value;
    if (!slugTouched) { p.slug = slugify(p.title); slugInput.value = p.slug; }
  });
  const statusSelect = h('select', { onchange: (e) => (p.status = e.target.value) },
    Object.entries(STATUS_LABEL).map(([v, l]) => h('option', { value: v, selected: v === p.status ? '' : null }, l)));
  const dueInput = h('input', { type: 'date', value: p.due_date || '', oninput: (e) => (p.due_date = e.target.value) });

  /* --- progress --- */
  const progressBox = h('div', { class: 'progress-box' });
  const drawProgress = () => {
    const total = milestones.length;
    const done = milestones.filter((m) => m.done).length;
    const pct = total ? Math.round((done / total) * 100) : Math.min(100, Math.max(0, Number(p.progress) || 0));
    clear(progressBox).append(
      progressBar(pct),
      h('div', { class: 'hint' }, total ? `${pct}% · calculated from ${done} of ${total} milestones` : `${pct}% · set manually (add milestones to calculate it automatically)`),
    );
  };
  const manualProgress = h('input', { type: 'number', min: 0, max: 100, value: p.progress || 0, oninput: (e) => { p.progress = e.target.value; drawProgress(); } });

  /* --- milestones --- */
  const msList = h('ul', { class: 'media-list' });
  const drawMilestones = () => {
    clear(msList);
    if (!milestones.length) msList.append(h('li', { class: 'hint' }, 'No milestones yet. Add the steps of this project.'));
    for (const m of milestones) {
      msList.append(
        h('li', { class: 'ms-row', dataset: { key: m._k } },
          h('div', null, dragControls(), moveButtons()),
          h('input', { type: 'checkbox', checked: m.done ? '' : null, 'aria-label': 'Done', onchange: (e) => { m.done = e.target.checked; drawProgress(); } }),
          h('input', { class: 'cap', type: 'text', value: m.title, placeholder: 'Milestone', maxlength: 120, 'aria-label': 'Milestone', oninput: (e) => (m.title = e.target.value) }),
          h('input', { class: 'cap', type: 'date', value: m.due_date || '', 'aria-label': 'Due date', oninput: (e) => (m.due_date = e.target.value) }),
          features.clientPortal ? check('Client sees', m.client_visible, (v) => (m.client_visible = v)) : null,
          h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { milestones = milestones.filter((x) => x !== m); drawMilestones(); drawProgress(); } }, 'Remove')),
      );
    }
  };
  makeSortable(msList, (keys) => {
    const by = new Map(milestones.map((m) => [String(m._k), m]));
    milestones = keys.map((k) => by.get(k)).filter(Boolean);
  });

  /* --- deliverables --- */
  const dlList = h('ul', { class: 'media-list' });
  const drawDeliverables = () => {
    clear(dlList);
    if (!deliverables.length) dlList.append(h('li', { class: 'hint' }, 'No deliverables yet. Add what the client will receive, with a link to the files.'));
    for (const d of deliverables) {
      dlList.append(
        h('li', { class: 'dl-row', dataset: { key: d._k } },
          h('div', null, dragControls(), moveButtons()),
          h('div', { class: 'dl-row__body' },
            h('div', { class: 'grid2' },
              h('input', { class: 'cap', type: 'text', value: d.title, placeholder: 'Deliverable', maxlength: 120, 'aria-label': 'Deliverable', oninput: (e) => (d.title = e.target.value) }),
              h('input', { class: 'cap', type: 'url', value: d.url || '', placeholder: 'Link to the files (https://…)', maxlength: 500, 'aria-label': 'Link', oninput: (e) => (d.url = e.target.value) })),
            h('input', { class: 'cap', type: 'text', value: d.description || '', placeholder: 'Short description (optional)', maxlength: 500, 'aria-label': 'Description', oninput: (e) => (d.description = e.target.value) }),
            h('div', { class: 'mitem__ctl' },
              h('select', { class: 'cap cap--auto', 'aria-label': 'Status', onchange: (e) => (d.status = e.target.value) },
                [['pending', 'Pending'], ['delivered', 'Delivered'], ['approved', 'Approved']].map(([v, l]) => h('option', { value: v, selected: v === d.status ? '' : null }, l))),
              features.clientPortal ? check('Client sees', d.client_visible, (v) => (d.client_visible = v)) : null,
              h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { deliverables = deliverables.filter((x) => x !== d); drawDeliverables(); } }, 'Remove')))),
      );
    }
  };
  makeSortable(dlList, (keys) => {
    const by = new Map(deliverables.map((d) => [String(d._k), d]));
    deliverables = keys.map((k) => by.get(k)).filter(Boolean);
  });

  /* --- client link --- */
  const shareBox = h('div', { class: 'share' });
  const drawShare = () => {
    clear(shareBox);
    if (!id) {
      shareBox.append(h('p', { class: 'hint' }, 'Save the project first, then you can create a private link for the client.'));
      return;
    }
    if (!shareToken) {
      shareBox.append(
        h('p', { class: 'hint' }, 'No client link yet. A link gives read-only access to progress, milestones, deliverables and updates marked “Client sees”. Anyone who has the link can view it.'),
        h('button', { type: 'button', class: 'btn', onclick: attempt(async () => { shareToken = (await api(`/projects/${id}/share`, { method: 'POST' })).share_token; drawShare(); toast('Client link created'); }) }, 'Create client link'),
      );
      return;
    }
    const url = `${location.origin}/client/${shareToken}`;
    const input = h('input', { class: 'cap', type: 'text', readonly: '', value: url, 'aria-label': 'Client link', onfocus: (e) => e.target.select() });
    shareBox.append(
      h('div', { class: 'add-media' }, input,
        h('button', { type: 'button', class: 'btn btn--sm', onclick: attempt(async () => {
          try { await navigator.clipboard.writeText(url); } catch { input.select(); document.execCommand('copy'); }
          toast('Link copied');
        }) }, 'Copy'),
        h('a', { class: 'btn btn--sm', href: url, target: '_blank', rel: 'noopener' }, 'Preview')),
      h('div', { class: 'add-media' },
        h('button', { type: 'button', class: 'btn btn--sm', onclick: attempt(async () => {
          if (!confirm('Create a new link? The old link will stop working.')) return;
          shareToken = (await api(`/projects/${id}/share`, { method: 'POST' })).share_token; drawShare(); toast('New link created');
        }) }, 'Replace link'),
        h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: attempt(async () => {
          if (!confirm('Turn the client link off? Anyone using it will see “not found”.')) return;
          await api(`/projects/${id}/share`, { method: 'DELETE' }); shareToken = null; drawShare(); toast('Client link turned off');
        }) }, 'Turn off')),
      h('p', { class: 'hint' }, 'Treat this link like a password: anyone who has it can see the client-visible items.'),
    );
  };

  /* --- updates log --- */
  const updList = h('ul', { class: 'upd-list' });
  const newUpdate = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'What happened? Decisions, feedback, next steps…', 'aria-label': 'New update' });
  let updVisible = false;
  const drawUpdates = () => {
    clear(updList);
    if (!updates.length) updList.append(h('li', { class: 'hint' }, 'No updates yet.'));
    for (const u of updates) {
      updList.append(
        h('li', { class: 'upd' },
          h('div', { class: 'msg__head' }, h('span', { class: 'hint' }, formatWhen(u.created_at)), features.clientPortal ? h('span', { class: `pill ${u.client_visible ? 'pill--ongoing' : ''}` }, u.client_visible ? 'Client sees' : 'Internal') : null),
          h('p', { class: 'msg__body' }, u.body),
          h('div', { class: 'actions msg__actions' },
            features.clientPortal ? h('button', { type: 'button', class: 'btn btn--sm', onclick: attempt(async () => {
              await api(`/updates/${u.id}`, { method: 'PATCH', body: { client_visible: !u.client_visible } });
              u.client_visible = !u.client_visible; drawUpdates();
            }) }, u.client_visible ? 'Make internal' : 'Show to client') : null,
            h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: attempt(async () => {
              if (!confirm('Delete this update?')) return;
              await api(`/updates/${u.id}`, { method: 'DELETE' }); updates = updates.filter((x) => x !== u); drawUpdates();
            }) }, 'Delete'))),
      );
    }
  };
  const updateBox = id
    ? h('div', { class: 'panel' },
        h('strong', null, 'Updates'),
        newUpdate,
        h('div', { class: 'add-media' },
          features.clientPortal ? check('Visible to client', false, (v) => (updVisible = v)) : null,
          h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: attempt(async () => {
            const body = newUpdate.value.trim();
            if (!body) { toast('Write something first', true); return; }
            const { update } = await api(`/projects/${id}/updates`, { method: 'POST', body: { body, client_visible: updVisible } });
            updates = [update, ...updates]; newUpdate.value = ''; drawUpdates(); toast('Update posted');
          }) }, 'Post update')),
        updList)
    : h('div', { class: 'panel' }, h('strong', null, 'Updates'), h('p', { class: 'hint' }, 'Save the project first to start an update log.'));

  /* --- portfolio: media --- */
  const catOptions = [...categories];
  if (p.category && !catOptions.some((c) => c.slug === p.category)) catOptions.push({ slug: p.category, label: p.category });
  const catSelect = h('select', { onchange: (e) => (p.category = e.target.value) }, [h('option', { value: '' }, 'Uncategorised'), ...catOptions.map((c) => h('option', { value: c.slug, selected: c.slug === p.category ? '' : null }, c.label))]);

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
  const uploadFiles = async (files) => {
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
  };
  fileInput.addEventListener('change', attempt(async () => {
    await uploadFiles([...fileInput.files]);
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

  /* --- save / delete --- */
  const save = attempt(async () => {
    if (!p.title.trim()) { toast('Add a title first', true); titleInput.focus(); return; }
    const body = { ...p, tags: String(p.tags), media: media.map(({ kind, url, caption }) => ({ kind, url, caption })) };
    const data = id ? await api(`/projects/${id}`, { method: 'PUT', body }) : await api('/projects', { method: 'POST', body });
    const pid = data.project.id;
    await api(`/projects/${pid}/work`, {
      method: 'PUT',
      body: {
        milestones: milestones.map(({ title, due_date, done, client_visible }) => ({ title, due_date, done, client_visible })),
        deliverables: deliverables.map(({ title, description, url, status, client_visible }) => ({ title, description, url, status, client_visible })),
      },
    });
    toast('Saved');
    if (id) await render(); else location.hash = `#/projects/${pid}`;
  });
  const remove = attempt(async () => {
    if (!confirm(`Delete "${p.title}"? Its milestones, deliverables, updates and uploaded images go too, and the client link stops working. This cannot be undone.`)) return;
    await api(`/projects/${id}`, { method: 'DELETE' });
    toast('Deleted');
    location.hash = '#/projects';
  });

  drawProgress(); drawMilestones(); drawDeliverables(); drawShare(); drawUpdates(); renderMedia();

  /* --- layout: overview + two sections --- */
  const trackingPanel = h('div', { class: 'section', id: 'sec-tracking' },
    h('div', { class: 'panel' },
      h('strong', null, 'Progress'),
      id && p.status !== 'completed' ? h('div', { class: 'hint' }, 'Schedule: ', healthTag(p.health), ' (as last saved)') : null,
      progressBox,
      field('Manual progress (%), used only when there are no milestones', manualProgress)),
    h('div', { class: 'panel' },
      h('strong', null, 'Milestones'),
      msList,
      h('div', { class: 'add-media' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { milestones.push({ _k: ++seq, title: '', due_date: '', done: false, client_visible: true }); drawMilestones(); drawProgress(); msList.querySelector('li:last-child .cap')?.focus(); } }, 'Add milestone'))),
    h('div', { class: 'panel' },
      h('strong', null, 'Deliverables'),
      dlList,
      h('div', { class: 'add-media' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { deliverables.push({ _k: ++seq, title: '', description: '', url: '', status: 'pending', client_visible: true }); drawDeliverables(); dlList.querySelector('li:last-child .cap')?.focus(); } }, 'Add deliverable'))),
    features.clientPortal ? h('div', { class: 'panel' }, h('strong', null, 'Client link'), shareBox) : null,
    updateBox,
  );

  const portfolioPanel = h('div', { class: 'section', id: 'sec-portfolio', hidden: '' },
    h('p', { class: 'hint' }, 'The public page for this project. Tick “On the site” when it is ready to show.'),
    h('div', { class: 'grid2' }, field('URL slug', slugInput), field('Type', catSelect)),
    field('Short summary (shown on the project page and in link previews)', bind('summary', { maxlength: 400 })),
    field('Description (blank line = new paragraph)', bind('body', { maxlength: 8000 }, 'textarea')),
    h('div', { class: 'grid2' }, field('Year', bind('year', { maxlength: 10 })), field('Role', bind('role', { maxlength: 120 }))),
    field('Tags (comma separated, e.g. Short, Game, Blender, PLA)', bind('tags', { maxlength: 200 })),
    dropZone(h('div', { class: 'panel' },
      h('strong', null, 'Media'),
      h('p', { class: 'hint' }, 'Drag images onto this box or use Upload. JPEG, PNG, WebP or AVIF, up to 10 MB each. Resize large images first for fast loading.'),
      mediaList,
      h('div', { class: 'add-media' }, h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Upload images'), fileInput, uploadStatus),
      h('div', { class: 'add-media' }, embedInput, h('button', { type: 'button', class: 'btn', onclick: addEmbed }, 'Add video'))), uploadFiles),
    check('On the site (visible in the public portfolio)', p.published, (v) => (p.published = v)),
  );

  const tabBtns = {};
  const show = (which) => {
    trackingPanel.hidden = which !== 'tracking';
    portfolioPanel.hidden = which !== 'portfolio';
    for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-selected', String(k === which));
  };
  const tabBar = h('div', { class: 'subtabs', role: 'tablist' },
    ...[['tracking', 'Project tracking'], ['portfolio', 'Portfolio page']].map(([k, l]) => (tabBtns[k] = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => show(k) }, l))));
  show(p.status === 'completed' && id ? 'portfolio' : 'tracking');

  main.append(
    h('div', { class: 'head' }, h('h1', null, id ? p.title || 'Project' : 'New project'), h('a', { class: 'btn', href: '#/projects' }, '← All projects')),
    h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      field('Title', titleInput),
      h('div', { class: 'grid2' }, field('Client', bind('client', { maxlength: 120 })), field('Status', statusSelect), field('Due date', dueInput)),
      tabBar,
      trackingPanel,
      portfolioPanel,
      h('div', { class: 'actions' },
        h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save project'),
        id && p.published ? h('a', { class: 'btn', href: `/work/${p.slug}`, target: '_blank', rel: 'noopener' }, 'View on site') : null,
        id ? h('button', { type: 'button', class: 'btn btn--danger', onclick: remove }, 'Delete') : null)),
  );
}
