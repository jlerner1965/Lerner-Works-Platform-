# Release report — local release candidate (2026-09-26)

This report separates what has been built and verified in this environment from what a
hosted, live deployment still requires. Nothing below claims a hosted result that was not
produced here.

## 1. What this release is

A working local release of the Lerner Works Website Platform: one Next.js application that
lets the agency create, edit, review, publish, restore and export multiple customers' sites,
with two fully populated fictional pilots (Pine Hollow Guide, a community guide; Range
Athletics, a location-based retailer) rendered by two distinct themes from immutable release
snapshots. It runs on a local PostgreSQL 16 server with the Supabase-compatible migrations in
`supabase/migrations/`, the local authentication shim, local disk storage and a local
notification sink.

It is **not** a hosted staging or production deployment. No Supabase project, Vercel project,
domain, DNS record or email provider was created or configured, because none of those
accounts exist in this environment and creating them requires the owner's approval.

## 2. Verified locally (evidence)

Release gate (`pnpm verify`, run 2026-09-26 on the committed code, GATE PASSED in 205 s):
setup check, lint, typecheck, 28 unit tests, 35 integration tests against the isolated
`_test` database, 17 browser tests against a production build (152 s), production build.

| Area | Verified behavior | Evidence |
|---|---|---|
| Tenant isolation | App role has no table rights; every query runs under RLS with the signed-in user; editor A gets 404 and zero rows for organization B through the UI, API routes and the database role; private derivatives and preview assets of another site are denied without bytes | integration `isolation.test`; e2e `publishing.spec`, `routing.spec` (AUTH-01..07) |
| Publishing integrity | Draft saves never change the public site; candidate manifests are frozen and hashed; activation is a compare-and-swap with an idempotency key; stale candidates are superseded; invalid or unapproved candidates cannot activate; restore creates a new release and preserves drafts and inquiries | integration `publishing.test`, `media-releases.test`; e2e `publishing.spec`, `demo.spec` (PUB-01..08) |
| Editing | All six content kinds with explicit save, optimistic concurrency with conflict comparison, revision history, draft preview, reviews tied to exact revisions, review queue | e2e `demo.spec` steps 3–5 and 7; integration DATA-02 |
| Public rendering | Two themes, index/detail/search/filters, truthful hours (holidays, overnight, unknown, closures) and event times across DST, no draft data reachable, demo pages `noindex`, live domains with canonical metadata, sitemap and alias redirect | unit `hours.test`, `events.test`; e2e `public.spec`, `routing.spec` (TIME-01/02, UX-03, META-01, ROUTE-01..03) |
| Inquiries | Server-resolved recipients, rate limit, idempotent submission, stored before notification; durable queue with lease, retry/backoff, failure and publisher re-queue; delivered status shown separately from storage | integration `inquiries.test`, `delivery.test`; e2e `demo.spec` step 8 (LEAD-01..05) |
| Media | Signature sniffing, size and pixel limits, stripped WebP derivatives, content-hash public names, historical derivatives survive restore, withdrawn assets block a restore that needs them | integration `media.test`, `media-releases.test` (MEDIA-01/02) |
| Access management | Owner-only membership changes and invitations through SQL functions; last-owner protection; revocation takes effect on the next request; local invitation registration | integration `invitations.test`, `isolation.test`; e2e `access.spec` (AUTH-05/07) |
| Portability | CSV dry run with row-level errors and idempotent confirm; site package export/import with per-file SHA-256, tampered package refused, import into a blank third site as drafts | integration `import-export.test`; e2e `demo.spec` step 10 (PORT-01..03) |
| Operations | Audit trail, retention job with local-target guard, local backup and restore rehearsal (2 sites, 39 items, 4 releases, 26 media, 2 inquiries, 78/78 derivatives) | `docs/PROGRESS.md` (OPS-02) |
| Accessibility and responsiveness | Keyboard-operable navigation drawer with focus trap and return, focused form error summary, skip link, keyboard section reordering; no horizontal overflow at 390/768/1440 and at a 200% zoom equivalent | e2e `keyboard.spec`; `docs/evidence/screenshots/` (UX-01/02) |
| Production build | `next build` succeeds; client bundles contain no database URL, password, session secret or provider key; dashboard and demo responses are `no-store` and `noindex`; public derivatives are immutable | section 4 below (OPS-03) |
| Fresh install | Clone → `pnpm install` from the lockfile → `.env` → migrate → seed → typecheck → tests | section 4 below (OPS-01) |
| Demonstration | The ten-step script in `docs/DEMO.md` runs end to end through the interface | `tests/e2e/demo.spec.ts`; screenshots in `docs/evidence/demo/` |
| Launch readiness (repository side) | Hosted configuration enforced at startup; platform sessions for Supabase Auth unreachable by PostgREST roles; invitation account creation and password recovery; Supabase Storage adapter; authenticated job endpoints with a cron schedule; domain register → verify → activate workflow with explicit go-live; readiness report; first-owner bootstrap | unit `hosted-adapters.test`, integration `hosted.test`, e2e `routing.spec` (LAUNCH-01..05, 07); runbook `docs/LAUNCH-CHECKLIST.md` |
| Identity completeness (design D0) | Logo with wordmark fallback, typography preset, every theme colour derived from the four brand colours with a 15-pairing contrast gate and a literal-colour audit, per-site favicon (asset or generated monogram), share image, titles without the platform name, `lang` per site, editable listing copy, Search link switch, external navigation links, footer layouts, page header image, Inquiries switch enforced at intake | unit `brand-tokens.test`, `publishing.test`; integration `inquiries.test`; e2e `routing.spec` (DES-01..05); screenshots `docs/evidence/screenshots/`; `docs/DESIGN-TOKENS.md` |
| Bounded design options (design D1) | Site-wide design options (header, hero and card style, radius, density, container, derived-colour overrides) for organization owners, audited; a style and appearance (background band, alignment, width) on every section, validated against the theme's declared vocabulary on save, on import and at publication; seven new section types (FAQ, quotes, call to action, gallery, facts, click-to-load video, map link); media focal points frozen into releases and applied to every crop; bold and italic in rich text; snapshot schema version 3 with older releases normalised at read time and a rendering-hash test over six frozen releases; both pilots re-composed | unit `design-options.test`, `rendering-hash.test`, `richtext.test`; integration `design.test`; e2e `design.spec` (DES-06..09); screenshot comparison of the restored D0-era releases (`scripts/screenshot-diff.ts`); screenshots `docs/evidence/screenshots/`; `docs/DESIGN-TOKENS.md`; decisions D-015, D-016 |
| Theme catalogue and design preview (design D2) | Four compositions in code registered under immutable keys with declared capabilities (two per preset: guide and magazine for the community guide, retail and storefront for the location business); the theme chosen per site as a configuration revision, refused on save, import and publication when not written for the preset, with the pages whose sections the new theme does not render listed at save time and blocking publication; releases keep the theme they were published with (the version-1 to version-3 rendering hashes are unchanged); a design preview rendering the draft configuration over the active release at 390/768/1440 without writing anything; design delegation per site by owners only, audited and enforced by a database trigger; header button, overlay header, dark-surface logo, three more self-hosted typography presets; snapshot schema version 4 | unit `themes.test`, `rendering-hash.test` (eight frozen releases); integration `themes.test`; e2e `themes.spec` (DES-10, DES-11); screenshots per composition `docs/evidence/screenshots/{magazine,storefront}/`; `docs/DESIGN-TOKENS.md` (theme catalogue); decisions D-017, D-018 |
| Publish in one step, navigate by task (site-building B1) | Per-site review policy (off by default) under which a revision saved by someone who may publish is approved on save as an immutable review row on that exact revision, audited; editors' work still needs a publisher; owners switch the policy in Settings → Publishing (audited). The Publish page computes the next release from the saved and approved work without writing, names blockers with links, and "Publish now" builds the candidate and activates it atomically in one action; the careful path (frozen preview, waivers) and restore remain. Sidebar grouped by task (content by kind, Look, Publish, Inbox, Settings, Team, Import & export, Activity log), overview built around content, look and publish with a checklist of what is actually missing, Look page with brand, design and preview together; editor labels follow the policy | migration `20260926000400_review_policy.sql`; unit `site-nav.test`; integration `site-building.test`; e2e `site-building.spec` (SB-01..03), `walkthrough.spec` (SB-06); screenshots `docs/evidence/dashboard/`; `docs/SITE-BUILDING-PLAN.md`; decision D-020 |
| Design richness inside the boundary (site-building B3) | A richer section vocabulary, every addition a typed section or an enumerated option validated on save, on import and at publication: people, logo strip, image-and-text rows with alternating sides, a photo band (a brand colour washed over a picture at three strengths), a portrait on each quotation, the hero treatments offset, collage (up to three more pictures) and statement, a gallery lightbox drawn by `:target` CSS, a click-to-load map extending D-013 (nothing from the provider before the visitor presses "Show map"; Apple Maps stays a link; the directions rule applies), and rich text divider, callout and button blocks; rendered by every composition from shared renderers; a third composition per preset (almanac for the guide: navigation rail, numbered sections, fact sheets; practice for the location business: slim header with the phone number, soft panels, numbered services, hours table); both pilots re-composed with the new sections; snapshot schema version 5 with the eight earlier frozen releases rendering unchanged and version-5 fixtures of the pilots on the new compositions; `scripts/set-demo-theme.ts` for the per-composition evidence passes | unit `rich-sections.test`, `design-options.test`, `richtext.test`, `themes.test`, `rendering-hash.test` (ten frozen releases); integration `rich-sections.test` (SB-07), `themes.test` (the B3 compositions switched and back); e2e `themes.spec` (almanac rail, lightbox, map panel; practice header, cards, hours table), `design.spec` (the editor's new sections and treatments); screenshots per composition `docs/evidence/screenshots/{almanac,practice}/` and the refreshed `magazine/`, `storefront/` and default passes; `docs/evidence/LIGHTHOUSE.md`; decision D-022 |
| The proof (site-building B4) | Two realistic client sites with public-domain photography (Carol M. Highsmith Archive, Library of Congress, attribution recorded on every asset and in `docs/evidence/ASSETS.md`), written as the onboarding package a client fills in (`src/server/demo/proof/`, `pnpm proof:package`): Cedar Bend Guide (19 places with hours, 7 events, 6 articles, 40 photographs) and Bookcliff Farm Markets (3 markets, 5 services, 21 photographs). Each is built end to end through the dashboard by the browser suite as a person would (create, import the package, choose the composition, compose the home and About pages section by section, add an event, publish), counted per task and timed, and captured under every composition of its preset. Found by the build and fixed: the proxy's 10 MB body buffer truncated a package larger than that (64 MB now); the settings sheet's opening picture did nothing for a home that opens with words alone (it becomes a picture hero); colours failing the contrast pairings passed the dry run (refused now, naming the pairing). Decision D-023 | integration `proof.test` (both packages dry-run clean, import in one step, publish with no blocker and render under every composition), `onboarding.test` (the contrast refusal); e2e `proof.spec` (the counted, timed builds; `docs/evidence/proof/latest.json` and the captures under `docs/evidence/proof/{cedar-bend,bookcliff}/`); `docs/evidence/proof/README.md`; the owner's own timing on production is the number the bar is judged by |
| Documents, links and the workbook (site-building B5) | Documents in Media: PDFs uploaded like pictures (signature and trailer checked, 25 MB, no other type), referred to as `document:<id>` from rich text, buttons and section links and as attachments on any item, listed by a Downloads section, carried by the release as `<sha256>.pdf` and served inline with `nosniff` and a name from the title; a withdrawn document blocks a release that needs it; the site package and the onboarding package carry documents. Links as content: a kind of both presets (https only, category, picture, summary, button label) shown as cards that open the other site without a referrer from collections and from the `/links` index, which appears with its navigation entry once a link is published; a page of its own for search. The onboarding workbook: the template downloads as `content.xlsx` (a sheet per kind, Site, Images, Documents, Read me), uploaded on its own or inside the package, read by a small OOXML subset in code and converted to the package's CSV files before the dry run; the proof packages carry it. Snapshot schema version 6 with the ten earlier frozen releases unchanged. Decision D-024 | migrations `20260927000100_media_documents.sql`, `20260927000200_content_kind_link.sql`; unit `documents.test`, `links.test`, `xlsx.test`, `richtext.test`, `onboarding.test`, `proof.test`, `rendering-hash.test` (twelve frozen releases); integration `documents.test`, `links.test`, `workbook.test`; e2e `documents.spec`, `links.spec`, `workbook.spec` (SB-10..12); screenshots `docs/evidence/dashboard/b5-*.png` |
| Removing a site or an organization (site-building B6) | Owner-only deletion with a typed confirmation: a site's rows in one transaction with the audit event, its files after (private originals and derivatives, and the public copies no other site's release carries), refused while live on a domain, the trail kept and the removed sites listed on the organizations page; an organization's sites first, then memberships and invitations, the row kept as a tombstone with its trail, the last organization owned refused. Decision D-025 | migration `20260927000300_removal.sql` (on production at 02:52 UTC, 2026-09-27, ahead of the merge); unit `hosted-adapters.test`; integration `removal.test`; e2e `removal.spec` (OPS-04, OPS-05); screenshots `docs/evidence/dashboard/b6-*.png`; on production since pull request #15 (`4b0d99d`, 03:33 UTC) |
| Uploaded sites (site-building B7) | A site built anywhere is uploaded as a ZIP and hosted as an immutable release: the archive checked (what a static host serves, safe paths, an index page, limits), files stored under their content hash, the release inserted and activated by one idempotent function, served on a preview hostname of its own (`<key>.<PREVIEW_DOMAIN>`, never the dashboard's origin, never indexed) and on the live domain with clean addresses, the site's own 404 page, ETags and a minute at the CDN; the proxy asks which kind of site a hostname serves; the site's own contact form posts to `/_lw/inquiry` into the inbox; a dashboard of Upload (with releases and restore), Inbox, Settings, Team and the activity log; a sample site to try. Decision D-026 | migration `20260927000400_uploaded_sites.sql` (on production at 03:38 UTC, 2026-09-27, ahead of the merge, `docs/evidence/production/b7-2026-09-27-migration.txt`); unit `uploaded.test`, `site-nav.test`; integration `uploaded.test`; e2e `uploaded.spec` (UP-01..04); screenshots `docs/evidence/dashboard/b7-*.png`; `docs/UPLOADED-SITES.md`; the wildcard hostname `*.preview.lernerworksplatform.dev` and `PREVIEW_DOMAIN` on the Vercel project's production target (the owner, 03:47 UTC); the code waits for its pull request and merge |
| From empty to launch (site-building B2) | A section with nothing to show is left out of the public page by one rule shared by the four compositions and the publication validator, which lists what is left out and warns about an empty page; starter pages are a structure whose slots fill themselves (a new `category_list` section from the published places, latest places, upcoming events, latest articles, store finder, services) or wait for the owner's words, with the setup checklist naming them; the onboarding package (template download; one CSV per kind including articles and services with body text and featured images, a settings sheet, an images folder with alternative text and rights) imported through the dry-run-then-confirm step and applied in one transaction; multi-file upload with an alternative-text pass; quick add from the list, duplicate, category suggestions, site defaults; imports approved on save under the site's review policy | migration `20260926000500_onboarding_package.sql`; unit `starter-structure.test`, `onboarding.test`; integration `onboarding.test`, `editor-speed.test`, `media-batch.test`, `import-export.test`; e2e `onboarding.spec` (SB-04, SB-05), `walkthrough.spec` (SB-06), `public.spec` (MEDIA-01); evidence `docs/evidence/dashboard/b2-*.png`, `docs/evidence/walkthrough/`; decision D-021 |

The full matrix with per-row evidence is `docs/ACCEPTANCE.md`.

## 3. Performance (lab, local)

Lighthouse 13.5.0, mobile preset with simulated throttling (RTT 150 ms, 1.6 Mbps, 4× CPU),
three runs per page against the production build on this machine (full table and
conditions in `docs/evidence/LIGHTHOUSE.md`):

| Page | Median performance | Accessibility | CLS | Median LCP | Target LCP ≤ 2.5 s |
|---|---|---|---|---|---|
| Guide home `/demo/pine-hollow` (M4) | 96 | 100 | 0.026 | 2.69 s | missed by 0.19 s |
| Store detail `/demo/range-athletics/locations/longmont` (M4) | 99 | 100 | 0.01 | 1.97 s | met |
| Guide home, after design phase D0 (logo and share image added) | 96 | 100 | 0.026 | 2.82 s | missed by 0.32 s (runs 2.19–2.88 s) |
| Store detail, after design phase D0 | 99 | 100 | 0.011 | 1.87 s | met |
| Guide home, after design phase D1 (facts, quotations band, call-to-action band) | 96 | 100 | 0.025 | 2.73 s | missed by 0.23 s (runs 2.04–2.82 s) |
| Store detail, after design phase D1 | 97 | 100 | 0.011 | 2.30 s | met |
| Retail home, after design phase D1 (full-width hero with focal point, services as cards) | 99 | 100 | 0.006 | 2.06 s | met |
| Guide about, after design phase D1 (FAQ accordion, gallery) | 98 | 100 | 0.025 | 2.20 s | met |
| Guide home, after design phase D2 (fonts of the preset preloaded, D-019) | 93 | 100 | 0.000 | 3.07 s | missed by 0.57 s (runs 3.06–3.12 s) |
| Store detail, after design phase D2 | 98 | 100 | 0.000 | 2.29 s | met |
| Retail home, after design phase D2 | 99 | 100 | 0.000 | 2.18 s | met |
| Guide about, after design phase D2 | 98 | 100 | 0.000 | 2.40 s | met |
| Magazine home (D2 composition of the guide pilot) | 95 | 100 | 0.000 | 2.84 s | missed by 0.34 s |
| Storefront store detail (D2 composition of the retail pilot) | 97 | 100 | 0.000 | 2.52 s | missed by 0.02 s |
| Storefront home | 99 | 100 | 0.000 | 2.24 s | met |
| Magazine about | 97 | 100 | 0.000 | 2.69 s | missed by 0.19 s |
| Guide home, after site-building phase B3 (collage hero, image-and-text rows, photo band, people, logo strip) | 94 | 100 | 0.000 | 3.06 s | missed by 0.56 s (runs 2.55–3.08 s) |
| Store detail, after B3 | 97 | 100 | 0.000 | 2.50 s | met (runs 2.43–2.54 s) |
| Retail home, after B3 (rows, band, quotations with portraits, people, logo strip) | 96 | 100 | 0.000 | 2.59 s | missed by 0.09 s (runs 1.95–2.73 s) |
| Guide about, after B3 (offset hero, rich text blocks, gallery lightbox) | 94 | 100 | 0.000 | 3.02 s | missed by 0.52 s (runs 2.38–3.09 s) |
| Almanac home (B3 composition of the guide pilot) | 96 | 100 | 0.000 | 2.42 s | met (runs 2.35–3.06 s) |
| Practice store detail (B3 composition of the retail pilot) | 97 | 100 | 0.000 | 2.46 s | met |
| Practice home | 96 | 100 | 0.000 | 2.46 s | met |
| Almanac about (re-run after the prose-button contrast fix; the first run measured 94 / 96 / 3.03 s, `docs/evidence/LIGHTHOUSE.md`) | 96 | 100 | 0.000 | 2.56 s | missed by 0.06 s (runs 2.37–3.00 s) |

Performance ≥ 90 and CLS ≤ 0.1 are met on every measured page. Since D2 the cumulative
layout shift is 0.000 everywhere, because the theme root preloads the fonts of the preset in
use and each family has a metric-adjusted fallback (D-019; the magazine composition had
measured 0.13–0.14 before); on the simulated slow link the same preload moved the guide
home's LCP from 2.73 s to 3.07 s, because the font files now download alongside the hero
image. The guide home's LCP is bounded by the simulated first-visit transfer (client runtime
and fonts) rather than the hero image; reducing it means trimming client JavaScript on public
pages. SEO scores of 66 are only the crawlability audit failing on purpose: demonstration
routes are `noindex`. Field Core Web Vitals cannot be claimed from these runs. The public
JavaScript baseline recorded at D0 is 143 KiB of script transfer per page; D1 and D2 left it
at 143 KiB on every measured page of every composition, and B3 measures 144 KiB everywhere
(the click-to-load map is the one client component the phase added; the lightbox and the
photo band are CSS), within the 20 KiB allowance per phase. The B3 pages carry more content
(the guide home grew from 15 to 19 sections, with a collage of four pictures above the fold),
which shows in the medians of the guide pages on the simulated slow link; the compositions
themselves cost nothing (`docs/evidence/LIGHTHOUSE.md`).

