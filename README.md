# Angel Harris: portfolio

Portfolio de Angel Harris. Vanilla HTML/CSS/JS front-end, plus a small admin
portal backed by Cloudflare Pages Functions, D1 (database) and R2 (images).
No framework, no build step, no npm dependencies.

## What's in here

| Path | What it is |
|---|---|
| `index.html`, `services.html`, `project.html`, `contact.html`, `client.html` | Public pages (home grid + hero, services, case study, contact form, private client progress page) |
| `assets/` | Shared CSS and JS, placeholder artwork |
| `admin/` | Admin portal (projects, services, settings), served at `/admin/` |
| `functions/` | Cloudflare Pages Functions: public API, admin API, image serving, `/work/:slug` |
| `migrations/` | D1 schema (`0001_init.sql`, `0002_messages.sql`, `0003_workspace.sql`) |
| `seed/sample.sql` | **Sample content for local review only** |
| `_headers`, `robots.txt` | Security headers and (pre-launch) crawler blocking |
| `mailer/` | Tiny separate Worker that emails Angel when a contact message arrives |
| `dev/wrangler.toml` | Local-development config only; Cloudflare ignores it |

Public routes: `/`, `/work/<slug>`, `/services`, `/contact`. Private: `/client/<token>` (per-project client link). Admin: `/admin/`.

## Run it locally

Needs Node. Nothing is installed into the repo; `npx` fetches Wrangler on demand.

```bash
npx wrangler d1 migrations apply DB --local --config dev/wrangler.toml
npx wrangler d1 execute DB --local --config dev/wrangler.toml --file=seed/sample.sql
npx wrangler pages dev . --d1 DB=00000000-0000-0000-0000-000000000000 --r2 MEDIA --persist-to dev/.wrangler/state
```

Open http://localhost:8788. On `localhost` the admin API skips Cloudflare
Access (it identifies you as `dev@localhost`); a deployed site never does.

## Deploying to Cloudflare (one-time setup)

The Pages project `angel-harris` already deploys from GitHub. Add these in the
Cloudflare dashboard. Do it for **both Production and Preview** environments
if you want the branch preview to work.

1. **D1 database.** Workers & Pages → D1 → Create database (e.g. `angel-harris-db`).
   Open it → Console → paste and run each file in `migrations/` in order
   (or from a terminal: `npx wrangler d1 execute angel-harris-db --remote --file=migrations/0001_init.sql`, then `0002_messages.sql`, `0003_workspace.sql`).
   (Optional, preview only: also run `seed/sample.sql` to see sample content.)
2. **R2 bucket.** R2 → Create bucket (e.g. `angel-harris-media`). Keep it private;
   images are served through the site at `/media/...`.
3. **Bindings.** Pages project → Settings → Bindings:
   - D1 database → variable name `DB`
   - R2 bucket → variable name `MEDIA`
4. **Cloudflare Access (admin login).** Zero Trust → Access → Applications → Add
   a self-hosted application:
   - Destinations: your domain(s) with paths `admin/*` **and** `api/admin/*`
     (add the `*.pages.dev` hostname too if you want to use the admin on previews).
   - Policy: Allow, include the specific emails of Angel and the site owner.
     Login method: One-time PIN.
   - Copy the **Application Audience (AUD) tag**, and note your team domain
     (`<team>.cloudflareaccess.com`).
5. **Environment variables.** Pages project → Settings → Variables:
   - `ACCESS_TEAM_DOMAIN` = `<team>.cloudflareaccess.com`
   - `ACCESS_AUD` = the AUD tag from step 4
6. Redeploy (push a commit, or Retry deployment). Visit `/admin/`, sign in with
   a one-time PIN, and add content.

**Adding another admin later:** Zero Trust → Access → Applications → "Angel Harris admin" →
Policies → "Allow admins" → add the person's email to the Include rule. No code or redeploy needed.

The admin API also verifies the Access token itself, so it stays closed even if
the Access policy is misconfigured, and it refuses to run if steps 4-5 are missing.

