// Emails Angel when a contact-form message arrives.
//
// Pages Functions can't use the send_email binding, so /api/contact calls this
// Worker through a service binding (MAILER). It has no public URL
// (workers_dev = false), so only the Pages project can reach it.
//
// Secret (never committed): NOTIFY_TO, set with `wrangler secret put NOTIFY_TO`.
// The address must be a verified destination in Cloudflare Email Routing.

const oneLine = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.NOTIFY_TO || !env.NOTIFY_FROM) return new Response('Mailer is not configured', { status: 503 });

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const name = oneLine(data.name, 100);
    const email = oneLine(data.email, 200);
    const message = String(data.message || '').slice(0, 4000);
    if (!name || !email || !message) return new Response('Bad request', { status: 400 });

    try {
      await env.EMAIL.send({
        to: env.NOTIFY_TO,
        from: { email: env.NOTIFY_FROM, name: 'Angel Harris website' },
        replyTo: { email, name },
        subject: `New message from ${name}`,
        text: `${message}\n\n--\nFrom: ${name} <${email}>\nHit reply to answer them directly. All messages are also in the admin portal.`,
        html: `<p style="white-space:pre-wrap">${esc(message)}</p><hr><p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;<br>Hit reply to answer them directly. All messages are also in the admin portal.</p>`,
      });
    } catch (e) {
      console.error('send failed', e.code, e.message);
      return new Response('Send failed', { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  },
};
