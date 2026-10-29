import { HttpError } from './http.js';
import { bool, str } from './util.js';

export function cleanService(b) {
  const title = str(b.title, 120, 'Title');
  if (!title) throw new HttpError(400, 'Title is required');
  const details = (Array.isArray(b.details) ? b.details : String(b.details || '').split('\n'))
    .map((d) => String(d).trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 12)
    .join('\n');
  return {
    title,
    description: str(b.description, 1000, 'Description'),
    details,
    published: bool(b.published),
  };
}
