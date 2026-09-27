# Lerner Works Platform — working notes for Claude Code

Read `docs/LESSONS.md` first: the mistakes of this project and the rule each one leaves
behind, including the paths not to walk again. The full specification is
`docs/Lerner-Works-Platform-Build-Guide.md`. Read it before changing
architecture. Resume from `docs/PROGRESS.md`. The design flexibility programme (phases D0–D3)
is planned in `docs/DESIGN-PLAN.md`; D0, D1 and D2 (theme catalogue, design preview,
delegation) are shipped. Themes are
compositions in code registered under immutable keys in `src/themes/index.ts` with their
capabilities declared in `src/themes/capabilities.ts` (decision D-018). The site-building
programme (`docs/SITE-BUILDING-PLAN.md`, decision D-020) is the current work: its bar is
that the owner would choose the platform over hand-building a site, and every change in it
is built to last (migration, service, tests at three levels, docs, release gate). B1 is
built: review policy per site with approval on save, one-step publishing, task-based
dashboard. B2 is built: a section with nothing to show is left out of the public page
(D-021, `src/themes/shared/empty.ts`), starter pages whose slots fill themselves, the
onboarding package (`src/server/import/onboarding.ts`), multi-file upload with an
alternative-text pass, quick add and duplicate, imports approved on save under the policy.
B3 is built (D-022): a richer section vocabulary (people, logo strip, image-and-text rows,
photo band, hero collage/offset/statement, gallery lightbox, portraits on quotations,
click-to-load map, rich text divider/callout/button; shared renderers in
`src/themes/shared/rich-sections.tsx`, no client script except the map) and a third
composition per preset (`almanac`, `practice`); snapshot schema version 5. B4 is the proof
(D-023): two realistic client sites with public-domain photography written as onboarding
packages in `src/server/demo/proof/` (`pnpm proof:package`), built end to end through the
dashboard by `tests/e2e/proof.spec.ts` with the counts, times and captures in
`docs/evidence/proof/`; the owner's own timing on production is the number the bar is
judged by. B5 is built (D-024): documents in Media (PDF only, `media_assets.kind`,
`document:<id>` link targets, attachments on every item, the `downloads` page section,
`src/server/media/content-types.ts`, `src/themes/shared/documents.tsx`), links to other
websites as a content kind (`src/modules/link.ts`, `src/themes/shared/links.tsx`; the `/links`
index and its navigation entry exist only once a link is published), and the onboarding
workbook (`src/server/import/xlsx.ts` reads and writes an OOXML subset in code;
`src/server/import/workbook.ts` turns a workbook into the package's CSV files before the dry
run; the template and the proof packages carry `content.xlsx`); snapshot schema version 6.
B6 is built (D-025): owners delete a site (Settings → Remove this site, the key typed) or an
organization (Organizations → Remove organization…, the name typed) through
`public.delete_site` and `public.delete_organization` (`src/server/data/removal.ts`); the rows
go in one transaction with the audit event, the files after, a site live on a domain is
refused, organizations are kept as tombstones with their trail. On 2026-09-27 the owner judged
the structured platform against the bar and found it not met ("not something I would use, way
too complicated, not enough easy customization like being able to upload zip"; SB-09 in
`docs/ACCEPTANCE.md`); the direction decided with them is B7, uploaded sites (a site built
anywhere, uploaded as a ZIP, hosted as an immutable release on the client's domain with the
inquiry inbox and previews on a hostname of their own), the structured sites kept as they are.
B7 is built (D-026): `sites.site_type`; the ZIP read by `src/server/uploaded/archive.ts`
(what a static host serves, limits, an index page), published by
`src/server/uploaded/publish.ts` (files under content hashes in the public store, then
`public.publish_uploaded_release`, schema series 101), served by `src/server/uploaded/serve.ts`
through `/uploaded/<preview|host>/<target>/files/…` which only the proxy reaches (preview
hostnames `<key>.<PREVIEW_DOMAIN>`; live hosts routed by `/api/public/site-type`); the site's
own form posts to `/_lw/inquiry`, which the proxy maps to `…/<target>/inquiry` (a route folder
starting with `_` is private to Next.js and never routed, so the segment itself cannot be
`_lw`); the dashboard of an uploaded site is Upload, Inbox, Settings, Team
and the activity log (`src/server/data/site-nav.ts`, the layout guard); the owner's guide is
`docs/UPLOADED-SITES.md`. B8 is built (D-027): a ZIP goes up in parts under the hosting
platform's 4.5 MB request limit (`src/server/uploaded/sessions.ts`, the `upload/begin`, `part`
and `complete` routes, `upload-zip-form.tsx`; abandoned sessions and stale checks purged by the
retention job); the check leaves out what a website does not serve instead of refusing and
finds the site in its build folder (`archive.ts`); Publish from GitHub
(`src/server/uploaded/github.ts`, `sources.ts`: `site_sources`, the archive fetched server-side
at the branch head, the commit on the release) with an organization's token for private
repositories sealed by `src/server/secrets/crypto.ts` and reachable only through SQL functions
(`organization_secrets`). Neither path builds a site; for a generator site the repository's
CI builds and pushes (B9, D-029): a deploy token per site (`site_deploy_tokens`,
`src/server/uploaded/deploy.ts`) authorises `/api/deploy/begin`, `part` and `complete`
(`deploy-route.ts`, the B8 parts protocol, publishing through `publish-job.ts`), with
`public/deploy.sh` as the CI step, and the site's own `_redirects` and `_headers` are read
into the release (`site-config.ts`) and applied by the file handler. Client privileges (D-028): a Supabase
project grants the client roles everything on new tables and functions in `public` by
default and the local database does not, so every migration that creates a table or a
function states its grants after `revoke … from public, anon, authenticated`
(`tests/unit/migration-grants.test.ts` enforces it), and after applying such a migration to
the hosted project the read-only verification in `docs/OPERATIONS.md` is run there.
Public themes use only the derived brand tokens, design variables and font variables described
in `docs/DESIGN-TOKENS.md` (a unit test rejects literal colours in `src/themes`). A theme or
renderer change must keep every frozen release in `tests/fixtures/releases/` rendering as
recorded (`tests/unit/rendering-hash.test.ts`; re-record only after the screenshot comparison
in `docs/OPERATIONS.md`, decision D-015).