## 4. Production build, secret inspection and fresh install

- **Production build**: `NEXT_DIST_DIR=.next-build pnpm exec next build` compiles in about
  8 s with two benign Turbopack warnings about dynamic filesystem access (the storage and
  migration helpers read paths at runtime). 47 routes.
- **Secret inspection**: all 37 files under `.next-build/static` (1.4 MB) were scanned for
  the five secret values in `.env` (database passwords, session secret) and for the literals
  `postgres://`, `lw_admin`, `DATABASE_ADMIN_URL`, `SESSION_SECRET`: no hits.
- **Production headers** (`next start`): `/app` without a session → 307 to `/sign-in` with
  `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`; `/demo/*` →
  `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `<meta name="robots"
  content="noindex, nofollow">`; `/assets/<hash>-w480.webp` → `public, max-age=31536000,
  immutable`; unknown `Host` → 404; `X-Content-Type-Options`, `Referrer-Policy` and
  `X-Frame-Options` on every response.
- **Fresh install** (OPS-01, 2026-09-26): commit `ba96873` cloned into an empty directory;
  `pnpm install --frozen-lockfile` (397 packages from the lockfile, reused from the local
  store), `.env` with the local database values, `pnpm setup:check` (all OK: Node 22.22.2,
  pnpm 10.33.0, PostgreSQL 16.13, 7 migrations, 2 sites), `pnpm db:migrate` (nothing
  pending), `pnpm seed:demo` (idempotent: 5 accounts, 39 items unchanged, 0 new images or
  releases; `docs/local-accounts.md` written and git-ignored), `pnpm typecheck`, `pnpm lint`,
  28 unit and 35 integration tests: every step exit 0. On a machine without the database,
  `pnpm db:start` creates it first, as the README says.

## 5. Hosted staging (verified 2026-09-26) and what remains

With the owner's credentials the staging environment was set up from this repository and
verified (`docs/PROGRESS.md` → "Hosted setup log", `docs/ACCEPTANCE.md` LAUNCH-06):

- Supabase project `pgnffhnlgxqpsvgloshz` (us-east-1): migrations and the application role
  applied through the Management API, sign-ups disabled, buckets created; database checks
  all OK in `pnpm launch:check --project-ref`.
- Vercel project `lerner-works-platform-staging` at `https://staging.lernerworksplatform.dev`
  (Pro team "ARProject"), production branch `main`, crons registered, HSTS and the other
  headers present.
