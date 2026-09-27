# Operations

## First-time local setup (verified on Linux with PostgreSQL 16, Node 22, pnpm 10)

```bash
corepack enable                 # provides the pinned pnpm@10.33.0
pnpm install                    # uses the committed lockfile
pnpm db:start                   # starts local PostgreSQL (or `supabase start` if available), creates roles/databases, writes .env
pnpm db:migrate                 # applies supabase/migrations (plus the local auth shim on plain PostgreSQL)
pnpm seed:demo                  # loads the fictional demonstration fixtures; writes docs/local-accounts.md (git-ignored)
pnpm setup:check                # readiness report (never prints secrets)
pnpm dev                        # http://localhost:3000 — prints entry URLs
pnpm worker:dev                 # second terminal: processes notification jobs with the local sink
```

Local demonstration routes: `/demo/pine-hollow` and `/demo/range-athletics`. Dashboard: `/app`.

### Requirements

- Node.js >= 22, pnpm 10.33.0 (via corepack), PostgreSQL 16 server reachable on 127.0.0.1:5432
  **or** Docker + Supabase CLI for `supabase start`.
- `pnpm db:start` must be able to run `psql` as a PostgreSQL superuser once (it tries
  `su postgres`, `sudo -u postgres`, then `psql -U postgres`). It creates the roles `anon`,
  `authenticated`, `service_role`, `lw_admin` (migrations, bypasses RLS) and `lw_app`
  (request role) and the databases `lernerworks_dev` and `lernerworks_test`.
- Passwords and the session secret are generated once into `.env` (mode 600, git-ignored).

## Environment boundaries

| Variable | Meaning |
|---|---|
| `APP_ENV` | `local`, `staging` or `production`. Seeds, resets and the local auth provider require `local`. |
| `DATABASE_URL` | Request connection as `lw_app`. Every query runs under RLS with the user's identity. |
| `DATABASE_ADMIN_URL` | Elevated connection. Migrations, seeds, worker, retention jobs only. |
| `DATABASE_TEST_URL` / `DATABASE_TEST_ADMIN_URL` | Isolated test database. Integration and e2e tests **reset** this database. Its name must end in `_test`. |
| `AUTH_PROVIDER` | `local` (development only) or `supabase` (hosted). |
| `STORAGE_PROVIDER` | `local` (files under `.data/storage`) or `supabase`. |
| `NOTIFY_PROVIDER` | `local-sink` (writes to `.data/mail`, proves job processing only) or `resend`. |

## Reset boundaries

- `pnpm db:reset --yes` drops and recreates the local development database, then migrates.
  It refuses non-local hosts, database names without a `_dev/_test/_e2e` suffix, and any
  `APP_ENV` other than `local`. Seeds never run implicitly; application startup never resets.
- `pnpm test:integration` and `pnpm test:e2e` reset only the `_test` database.

## Test suites

- `pnpm test` — unit tests (pure functions: hours, events, structured text, canonical JSON,
  contrast, slugs, host normalization).
- `pnpm test:integration` — Vitest against the isolated `_test` database: the global setup
  resets and seeds it, then policies, SQL functions and services are exercised as real users.
- `pnpm test:e2e` — Playwright. The global setup resets and seeds the `_test` database and
  clears `.data/test-storage` and `.data/test-mail`; `scripts/e2e-server.ts` then builds the
  application into `.next-e2e` and serves it with `next start` on port 3100 (see
  `docs/DECISIONS.md` D-009). `E2E_USE_BUILD=0 pnpm test:e2e` uses `next dev` instead for
  faster iteration; it is not release evidence. Screenshots written by the demonstration
  spec land in `docs/evidence/demo/`, those of the site-building specs in
  `docs/evidence/dashboard/`; `walkthrough.spec.ts` writes the SB-06 measurement (screens,
  fields and actions per task of the create-brand-populate-publish walk-through, and the
  empty-state notices left on the published home) to `docs/evidence/walkthrough/latest.json`
  with a screenshot of the published home beside it.
- `pnpm verify` — the release gate, in order: setup check, lint, typecheck, unit,
  integration, e2e, production build.