## Non-negotiable boundaries

- This repository is a new project. Never edit, deploy, or migrate Inside the Towns, AragoCor,
  or the existing Lerner Works website. Never move DNS. Never send real email.
- Real persistence only: PostgreSQL through the migrations in `supabase/migrations/`. No
  localStorage business records, no simulated saves, fake metrics or pretend deploy status.
- The public renderer reads immutable release snapshots only (`releases.snapshot` via the
  anon-callable read functions). It must never read draft tables.
- Authorization lives in server code plus row-level security. Every mutation validates the
  session, membership, site scope, input schema and capability. Client-supplied organization or
  site ids are never authority.
- Seeds, resets and the local auth provider run only against a local `_dev/_test/_e2e`
  database with `APP_ENV=local`.
- Do not invent credentials, provider success, prices or test results. Record blocked items in
  `docs/PROGRESS.md` and `docs/ACCEPTANCE.md` as BLOCKED, not PASS.
- Commits/pushes go only to the branch the session was configured for; no pull requests,
  remote repositories or public deployments without explicit approval.
- Not a page builder (`docs/DECISIONS.md` D-017): never add a canvas, free positioning,
  per-element styling, custom CSS or HTML, a template gallery, generated pages or copy, or
  design controls for anyone but the agency (per-site delegation to a publisher stays off by
  default). Themes are compositions in code; sections are typed contracts; design settings are
  enumerated values.

## Commands

`pnpm setup:check`, `pnpm db:start`, `pnpm db:migrate`, `pnpm seed:demo`, `pnpm dev`,
`pnpm worker:dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
`pnpm test:e2e`, `pnpm build`, `pnpm start`, `pnpm verify`, `pnpm launch:check`,
`pnpm bootstrap:owner`. See `docs/OPERATIONS.md` and `docs/LAUNCH-CHECKLIST.md`.
Browser tests build and serve a production bundle in `.next-e2e` (`docs/DECISIONS.md` D-009);
`E2E_USE_BUILD=0` uses `next dev` for iteration only.

## Layout

See build guide section 7. Dashboard routes under `src/app/app`, public demo routes under
`src/app/demo`, previews under `src/app/app/sites/[siteId]/previews`, themes in `src/themes`,
content contracts in `src/modules`, server services in `src/server`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