- Resend: domain `lernerworksplatform.dev` verified; sender `notifications@lernerworksplatform.dev`.
- Smoke tests 1–6 passed against staging: hosted storage upload and publishing, inquiry
  delivery through the scheduled job and Resend, invitation email and account creation
  through the identity provider, job authentication, recovery request, and the full domain
  workflow with a real hostname served live and returned to demonstration mode.

Release label: **production deployed** on 2026-09-26 (commit `7f4caf7`,
`https://app.lernerworksplatform.dev`, Supabase project `lerner-works-platform-production`
on the free tier in the slot of the paused staging project; readiness report
`docs/evidence/production/launch-check-2026-09-26.txt`; first owner created), with these
open items before "live pilot ready":

- Acceptance of the invitation the owner sent from production (its email was delivered).
  Done on 2026-09-26: the owner's first sign-in through "Forgot your password?" (the first
  Resend SMTP delivery), a test site published and served on its demo route, and inquiries
  from the public form stored, then delivered by the scheduler on its own once the cron fix
  was deployed.
- The backup routine. The free tier has no provider backups and no point-in-time recovery,
  and idle pausing is kept at bay only by the five-minute delivery cron; the owner schedules
  `pnpm backup:local` from a workstation or records the accepted gap. The published free-tier
  limits are recorded in `docs/PROGRESS.md`.
