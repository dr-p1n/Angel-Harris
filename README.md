# Angel Harris: portfolio

Portfolio de Angel Harris. Vanilla HTML/CSS/JS front-end, plus a small admin
portal backed by Cloudflare Pages Functions, D1 (database) and R2 (images).
No framework, no build step, no npm dependencies.

## What's in here

| Path | What it is |
|---|---|
| `index.html`, `services.html`, `project.html` | Public pages (home grid + hero, services, case study) |
| `assets/` | Shared CSS and JS, placeholder artwork |
| `admin/` | Admin portal (projects, services, settings), served at `/admin/` |
| `functions/` | Cloudflare Pages Functions: public API, admin API, image serving, `/work/:slug` |
| `migrations/` | D1 schema (`0001_init.sql`) |
| `seed/sample.sql` | **Sample content for local review only** |
| `_headers`, `robots.txt` | Security headers and (pre-launch) crawler blocking |
| `dev/wrangler.toml` | Local-development config only; Cloudflare ignores it |

Public routes: `/`, `/work/<slug>`, `/services`. Admin: `/admin/`.

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
   Open it → Console → paste and run `migrations/0001_init.sql`.
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

The admin API also verifies the Access token itself, so it stays closed even if
the Access policy is misconfigured, and it refuses to run if steps 4-5 are missing.

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