- `pnpm exec tsx scripts/screenshots.ts --base <url> [--out <dir>] [--only <names>]` —
  responsive screenshot pass over the two pilots (15 public pages × 390/768/1440) into
  `docs/evidence/screenshots/`; fails on a non-200 response, horizontal overflow or a console
  error. Run it against a server that serves a database seeded with `pnpm seed:demo` (each
  design phase re-runs it). The pass is repeated per composition of the theme catalogue
  (D2): switch a pilot's theme (Look → Design → Theme, then publish; or
  `pnpm exec tsx scripts/set-demo-theme.ts --site <key> --theme <theme key | default>`, which
  makes the same configuration revision and publishes it as the owner, local databases
  only), run the pass with `--only` the pilot's pages and
  `--out docs/evidence/screenshots/<theme>` (`magazine` and `almanac` for the guide pages,
  `storefront` and `practice` for the retail pages), then switch the pilot back and publish
  again; the default compositions stay in `docs/evidence/screenshots/`.
- `pnpm exec tsx scripts/screenshot-diff.ts --before <dir> --after <dir> [--out <dir>]` —
  pixel comparison of two screenshot directories (share of differing pixels per page, size
  changes, optional highlighted difference images). Used with the rendering-hash procedure below.

### Rendering hashes of frozen releases (design programme, D-015)

`tests/unit/rendering-hash.test.ts` renders every route of the release fixtures in
`tests/fixtures/releases/` and compares the HTML hashes with `hashes.json`. It fails on any
theme or renderer change, which is its job. To accept an intended change:

1. Render the old releases with the new code: on a database seeded with `pnpm seed:demo`,
   restore the release the previous evidence was taken from (Publish → Release history → Restore, or
   `restoreRelease` from a script), start `next start`, and run `scripts/screenshots.ts` into a
   temporary directory.
2. Compare with the previous evidence: `scripts/screenshot-diff.ts --before
   docs/evidence/screenshots --after <tmp>`; review every page above the threshold (the
   difference images show where).
3. Restore the current release again (or re-run the seed), then re-record the hashes:
   `UPDATE_RENDERING_HASHES=1 pnpm exec vitest run --project unit tests/unit/rendering-hash.test.ts`.
4. Note the reason and the comparison result in `docs/PROGRESS.md`.

New fixtures (after the pilots are re-composed) come from
`pnpm exec tsx scripts/export-release-fixtures.ts`, which also writes a version-1 copy of each
release so the normalisation path stays covered. The version-4 fixtures were exported with the
pilots switched to the magazine and storefront compositions, and the version-5 fixtures (B3)
with the pilots re-composed with the B3 sections and switched to the almanac and practice
compositions, so the hash test freezes every composition of the catalogue; the version-3
fixtures keep the earlier content under the original compositions. `tests/unit/themes.test.ts`
additionally renders every route of the version-3 fixtures under every compatible theme,
without hashes, so a new composition is exercised on the pilots' content before it has
fixtures of its own.

## Local auth provider

`AUTH_PROVIDER=local` stores bcrypt password hashes and opaque session tokens in the
`local_auth` schema created by `supabase/local/0000_auth_shim.sql`. The application refuses
this provider unless `APP_ENV=local` and the database host is local. It exists so the full
workflow can be verified without a container runtime; hosted deployments must use Supabase
Auth (`AUTH_PROVIDER=supabase`), which is not verified in this environment.

## Hosted deployment (not performed here; requires owner accounts and approval)

The full runbook is `docs/LAUNCH-CHECKLIST.md`. In short: separate staging and production
Supabase and Vercel projects; `supabase/hosted/0001_application_roles.sql` once per project,
then `supabase db push` for `supabase/migrations/` (never `supabase/local/`); Supabase Auth
with sign-ups disabled, `APP_URL/auth/recovery` allowed as a redirect and Resend as the auth
email sender (`pnpm hosted:auth --project-ref <ref>` sets these through the Management API
and reads them back); buckets `private` and `public-assets`; Resend with a verified sending
domain; the Vercel project with the variables in `.env.example`, `CRON_SECRET` for the job
endpoints and the Vercel API token for domain verification. `pnpm launch:check --env-file
<file>` reports readiness without printing secrets; `pnpm bootstrap:owner` creates the first
owner; the staging smoke tests in the checklist are the evidence that the hosted providers
work. Outside `APP_ENV=local` the application refuses to start unless the hosted providers,
https and the job secret are set.

### Hosted authentication

With `AUTH_PROVIDER=supabase`, Supabase Auth owns accounts and passwords. Sign-in verifies
the password against GoTrue; the platform then issues its own opaque session (random token
in an httpOnly cookie, SHA-256 hash in `public.app_sessions`, `SESSION_DAYS` lifetime). The
table is unreachable by anon/authenticated and only the application's connecting role can
call the session functions, so PostgREST never exposes sessions. Invitations create the
account through the administrative API when the invitee chooses a password on the invitation
page; "Forgot your password?" uses the provider's recovery email (PKCE) and lands on
`/auth/recovery`. Signing out deletes the session row.