- Housekeeping: keep or delete the paused staging project (test data only, never received
  custom SMTP), revoke the pasted Supabase access token in the dashboard, confirm the sending
  domain status at Resend, and bring the session branch's documentation and tooling into
  `main` through a pull request.
- Real customer content, the customer's hostname and DNS, and the go-live decision.
- Plan costs for Vercel, Supabase and Resend remain the owner's to confirm; none is quoted here.

Credentials shared during setup: the Resend key was replaced by two sending-only keys (one
per environment) and deleted; the 24-hour Vercel token was replaced on both projects on
2026-09-26 by a long-lived team-scoped token supplied through the build environment's
secrets; the Supabase access token is the owner's to revoke in the dashboard.

## 6. Known defects and limitations

- Scheduled delivery never ran on Vercel Cron until 2026-09-26: Vercel Cron calls the job
  endpoints on the production deployment's generated `*.vercel.app` hostname, where (a) the
  project's Standard Deployment Protection answered with a sign-in redirect that cron jobs do
  not follow, and (b) the application's host routing answered 404 for `/api/jobs/*` on any
  hostname other than `APP_HOST`. Found on production after the first real inquiry; fixed by
  limiting Deployment Protection to preview deployments and by exempting `/api/jobs/` from
  host routing; `pnpm launch:check` now probes the job endpoint on the deployment URL. Fixed
  in production the same day (pull request #6, deployment of `9b72435` at 13:07 UTC): the
  first cron slot afterwards delivered the waiting test inquiry unattended at 13:10 UTC, and
  the readiness report is green on the live deployment
  (`docs/evidence/production/launch-check-2026-09-26-after-cron-fix.txt`).

- The Turbopack development server intermittently answered 404 for a nested dynamic route
  that was first requested while another route was still compiling. It affects `next dev`
  only; browser tests therefore run against a production build (`docs/DECISIONS.md` D-009).
  If it appears during manual use of `pnpm dev`, restart the dev server.
- Route handlers that redirect must use relative `Location` headers; one upload handler
  built an absolute URL from `request.url` and lost the session in production mode. Fixed in
  this release; other handlers were reviewed.
- The dashboard is functional and consistent but plain; the public themes are the polished
  surfaces. Editor forms are long on small screens (they scroll; nothing overflows).
- A site has one logo image. The guide theme's footer sits on the primary colour, where a
  logo drawn for the light background would vanish, so that footer shows the wordmark; a
  dark-surface logo variant is part of D1. Favicons come from the media pipeline as WebP
  (or the generated SVG monogram); there is no ICO fallback for very old browsers.
- Snapshot schema version 2 (D0) adds configuration fields with defaults; releases stored
  as version 1 are normalised when read and are never rewritten. A candidate built before
  the D0 deployment and previewed after it renders with the defaults.
- Search is a snapshot-backed text match, not a ranked index. Adequate for the pilot sizes.
- Only the latin subsets of the three typefaces are bundled.
- Sessions issued for the hosted provider are not revoked by a password change at the
  identity provider; an owner who suspects a compromised account should remove the
  membership (takes effect on the next request) and the person signs in again after
  recovery. `private.delete_user_sessions` exists for an operator to revoke all sessions.
- Local demonstration accounts and the local auth provider are refused outside
  `APP_ENV=local`; they must never be deployed.

## 7. How to operate the local release

- Publish: Publish → "Publish now" takes the saved and approved work, checks it and
  activates it as a new release in one step; "Build a candidate" is the careful path with a
  frozen preview and waivers. Owners' and publishers' saves are approved as they are saved
  unless the site requires review (Settings → Publishing).
- Restore a release: Publish → Release history → open a release → review the difference
  → enter a reason → Restore. This creates a new release; nothing is rewritten.
- Export a site: Import & export → Download site package (ZIP with manifest and checksums).
  Import into another site with Upload and validate → Import package as drafts.
- Resume development: `docs/PROGRESS.md` (state, ledger, last results), `docs/DECISIONS.md`
  (D-001…D-014), `docs/OPERATIONS.md` (setup, resets, worker, backups, screenshot pass),
  `docs/DESIGN-PLAN.md` and `docs/DESIGN-TOKENS.md` (design programme), `pnpm verify`.
- Remaining setup for a hosted staging environment (requires the owner's accounts and
  approval): `docs/LAUNCH-CHECKLIST.md`, then `pnpm launch:check --env-file <file>` and
  `pnpm bootstrap:owner` for the first owner.

Local URLs only: `http://localhost:3000/app`, `http://localhost:3000/demo/pine-hollow`,
`http://localhost:3000/demo/range-athletics`. No public URL exists for this project.
