import { HttpError } from './http.js';
import { str } from './util.js';
import { cleanDate } from './work.js';

export const PRIORITIES = ['urgent', 'high', 'normal', 'low'];
export const TASK_STATUSES = ['todo', 'doing', 'done'];
export const RECURRENCES = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

export function cleanTask(b) {
  const title = str(b.title, 160, 'Title');
  if (!title) throw new HttpError(400, 'Title is required');
  const pid = Number(b.project_id);
  return {
    title,
    notes: str(b.notes, 2000, 'Notes'),
    priority: PRIORITIES.includes(b.priority) ? b.priority : 'normal',
    status: TASK_STATUSES.includes(b.status) ? b.status : 'todo',
    due_date: cleanDate(b.due_date, 'Due date'),
    recurrence: RECURRENCES.includes(b.recurrence) ? b.recurrence : 'none',
    project_id: Number.isInteger(pid) && pid > 0 ? pid : null,
  };
}

const iso = (d) => d.toISOString().slice(0, 10);

function addMonths(d, n) {
  const day = d.getUTCDate();
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last)); // Jan 31 + 1 month = Feb 28/29, not Mar 3
  return out;
}

// Next occurrence of a recurring task: one step after its due date, never in the past.
export function nextDue(due, recurrence, today) {
  let d = new Date(`${due || today}T00:00:00Z`);
  const step = () => {
    if (recurrence === 'daily') d = new Date(d.getTime() + 86400000);
    else if (recurrence === 'weekly') d = new Date(d.getTime() + 7 * 86400000);
    else if (recurrence === 'monthly') d = addMonths(d, 1);
    else d = addMonths(d, 12);
  };
  step();
  for (let guard = 0; iso(d) < today && guard < 2000; guard++) step();
  return iso(d);
}

export const todayUtc = () => iso(new Date());