### Scheduled jobs

`/api/jobs/deliver` (one bounded delivery batch) and `/api/jobs/retention` (rate-limit
counters older than a day, inquiries older than 90 days) require `Authorization: Bearer
<JOB_TRIGGER_SECRET>`; Vercel Cron sends `CRON_SECRET` the same way on the schedule in
`vercel.json` (every 5 minutes / daily). Plan limits decide the effective cadence: on plans
that run crons only daily, call the delivery endpoint from another scheduler. Without a
secret the endpoints answer 503 so a missing scheduler is visible, and `pnpm launch:check`
reports it. Vercel Cron calls the endpoints on the deployment's generated `*.vercel.app`
hostname, so they are exempt from host routing and the project's Deployment Protection must
not cover production deployment URLs; a pending `delivery_jobs` row that is never attempted
means the scheduler is not reaching the endpoint (check the Cron Jobs page of the Vercel
project and its runtime logs), not that the worker failed.

### Domains and going live

Settings → Domains: an owner registers a hostname (status `pending`), registers it with the
hosting provider (`verifying`; the provider's verification and DNS records are shown exactly
as returned), checks verification until the provider reports ownership verified and DNS
configured, then activates it (`active`). One domain per site is canonical; aliases redirect
to it. Settings → Publishing mode: "Go live" is allowed only with an active release and an
active, verified canonical domain; it changes where the current release is served, nothing
else. "Return to demonstration mode" stops serving the domains immediately. Every step is
audited. Without `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` (local development) domains stay
pending and nothing is marked verified.

## Notification worker and delivery queue

`pnpm worker:dev` claims due `delivery_jobs` with a two-minute lease (`FOR UPDATE SKIP LOCKED`,
so two workers never send the same job), sends through the configured provider, and records
the outcome. Transient failures retry after 1, 5 and 30 minutes (four attempts in total); then
the job is `failed` and a publisher can re-queue it from the inquiry's detail page. `--once`
processes a single batch and exits.

- `NOTIFY_PROVIDER=local-sink` writes each message to `NOTIFY_LOCAL_DIR` (`.data/mail`). That
  proves job processing, not internet email delivery.
- `NOTIFY_PROVIDER=resend` needs `NOTIFY_RESEND_API_KEY`; provider acceptance is recorded as
  `provider_accepted`, which is not confirmed delivery (no delivery webhook is configured).
  Without provider idempotency a network timeout can produce a duplicate notification email;
  inquiry storage itself is deduplicated by the form token.
- Hosted mode: run `scripts/worker.ts --once` from an authenticated scheduled endpoint or a
  job service; verify the platform's scheduler limits before choosing a cadence. A missing
  worker shows up as jobs stuck in `pending` on the inquiry detail page.

## Retention

`pnpm retention` purges rate-limit counters older than one day and inquiries older than 90
days (`--days=N` to change). It refuses non-local targets without `--confirm-hosted`. The
90-day default is a product default that the owner must review before real collection; it is
not a legal compliance claim.

## Invitations

Owners invite people from Site → Access. The invitation binds the email address and the
organization, expires after seven days and can be used once; no password is generated or
sent. Locally the message goes to the notification sink and the link is also shown to the
owner (local mode only). With Supabase Auth the invitee signs in through the hosted provider
and then accepts at `/invite/<token>`; that path is unverified in this environment.

## Imports and exports

- CSV import (stores, places, events): upload → automatic column mapping (editable) → dry run
  with per-row findings and create/update/skip/error counts → confirm. 500 rows / 5 MB caps.
  Records are matched by `external_id` per site and type; repeated identical imports do not
  duplicate anything. Imported items are drafts.
- Site package: owners download a ZIP with content, configuration, redirects, and image
  derivatives with rights metadata (never passwords, members, inquiries, recipients or
  domains). Importing validates paths, sizes, checksums and schemas, then creates drafts with
  new ids; same-slug starter pages are replaced.

## Review policy and publishing (site-building programme B1)

- Each site has a review policy (Settings → Publishing, owners only; `sites.review_required`,
  off by default). Off: a revision saved by an owner or publisher is approved on save, as an
  immutable review row on that exact revision, audited as `review.approved_on_save`; editors'
  work still needs a publisher's approval. On: every revision needs an explicit approval,
  including the owner's own (audited as `review.self_approved`). Changing the policy is audited
  as `site.review_policy_changed`.
