// Emails Angel from the website: contact-form notifications and a daily operations digest.
//
// Pages Functions can't use the send_email binding, so they call this Worker through a
// service binding (MAILER). It has no public URL (workers_dev = false). A Cron Trigger runs
// the daily digest.
//
// Secret (never committed): NOTIFY_TO, set with `wrangler secret put NOTIFY_TO`.
// The address must be a verified destination in Cloudflare Email Routing.

const oneLine = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ADMIN_URL = 'https://angelharrisportfolio.com/admin/#/operations';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86400000));
const pretty = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function send(env, message) {
  return env.EMAIL.send({ to: env.NOTIFY_TO, from: { email: env.NOTIFY_FROM, name: 'Angel Harris website' }, ...message });
}

/* ---------- Contact form notification ---------- */

async function notify(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const name = oneLine(data.name, 100);
  const email = oneLine(data.email, 200);
  const message = String(data.message || '').slice(0, 4000);
  const subject = oneLine(data.subject, 150) || `New message from ${name}`;
  if (!name || !email || !message) return new Response('Bad request', { status: 400 });

  try {
    await send(env, {
      replyTo: { email, name },
      subject,
      text: `${message}\n\n--\nFrom: ${name} <${email}>\nHit reply to answer them directly. All messages are also in the admin portal.`,
      html: `<p style="white-space:pre-wrap">${esc(message)}</p><hr><p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;<br>Hit reply to answer them directly. All messages are also in the admin portal.</p>`,
    });
  } catch (e) {
    console.error('send failed', e.code, e.message);
    return new Response('Send failed', { status: 502 });
  }
  return Response.json({ ok: true });
}

/* ---------- Daily digest ---------- */

async function collect(env, today) {
  const soonEnd = addDays(today, 3);
  const mileEnd = addDays(today, 7);
  const { results: open } = await env.DB
    .prepare(
      `SELECT t.title, t.priority, t.due_date, t.recurrence, p.title AS project
         FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.status != 'done' AND ((t.due_date != '' AND t.due_date <= ?) OR (t.priority = 'urgent' AND t.due_date = ''))
        ORDER BY t.due_date`,
    )
    .bind(soonEnd)
    .all();
  const { results: milestones } = await env.DB
    .prepare(
      `SELECT m.title, m.due_date, p.title AS project
         FROM milestones m JOIN projects p ON p.id = m.project_id
        WHERE m.done = 0 AND m.due_date != '' AND m.due_date <= ? AND p.status = 'ongoing'
        ORDER BY m.due_date`,
    )
    .bind(mileEnd)
    .all();
  const ongoing = (await env.DB.prepare("SELECT COUNT(*) AS n FROM projects WHERE status = 'ongoing'").first()).n;

  const byPriority = (a, b) => RANK[a.priority] - RANK[b.priority];
  return {
    overdue: open.filter((t) => t.due_date && t.due_date < today).sort(byPriority),
    today: open.filter((t) => t.due_date === today).sort(byPriority),
    soon: open.filter((t) => t.due_date > today),
    urgentUndated: open.filter((t) => !t.due_date),
    milestones,
    ongoing,
  };
}

function render(d, today) {
  const taskLine = (t) =>
    `${t.priority === 'urgent' ? '[URGENT] ' : t.priority === 'high' ? '[High] ' : ''}${t.title}${t.due_date ? ` (${pretty(t.due_date)})` : ''}${t.recurrence !== 'none' ? ` ↻ ${t.recurrence}` : ''}${t.project ? ` · ${t.project}` : ''}`;
  const sections = [
    ['Overdue', d.overdue.map(taskLine)],
    ['Due today', d.today.map(taskLine)],
    ['Urgent, no date', d.urgentUndated.map(taskLine)],
    ['Coming up in the next 3 days', d.soon.map(taskLine)],
    ['Project milestones in the next 7 days', d.milestones.map((m) => `${m.title} (${pretty(m.due_date)}) · ${m.project}`)],
  ].filter(([, items]) => items.length);

  const count = d.overdue.length + d.today.length;
  const subject = count ? `Daily digest: ${d.overdue.length} overdue, ${d.today.length} due today` : 'Daily digest: nothing urgent today';
  const head = `Your day, ${pretty(today)}. ${d.ongoing} ongoing project${d.ongoing === 1 ? '' : 's'}.`;

  const text = [head, '', ...(sections.length ? sections.flatMap(([title, items]) => [`${title.toUpperCase()} (${items.length})`, ...items.map((i) => `- ${i}`), '']) : ['Nothing due. Clear day.', '']), `Open the admin: ${ADMIN_URL}`].join('\n');
  const html = `<p>${esc(head)}</p>${
    sections.length
      ? sections.map(([title, items]) => `<h3 style="margin:16px 0 4px">${esc(title)} (${items.length})</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')
      : '<p>Nothing due. Clear day.</p>'
  }<p><a href="${ADMIN_URL}">Open the admin</a></p>`;
  return { subject, text, html, empty: sections.length === 0 };
}

// The cron skips empty days; the manual button (force) always sends.
async function sendDigest(env, { force }) {
  const today = iso(new Date());
  const digest = render(await collect(env, today), today);
  if (digest.empty && !force) return { sent: false, reason: 'nothing due' };
  await send(env, { subject: digest.subject, text: digest.text, html: digest.html });
  return { sent: true, subject: digest.subject };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.NOTIFY_TO || !env.NOTIFY_FROM) return new Response('Mailer is not configured', { status: 503 });

    if (new URL(request.url).pathname === '/digest') {
      try {
        return Response.json(await sendDigest(env, { force: true }));
      } catch (e) {
        console.error('digest failed', e.code, e.message);
        return new Response('Digest failed', { status: 502 });
      }
    }
    return notify(request, env);
  },

  async scheduled(event, env, ctx) {
    if (!env.NOTIFY_TO || !env.NOTIFY_FROM) return;
    ctx.waitUntil(sendDigest(env, { force: false }).catch((e) => console.error('digest failed', e.code, e.message)));
  },
};
