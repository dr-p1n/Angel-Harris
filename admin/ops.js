import { h, clear } from '/assets/js/dom.js';
import { api, attempt, field, localISO, prettyDate, toast } from './lib.js';

const PRIORITIES = [['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
const COLUMNS = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
const RECUR = [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];

// Remembered while the admin stays open.
let view = 'board';
let priFilter = 'all';
let showDone = false;
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

export async function operationsView(main) {
  const today = localISO();
  let tasks = [];
  let projects = [];

  const content = h('div');
  const dialog = h('dialog', { class: 'dlg' });

  const byDue = (a, b) => RANK[a.priority] - RANK[b.priority] || (a.due_date || '9999').localeCompare(b.due_date || '9999') || b.id - a.id;

  const reload = async () => {
    [{ tasks }, { projects }] = await Promise.all([api('/tasks'), api('/projects')]);
    await draw();
  };

  /* ---------- task editor dialog ---------- */
  const openEditor = (task) => {
    const t = task ? { ...task } : { title: '', notes: '', priority: 'normal', status: 'todo', due_date: '', recurrence: 'none', project_id: '' };
    const sel = (opts, value, onchange) => h('select', { onchange: (e) => onchange(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) ? '' : null }, l)));
    const title = h('input', { type: 'text', value: t.title, maxlength: 160, required: '' });
    title.addEventListener('input', () => (t.title = title.value));
    const notes = h('textarea', { rows: 4, maxlength: 2000 });
    notes.value = t.notes || '';
    notes.addEventListener('input', () => (t.notes = notes.value));

    const open = projects.filter((p) => p.status !== 'completed');
    const projectOpts = [['', 'No project'], ...open.map((p) => [p.id, p.title]), ...(t.project_id && !open.some((p) => p.id === t.project_id) ? [[t.project_id, t.project_title || 'Project']] : [])];

    const save = attempt(async () => {
      if (!t.title.trim()) { toast('Add a title first', true); return; }
      const body = { ...t, project_id: t.project_id || null };
      if (task) await api(`/tasks/${task.id}`, { method: 'PUT', body });
      else await api('/tasks', { method: 'POST', body });
      dialog.close();
      toast('Saved');
      await reload();
    });

    clear(dialog).append(
      h('form', { class: 'form dlg__form', onsubmit: (e) => { e.preventDefault(); save(); } },
        h('h2', null, task ? 'Edit task' : 'New task'),
        field('Task', title),
        field('Notes', notes),
        h('div', { class: 'grid2' },
          field('Priority', sel(PRIORITIES, t.priority, (v) => (t.priority = v))),
          field('Status', sel(COLUMNS, t.status, (v) => (t.status = v)))),
        h('div', { class: 'grid2' },
          field('Due date', h('input', { type: 'date', value: t.due_date || '', oninput: (e) => (t.due_date = e.target.value) })),
          field('Repeats', sel(RECUR, t.recurrence, (v) => (t.recurrence = v)))),
        field('Related project (optional)', sel(projectOpts, t.project_id || '', (v) => (t.project_id = v ? Number(v) : null))),
        h('p', { class: 'hint' }, 'Repeating tasks reschedule themselves when you mark them done. A repeating task needs a due date to stay on the calendar.'),
        h('div', { class: 'actions' },
          h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save task'),
          h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, 'Cancel'),
          task ? h('button', { type: 'button', class: 'btn btn--danger', onclick: attempt(async () => {
            if (!confirm(`Delete "${task.title}"?`)) return;
            await api(`/tasks/${task.id}`, { method: 'DELETE' });
            dialog.close();
            toast('Deleted');
            await reload();
          }) }, 'Delete') : null)),
    );
    dialog.showModal();
    title.focus();
  };

  const setStatus = attempt(async (task, status) => {
    const res = await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status } });
    if (res.advanced) toast(`Done. Next one is due ${prettyDate(res.task.due_date)}`);
    await reload();
  });

  /* ---------- board ---------- */
  const dueChip = (t) => {
    if (!t.due_date) return null;
    const cls = t.status !== 'done' && t.due_date < today ? 'due--over' : t.due_date === today ? 'due--today' : '';
    return h('span', { class: `due ${cls}` }, t.due_date === today ? 'Today' : prettyDate(t.due_date));
  };

  const card = (t) =>
    h('li', { class: `task pri-${t.priority}${t.status === 'done' ? ' is-done' : ''}` },
      h('div', { class: 'task__top' }, h('span', { class: 'dot', title: t.priority }), h('strong', null, t.title)),
      t.notes ? h('p', { class: 'task__notes' }, t.notes) : null,
      h('div', { class: 'task__meta' },
        dueChip(t),
        t.recurrence !== 'none' ? h('span', { class: 'pill' }, `↻ ${t.recurrence}`) : null,
        t.project_id ? h('a', { class: 'task__proj', href: `#/projects/${t.project_id}` }, t.project_title || 'Project') : null),
      h('div', { class: 'task__actions' },
        t.status === 'todo' ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => setStatus(t, 'doing') }, 'Start') : null,
        t.status === 'doing' ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => setStatus(t, 'todo') }, 'Back') : null,
        t.status !== 'done' ? h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: () => setStatus(t, 'done') }, 'Done') : h('button', { type: 'button', class: 'btn btn--sm', onclick: () => setStatus(t, 'todo') }, 'Reopen'),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: () => openEditor(t) }, 'Edit')),
    );

  const board = () => {
    const visible = tasks.filter((t) => priFilter === 'all' || t.priority === priFilter);
    const cols = COLUMNS.filter(([k]) => k !== 'done' || showDone).map(([key, label]) => {
      const items = visible.filter((t) => t.status === key).sort(key === 'done' ? (a, b) => (b.done_at || '').localeCompare(a.done_at || '') : byDue);
      return h('section', { class: 'col' },
        h('h2', { class: 'col__title' }, label, ' ', h('small', null, items.length)),
        items.length ? h('ul', { class: 'tasklist' }, items.map(card)) : h('p', { class: 'hint' }, key === 'done' ? 'Nothing finished recently.' : 'Nothing here.'));
    });
    return h('div', { class: `board board--${cols.length}` }, cols);
  };

  /* ---------- calendar ---------- */
  const calendar = async () => {
    const first = new Date(calMonth);
    const offset = (first.getDay() + 6) % 7; // week starts Monday
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const from = localISO(days[0]);
    const to = localISO(days[41]);
    const sched = await api(`/schedule?from=${from}&to=${to}`);

    const itemsFor = (iso) => [
      ...sched.projects.filter((p) => p.due_date === iso).map((p) => ({ kind: 'project', text: `⚑ ${p.title}`, cls: 'ci--project', go: () => (location.hash = `#/projects/${p.id}`) })),
      ...sched.milestones.filter((m) => m.due_date === iso).map((m) => ({ kind: 'ms', text: `◇ ${m.title}`, title: m.project_title, cls: m.done ? 'ci--ms ci--done' : 'ci--ms', go: () => (location.hash = `#/projects/${m.project_id}`) })),
      ...sched.tasks.filter((t) => t.due_date === iso && (priFilter === 'all' || t.priority === priFilter)).sort(byDue).map((t) => ({
        kind: 'task', text: t.title, cls: `ci--task pri-${t.priority}${t.status === 'done' ? ' ci--done' : ''}`,
        go: () => { const full = tasks.find((x) => x.id === t.id); full ? openEditor(full) : toast('That older task is no longer on the board', true); },
      })),
    ];

    const monthLabel = calMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const nav = h('div', { class: 'cal__nav' },
      h('button', { type: 'button', class: 'btn btn--sm', 'aria-label': 'Previous month', onclick: () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); draw(); } }, '←'),
      h('strong', null, monthLabel),
      h('button', { type: 'button', class: 'btn btn--sm', 'aria-label': 'Next month', onclick: () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); draw(); } }, '→'),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); draw(); } }, 'Today'));

    const grid = h('div', { class: 'cal' },
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => h('div', { class: 'cal__dow' }, d)),
      days.map((d) => {
        const iso = localISO(d);
        const items = itemsFor(iso);
        const cell = h('div', { class: `cal__day${d.getMonth() !== calMonth.getMonth() ? ' is-other' : ''}${iso === today ? ' is-today' : ''}` }, h('span', { class: 'cal__n' }, d.getDate()));
        items.slice(0, 3).forEach((it) => cell.append(h('button', { type: 'button', class: `ci ${it.cls}`, title: it.title ? `${it.text} (${it.title})` : it.text, onclick: it.go }, it.text)));
        if (items.length > 3) cell.append(h('span', { class: 'hint cal__more' }, `+${items.length - 3} more`));
        return cell;
      }));
    return h('div', null, nav, grid, h('p', { class: 'hint' }, 'Tasks, project milestones (◇) and project due dates (⚑) by day. Click one to open it.'));
  };

  /* ---------- toolbar and draw ---------- */
  const draw = async () => {
    clear(toolbar);
    toolbar.append(
      h('div', { class: 'filter-chips', role: 'group', 'aria-label': 'View' },
        ...[['board', 'Board'], ['calendar', 'Calendar']].map(([k, l]) => h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(view === k), onclick: () => { view = k; draw(); } }, l))),
      h('div', { class: 'filter-chips', role: 'group', 'aria-label': 'Priority' },
        ...[['all', 'All priorities'], ...PRIORITIES].map(([k, l]) => h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(priFilter === k), onclick: () => { priFilter = k; draw(); } }, l))),
      ...(view === 'board' ? [h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: showDone ? '' : null, onchange: (e) => { showDone = e.target.checked; draw(); } }), 'Show done')] : []),
    );
    clear(content).append(view === 'board' ? board() : await calendar());
  };

  const toolbar = h('div', { class: 'toolbar' });
  main.append(
    h('div', { class: 'head' },
      h('h1', null, 'Operations'),
      h('div', { class: 'add-media' },
        h('button', { type: 'button', class: 'btn', onclick: attempt(async () => {
          const r = await api('/digest', { method: 'POST' });
          toast(r.sent ? 'Digest emailed to you' : 'Nothing to send');
        }) }, 'Email me the digest now'),
        h('button', { type: 'button', class: 'btn btn--primary', onclick: () => openEditor(null) }, 'New task'))),
    h('p', { class: 'hint' }, 'Internal priorities and scheduled work. A digest of overdue and upcoming items is emailed every morning (nothing is sent on empty days).'),
    toolbar,
    content,
    dialog,
  );
  await reload();
}