- Publish (sidebar → Publish) shows what the next release would contain, computed from the
  saved and approved work without writing anything, with blockers linked to their fixes.
  "Publish now" builds the candidate from exactly that computation and activates it in one
  action; warnings are recorded with the release. To look at the frozen result first or to
  waive a warning with a reason, build a candidate and activate it from its own page. Restore
  works as before from the release history.

## From empty to launch (site-building programme B2)

- A section with nothing to show is left out of the public page (D-021): an empty text slot,
  a collection without published items, a category list without categories, a video without
  an id, a map link without an address. Publication warns which sections are left out
  (`section_left_out`) and when a page has nothing to show (`page_empty`); the editor says
  under each section what fills it; the overview's setup checklist names the introduction and
  the About page while they are unwritten. Nothing is generated: a slot stays empty until
  written.
- Onboarding package (Import & export → "Download the template"): a ZIP with the workbook
  `content.xlsx` (since B5: one sheet per content kind of the preset, Places, Events,
  Articles and Links, or Services, Stores and Links, each with the CSV template's columns
  including `body`, `image`, `image_alt` and `attachments`; a Site sheet of key/value rows:
  wordmark, tagline, description, contact details, the four brand colours, typography, logo,
  share image, hero image, home subheading, home introduction, About text, with a `notes`
  column that is ignored; an Images sheet: file, alt_text, title, license, attribution,
  source_url, decorative; a Documents sheet: file, title, license, attribution, source_url; a
  Read me), an `images/` folder (JPEG, PNG or WebP, up to 10 MB each, 100 files) and a
  `documents/` folder (PDF, up to 25 MB each, 50 files). The same sheets as CSV files
  (`places.csv`, `site.csv`, `images.csv`, `documents.csv` and so on) are still read; a sheet
  given both ways is refused. Upload the package, or the workbook on its own, on the same
  page: the dry run validates every sheet, image, document and setting and writes nothing;
  confirming ingests the images and documents, imports the rows in order (services before
  stores, places before events) and applies the settings sheet (a configuration revision, the
  contact details on the site, and the starter pages' text and hero image as new revisions) in
  one transaction, audited as `import.onboarding_applied`. The settings sheet needs an
  organization owner; others import the content, images and documents. Importing the same
  package again updates the rows and uploads the files again. Format details are in the
  template's README and `src/server/import/onboarding.ts`.
- CSV imports cover stores, services, places, events and articles. A plain CSV import cannot
  name an image (the `image` column must be empty); the onboarding package can.
- Imports follow the site's review policy: an import by someone who may publish on a site
  that does not require review is approved on save (each written revision, audited
  `review.approved_on_save`); otherwise the items are drafts awaiting review. The import
  page and the job page say which.
- Media: many files in one upload with one license, attribution and source for the batch,
  two files at a time, then the alternative-text pass lists every uploaded image with a field
  for its text or a decorative mark and saves them in one action; the library shows how many
  images still need alternative text or a license, with a filter for each.
- Quick add on a content list: a title (and, for a place, a category with the site's existing
  categories suggested) creates the draft with the site's defaults and opens the editor. The
  editor's "Duplicate this …" copies the saved version into a new draft with a free slug.
  Articles are attributed to the site until a person is named; events and stores take the
  site's time zone.

## The proof sites (site-building programme B4)

- Two realistic client sites with real photography live in `src/server/demo/proof/` as the
  onboarding package a client fills in: Cedar Bend Guide (community guide) and Bookcliff Farm
  Markets (location business). `pnpm proof:package --site cedar-bend` (or `bookcliff`) writes
  the ZIP; `pnpm proof:package --list` lists the sites. The package imports on any site
  created from the same preset, locally or on production (Import & export → dry run →
  confirm), and is the material of the timed dashboard build recorded in
  `docs/evidence/proof/` by `tests/e2e/proof.spec.ts` on every run of the browser suite.
- The photographs are committed under `src/server/demo/proof/photos/<site>/` (web-sized JPEGs,
  22 MB in all) with their archive ids, catalogue records and rights in the fixtures and in
  `docs/evidence/ASSETS.md`; `pnpm proof:photos` fetches any that are missing from the Library
  of Congress image service and reduces them the same way. `tests/integration/proof.test.ts`
  imports both packages on fresh sites, publishes them and renders every composition.
- Upload limits: the proxy buffers request bodies on the dashboard routes, and its limit is
  set to 64 MB (`proxyClientMaxBodySize` in `next.config.ts`) so that an onboarding or site
  package of that size, and a two-file media upload, arrive whole; the routes check the sizes
  themselves (64 MB for packages, 10 MB per image, 5 MB for a CSV).

## Documents, links and the workbook (site-building programme B5)

- Documents: Media accepts PDF files beside the pictures (Media → Upload, or the multi-file
  upload; 25 MB each; the file must begin with `%PDF-` and end with the PDF trailer, and its
  declared type and extension must agree; nothing else is accepted, and there is no
  alternative-text pass for documents). A document has a title, a license, an attribution and
  a source like a picture, and its Media page shows the reference to paste: `[label](document:ID)`
  in body text, or `document:ID` as the target of a button, a hero call to action, a feature
  item or any other link slot. Every content kind has a Downloads list (a document and a
  label each, up to 20) rendered under the item's body, and a page can carry a Downloads
  section (list or grid, up to 24). Publication copies each referenced document to
  `/assets/<sha256>.pdf` (served inline with `X-Content-Type-Options: nosniff`, an
  immutable cache and a file name from the title) and refuses a release that names a picture
  where a document is needed, a document where a picture is needed, a download with no file,
  or a withdrawn document, exactly as for pictures. Restoring an older release re-checks its
  documents. The site package exports documents as `media/<id>/document.pdf` and imports them
  with every `document:` reference remapped; the onboarding package carries them in the
  `documents/` folder with a `documents.csv` or a Documents sheet, and a row names its
  downloads in the `attachments` column (file names separated by `;`).
- Links to other websites: a content kind of both presets (sidebar → Links; quick add asks
  for the title and the https address). A link has a category, a summary, a picture, body
  text, a button label and the verification fields; it is shown as a card that opens the
  other site (`rel="noreferrer"`, marked as opening another website) by a content collection
  of kind Links on any page, and by the `/links` index with category filters. The index and
  its navigation entry exist only while at least one link is published (D-021); the index copy
  is editable in Settings like the other indexes. Each link also has a page of its own
  (`/links/<slug>`: summary, picture, the button, body, downloads, address and verification
  date) so that search and sharing have somewhere to land; search lists the link's category
  and host. The Links module can be switched off per site in Settings → Modules.
- The workbook: `src/server/import/xlsx.ts` reads a workbook without a spreadsheet dependency
  (shared and inline strings, rich runs, dates by cell style, numbers, booleans, formulas by
  their cached result; at most 20 MB, 128 MB unpacked, 5,000 rows and 200 columns per sheet)
  and writes the template. `src/server/import/workbook.ts` matches sheets by name, loosely
  ("Places", "places", "Directory"; "Stores" or "Locations"; "Site" or "Settings"; "Images",
  "Pictures" or "Photos"; "Documents", "Files" or "PDFs"), warns about a sheet it does not
  read, refuses a kind the preset does not have and a sheet given twice, and turns each sheet
  into the CSV file the import reads, so the dry run, the job page and the import are the
  same as for CSV files; the job page lists the sheets with what each was read as. Dates typed
  as Excel dates come out as `YYYY-MM-DD` (and `YYYY-MM-DD HH:MM` for times); postal codes
  and phone numbers keep leading zeros only when typed as text (the Read me says so). A
  workbook uploaded on its own is wrapped as a package by the upload route (the images and
  documents folders then being empty). `pnpm proof:package` writes the proof packages with
  `content.xlsx`.

## Removing a site or an organization (site-building programme B6)

- A site: Settings → "Remove this site" (organization owners only). The card says what goes
  (content items, releases, media files, inquiries, site memberships, domains, and every
  published copy of its pictures and documents that no other site uses) and what stays (the
  audit trail, in the organization's activity log and on the organizations page under
  "Removed"). The owner types the site key; the button stays disabled until it matches. A site
  that is live on a domain is refused until it is returned to demonstration mode and its
  domains are disabled. There is no undo: export the site package first if anything might be
  wanted again. The public address answers 404 at once.
- An organization: Organizations → "Remove organization…" on its card (owners only) opens a
  page listing its sites, which go with it, then the memberships and open invitations. The
  owner types the organization name. Refused while a site of it is live on a domain, and when
  it is the last organization the person owns (create the next one first, from Create site →
  Create a new organization…). The organization row stays as a tombstone that nobody is a
  member of, so its activity log remains in the database for the operator.
- Storage: the files are removed right after the rows; anything that could not be removed is
  written to the activity log as `site.storage_cleanup_failed` with the object keys, for the
  operator to remove by hand (the `SUPABASE_STORAGE_*` buckets, or `.data/storage` locally),
  and the organizations page notice says so.
- The SQL functions are `public.delete_site(site, confirm_key)`,
  `public.delete_organization(org, confirm_name, check_only)` and
  `public.record_removal_leftovers` (migration `20260927000300_removal.sql`); the service is
  `src/server/data/removal.ts`.

## Uploaded sites (site-building programme B7)

- Create site → "Uploaded". The site has no pages of its own here: its pages arrive in a ZIP.
  Upload (sidebar) takes the ZIP, checks it (what it holds, what is refused, what is missing;
  nothing changes until it is published) and shows the check on a job page; "Publish as
  release vN" copies the files to the public store under their content hashes and activates
  the release in one step. Releases are listed on the Upload page with restore, like any
  release. "Download the sample site" gives a first ZIP to try the flow with. The owner's
  guide is `docs/UPLOADED-SITES.md`.
- What a ZIP may hold: HTML, CSS, JavaScript, JSON, XML, text, images (PNG, JPEG, GIF, WebP,
  AVIF, SVG, ICO), fonts, PDF, video and audio (`src/server/uploaded/archive.ts`);
  `index.html` at the top, or inside one folder whose name is dropped; `404.html` for missing
  addresses; up to 64 MB, 2,000 files, 25 MB a file. Server-side files (PHP and the like) and
  unknown types are refused, hidden files are skipped, a form that does not post to the
  platform is pointed out.
- Addresses: `/about` serves `about.html` or `about/index.html`, `/` serves `index.html`. Each
  file carries its type, its content hash as the ETag and `nosniff`; on the live domain
  `Cache-Control: public, max-age=0, s-maxage=60, must-revalidate` (a new upload is visible
  within a minute); previews are `no-store` and `noindex`, and their `robots.txt` disallows
  everything.
- Previews: `http(s)://<site key>.<PREVIEW_DOMAIN>/`, a hostname of its own, never the
  dashboard's origin (an uploaded script must not reach the session there). Locally
  `PREVIEW_DOMAIN` defaults to `preview.localhost` (browsers resolve `*.localhost` to this
  machine; Node does not, so the browser tests open previews in the browser). Hosted, set
  `PREVIEW_DOMAIN` (for example `preview.lernerworksplatform.dev`) and add the wildcard
  hostname `*.<PREVIEW_DOMAIN>` to the Vercel project (the zone is Vercel-managed). Without it
  there is no preview; the live domain still serves. `/demo/<key>` of an uploaded site
  redirects to its preview.
- Live: Settings → Domains as for any site, then Settings → Publishing → live. The proxy asks
  `/api/public/site-type?host=` which kind of site a hostname serves and routes an uploaded
  site's requests to the file handler (`/uploaded/host/<hostname>/files/…`, marked with a
  header no client can set) and its form to `/uploaded/host/<hostname>/inquiry`; the answer is
  cached per instance for a minute.