## Admin tabs

- **Projects**: one workspace for all work. Each project has a status (ongoing / on hold / completed), milestones,
  deliverables (with links to the files), an update log, and an optional private **client link**. A separate
  "Portfolio page" section holds the public case study; tick "On site" to publish it.
- **Operations**: internal task board (urgent / high / normal / low), due dates, repeating tasks that
  reschedule when completed, a month calendar (tasks, milestones, project due dates), and a daily email
  digest at 13:00 UTC (empty days send nothing; "Email me the digest now" sends one on demand).
- **Messages**: contact-form inbox. **Settings**: site text and the public Services page.

### Project colours

The theme is offwhite backgrounds with navy text and mint highlights (tokens at the top of `assets/css/site.css`). Active projects in the admin carry a schedule colour, worked out on the server (`projectHealth` in `functions/_lib/data.js`) from the due date, progress and overdue milestones:

| Colour | Meaning |
| --- | --- |
| Green | On track: no date, or more than 14 days away. Completed projects are green too. |
| Yellow | Due within 14 days. |
| Orange | Slipping: a milestone is overdue, or due within 7 days with under 75% done. |
| Red | The due date has passed. |

On-hold projects stay neutral. Clients never see these colours on their link.

### Client links
A project's client link (`/client/<32-hex token>`) is read-only and shows only items marked "Client sees"
(progress, milestones, deliverables, updates). Anyone with the link can view it, so treat it like a password.
Replace the link to invalidate the old one, or turn it off. The pages are never cached or indexed and send no
referrer. At launch also add `Disallow: /client/` to `robots.txt`.

## Contact form

Visitors send a message from `/contact`. Messages are saved in the database and read in
**Admin → Messages** (unread count on the tab, reply by email, mark read, delete).

- Spam protection: a hidden honeypot field, a minimum-time check, at most 2 links per message,
  3 messages per visitor per 15 minutes and 60 per hour site-wide. Visitors are identified only by
  a salted hash of their IP address, used for rate limiting.
- Email notifications: after saving, `/api/contact` calls the `angel-harris-mailer` Worker (service
  binding `MAILER`), which emails Angel with the visitor as Reply-To. The recipient lives only in the
  Worker's `NOTIFY_TO` secret, never in the repo. If the email fails, the message is still in the inbox.

### Email setup (already done once; here for reference)
1. Email Routing enabled on the domain (adds MX/SPF/DKIM records).
2. The recipient is added as a destination address and must click Cloudflare's verification email.
3. `cd mailer && npx wrangler deploy`, then `npx wrangler secret put NOTIFY_TO`.
4. Pages project → bindings → Service binding `MAILER` → `angel-harris-mailer`.

To change who gets the emails: add the new address as an Email Routing destination, verify it, then
`cd mailer && npx wrangler secret put NOTIFY_TO`.

## Security notes

- Uploads: JPEG, PNG, WebP, AVIF only (checked by file signature), max 10 MB. SVG is rejected on purpose.
- Admin writes require a same-origin request with an `X-Requested-With` header.
- Videos are Vimeo/YouTube links only, embedded through their privacy-friendly players.
- A Content-Security-Policy is set in `_headers`: scripts only from this site, fonts from Google Fonts.
- No personal data lives in the repo. Contact email, bio and social links are entered in the admin.
- Images removed from a project (or when a project is deleted) are deleted from R2. An image uploaded but never saved into a project stays in R2 until removed manually.

## Launch checklist

- [ ] Replace the placeholder projects/services with Angel's real work (admin → Projects, Services); set the bio, email and links under Settings.
- [ ] Remove the sample content if it was loaded (`seed/sample.sql`).
- [ ] Go public to search engines: replace `robots.txt` with `Allow: /` + `Disallow: /admin/`, and delete the `X-Robots-Tag` line in `_headers`.
- [ ] Merge. The maintenance page PR (`maintenance-landing`) also adds `index.html`, `_headers` and `robots.txt`; if it is merged first, resolve the conflict by keeping this branch's versions.
