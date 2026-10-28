// Helpers shared by the admin screens.
import { h } from '/assets/js/dom.js';

const toastEl = document.getElementById('toast');
let toastTimer;

export function toast(message, isError) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', !!isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), isError ? 6000 : 2500);
}

export async function api(path, { method = 'GET', body, form } = {}) {
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
export const attempt = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (e) {
    toast(e.message, true);
  }
};

export const slugify = (s) =>
  String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const field = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
export const text = (value, attrs) => h('input', { type: 'text', value: value ?? '', ...attrs });
export const check = (label, checked, onchange) =>
  h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: checked ? '' : null, onchange: (e) => onchange(e.target.checked) }), label);

// Drag-to-reorder (via the handle) plus up/down buttons for keyboard users.
// Items need data-key; onChange receives the new key order.
export function makeSortable(list, onChange) {
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

export const dragControls = () => [h('span', { class: 'handle', title: 'Drag to reorder', 'aria-hidden': 'true' }, '⋮⋮')];
export const moveButtons = () =>
  h('span', { class: 'mv' },
    h('button', { type: 'button', 'data-move': 'up', 'aria-label': 'Move up' }, '▲'),
    h('button', { type: 'button', 'data-move': 'down', 'aria-label': 'Move down' }, '▼'));

export const formatWhen = (sqlTime) => {
  const d = new Date(`${sqlTime.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? sqlTime : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

// Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's day).
export const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const prettyDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const STATUS_LABEL = { ongoing: 'Ongoing', on_hold: 'On hold', completed: 'Completed' };