- The contact form: the snippet on the site's overview posts to `/_lw/inquiry` on the site's
  own address (form-encoded); the inquiry is stored with the same limits, rate limits and
  honeypot as the platform's forms, delivered to the recipients, and the visitor is redirected
  to the page named in `next` with `?sent=<receipt>`; an invalid post answers a plain page
  naming the fields to correct.
- Removal (B6) takes an uploaded site's public files with it unless another site's release
  carries the same bytes.

## Backups and restore rehearsal

Site export is portability, not disaster recovery.

- `pnpm backup:local` writes `.data/backups/<timestamp>/database.dump` (`pg_dump` custom
  format) and `storage.tar` (the local storage tree).
- `pnpm restore:rehearsal .data/backups/<timestamp>` restores the dump into a new local
  database `lernerworks_restore_test`, unpacks the storage copy, and verifies that every ready
  asset's derivatives exist. The result is recorded in `docs/PROGRESS.md` (OPS-02).
- Hosted: use the provider's database backups and bucket versioning; what remains provider
  dependent is listed in the release report.

## Content rollback vs application rollback

- Content rollback: Publish → Release history → Restore. Creates a new release from the
  historical snapshot; drafts and inquiries are untouched.
- Application rollback: redeploy the previous application build (hosting provider). Snapshot
  readers stay backward compatible with stored `schema_version` values.
