# Progress

Resume point for the build. Update after every milestone and before any context reset.

## Milestone state

| Milestone | State | Notes |
|---|---|---|
| M0 Foundation and setup | DONE (2026-09-25) | App runs, local PostgreSQL bootstrapped, 5 migrations + local auth shim applied, seeded accounts/orgs/sites, sign-in verified over HTTP, unauthorized site read returns 404 with no data. |
| M1 First complete publishing workflow | DONE (2026-09-26) | Edit → draft → approve → frozen candidate → preview → atomic activation → public demo route, verified by 28 unit, 21 integration and 2 browser tests. |
| M2 Complete editing and public experiences | DONE (2026-09-26) | All six content kinds editable and rendered; media pipeline with validation and derivatives; two fully populated fictional pilots with original generated artwork; search/filters; settings; site creation; responsive screenshots at 390/768/1440 with no overflow; 28 unit, 25 integration, 6 browser tests. |
| M3 Operational completion | DONE (2026-09-26) | Review queue, release restore, inquiry inbox + durable notification queue with worker, owner access management with local invitation flow, CSV import with dry run, portable site package export/import, audit log, retention job, backup + restore rehearsal. |
| Launch readiness (post-M4) | DONE (2026-09-26); staging verified the same day (see the hosted setup log) | Supabase Auth provider with platform sessions, invitations and password recovery; Supabase Storage provider; scheduled job endpoints + `vercel.json`; domain registration/verification/activation via the Vercel API and explicit go-live; hosted configuration enforcement; `pnpm launch:check`; `pnpm bootstrap:owner`; `docs/LAUNCH-CHECKLIST.md`. Provider adapters are unit-tested against recorded API shapes only. |
| M4 Verification and refinement | DONE (2026-09-26) | Acceptance matrix complete with evidence (38 PASS, 0 FAIL, 0 BLOCKED); ten-step demonstration automated with screenshots; browser suite moved to the production build; production build + secret inspection; Lighthouse lab runs; fresh-install rehearsal; release report in `docs/RELEASE-REPORT.md`. |
| Production (hosted) | DONE (2026-09-26) | Production Supabase and Vercel projects configured and deployed; owner signed in; inquiries stored and delivered by Vercel Cron after the routing fix; readiness report green (see the hosted setup log). |
| D0 Identity completeness | DONE (2026-09-26, on production: pull request #7 merged as `9c49d7a`, migration applied, live checks in `docs/evidence/production/d0-2026-09-26-live-checks.txt`) | Design programme phase 0 (`docs/DESIGN-PLAN.md` section 4): logo rendered, typography preset applied, every theme colour a derived token with a 15-pairing contrast gate and a literal-colour audit, per-site favicon/share image/title/language, editable listing copy, Search link switch, external links, footer layouts, page header image, inquiries switch enforced in SQL. Snapshot schema version 2 with version-1 releases normalised at read time. |
| D1 Bounded design options | DONE (2026-09-26, on production: pull request #8 merged as `1f8407d`, migration `20260926000200_media_focal_point.sql` applied, live checks in `docs/evidence/production/d1-2026-09-26-live-checks.txt`) | Site-wide design options (owners only, audited), section styles and appearance validated against each theme's declared vocabulary on save, import and publication, seven new section types (FAQ, quotes, call to action, gallery, facts, click-to-load video, map link), media focal points, bold and italic in rich text, snapshot schema version 3 with a rendering-hash test over six frozen releases and a screenshot comparison of the restored D0-era releases (identical), both pilots re-composed. DES-06 to DES-09 PASS; Lighthouse and the 143 KiB script budget recorded (unchanged). |
| D2 Theme catalogue and design preview | BUILT (2026-09-26, verified in the repository; production on the owner's go: pull request, migration `20260926000300_design_delegation.sql`, live checks) | Theme registry with capability declarations (four compositions, two per preset: magazine for the guide, storefront for the retail business), theme switching per site with migration notes and compatibility checks on save, import and publication, design preview of the draft configuration over the active release at 390/768/1440, per-site design delegation (owner-only switch, database trigger, audit), header button, overlay header, dark-surface logo, three more self-hosted typography presets, snapshot schema version 4 with eight frozen releases in the rendering-hash test, fonts served from `public/fonts/` with a per-preset preload (D-019). DES-10 and DES-11 PASS; Lighthouse and the 143 KiB script budget recorded. Bounded by D-017 (not a page builder). |
| D3 Visual in-context editing | OPTIONAL (owner's decision 2026-09-26; decided after D2 is in customer use, D-017) | Editable preview with keyboard-equivalent reordering, side-panel forms on the same schemas, live tokens, explicit save; same review and publication path; nothing beyond the same validated structures. |
| B1 Publish in one step, navigate by task (`docs/SITE-BUILDING-PLAN.md`) | BUILT (2026-09-26, verified in the repository; production with D2 on the owner's go) | Per-site review policy with approval on save for people who may publish (migration `20260926000400_review_policy.sql`, D-020); Publish page computing the next release without writing and publishing it in one action; sidebar grouped by task, overview built around content, look and publish with a checklist of actual missing data; Look page with brand, design and the preview together; Settings without the design cards and with a section index; editor labels following the policy. SB-01 to SB-03 PASS (integration and browser tests, screenshots in `docs/evidence/dashboard/`); SB-06 measured by `tests/e2e/walkthrough.spec.ts` (create, brand, five places, publish: 19 screens, 30 fields, 25 actions after B1; 4 empty-state notices on the published fresh home, for B2 to remove). |

## Environment blockers (precise)

- **No container runtime**: Docker client present, daemon absent (`/var/run/docker.sock`
  missing). `supabase start` cannot run. Mitigation: local PostgreSQL 16 server + local auth
  shim (see `docs/DECISIONS.md` D-002). Supabase Auth/Storage adapters are unverified here.
- **Supabase CLI** not installable: GitHub release downloads are denied by the egress proxy.
- Hosted services (Vercel, Supabase project, transactional email) are not configured; no
  account or credential exists in this environment. Nothing was faked.

## Last verified results

- 2026-09-26 (site-building phase B1) `pnpm verify` on the final code: GATE PASSED in 402 s
  (setup check 1 s, lint 15 s, typecheck 3 s, unit 4 s, integration 31 s, browser 316 s,
  production build 32 s): 95 unit tests (adds `site-nav.test`: the sidebar grouped by task per
  preset and role), 58 integration tests (adds `site-building.test`: approval on save for
  owners and publishers and never for editors, the review-required policy owner-only and
  audited, a fresh site's starter pages approved at creation, the next release computed
  without writing, one-step publishing with the note as the release reason, nothing to
  publish on a second call, a blocker refusing publication before any candidate exists,
  editors refused; `import-export.test` now expects the starter pages' approvals on save in
  the fresh site and none on the revisions the import writes), 30 browser tests against a
  production build (adds `site-building.spec`: SB-01 to SB-03 with screenshots in
  `docs/evidence/dashboard/`, and `walkthrough.spec`: the SB-06 measurement in
  `docs/evidence/walkthrough/`; `design.spec`, `themes.spec`, `demo.spec` and
  `publishing.spec` follow the policy: "Save" with approval on save for owners and
  publishers, "Build a candidate" for the careful path). The first gate run failed in the
  integration step twice: the package-import test expected no review rows in a fresh site
  (the starter pages are now approved at creation), and the site-building tests worked on
  pilot pages whose slug another file changes; both were made order-independent (the
  site-building tests use a page and a site they create). Walk-through after B1 (SB-06):
  19 screens, 30 fields, 25 actions, 5.2 s scripted; 4 empty-state notices on the published
  fresh home.
- 2026-09-26 (design phase D2) `pnpm verify` on the final code: GATE PASSED in 318 s (setup
  check 1 s, lint 14 s, typecheck 3 s, unit 4 s, integration 30 s, browser 260 s, production
  build 6 s): 91 unit tests (adds `themes.test`: catalogue invariants, theme resolution and
  compatibility, configuration defaults, typography presets with their files and stylesheet
  rules, and every route of the version-3 fixtures rendered under every compatible theme; the
  rendering-hash test now covers eight frozen releases), 51 integration tests (adds
  `themes.test`: DES-10 switch, preview, publish, restore and switch back, incompatible theme
  refused on save, at publication and on package import; DES-11 delegation enforced by the
  action and by the database trigger, audited, editors and reviewers denied), 26 browser tests
  against a production build (adds `themes.spec`: the magazine and storefront compositions
  switched to, previewed, published and switched back for both pilots; delegation granted and
  revoked). Screenshot pass `scripts/screenshots.ts`: 15 public pages × 390/768/1440 on the
  original compositions (all 200, no horizontal overflow, no console errors) plus 9 guide
  pages under the magazine and 6 retail pages under the storefront composition. Comparison of
  the original compositions against the D1 evidence: identical apart from the footer release
  number and the anti-aliasing of the back-link arrow (≤ 0.07 % of pixels); hashes
  re-recorded (D-015, D-019). Lighthouse after D2 (`docs/evidence/LIGHTHOUSE.md`): original
  compositions guide home median 93 / accessibility 100 / CLS 0.000 / LCP 3.07 s, store detail
  98 / 100 / 0.000 / 2.29 s, retail home 99 / 100 / 0.000 / 2.18 s, guide about 98 / 100 /
  0.000 / 2.40 s; D2 compositions magazine home 95 / 100 / 0.000 / 2.84 s, storefront store
  detail 97 / 100 / 0.000 / 2.52 s, storefront home 99 / 100 / 0.000 / 2.24 s, magazine about
  97 / 100 / 0.000 / 2.69 s; script transfer 143 KiB on every page (unchanged baseline). Two
  defects found and fixed by the first Lighthouse run: the magazine pages' layout shift of
  0.13–0.14 (fonts swapping in after the first paint; fixed by the font delivery change of
  D-019, which also raised the guide home's simulated LCP from 2.73 s to 3.07 s) and the
  storefront tiles' city label at 3.54:1 on the dark tile (now the tile's text colour with an
  accent bar). Two browser-test defects fixed: the settings page's theme description sat inside
  the select's label, and the sign-out step ran on pages without dashboard chrome.
- 2026-09-26 (design phase D1) `pnpm verify` on the final code: GATE PASSED in 273 s (setup
  check 1 s, lint 13 s, typecheck 4 s, unit 3 s, integration 28 s, browser 218 s, production
  build 6 s): 80 unit tests (adds theme capabilities, the new section schemas, design defaults,
  version-1 normalisation, per-theme column defaults, rich text emphasis, and the rendering-hash
  test over six frozen releases), 48 integration tests (adds `design.test`: unsupported variant
  rejected by the save action without a write, blocked at publication and refused on package
  import; focal point published, rendered as `object-position` and reported as "Media
  changed"), 23 browser tests against a production build (adds `design.spec`: theme-only
  styles and types in the editor, the owner-only Design card with its audit event, computed
  `object-position` of the hero at 390/768/1440, and the click-to-load video with zero
  third-party requests before keyboard activation). Rendering-hash comparison of the D0-era
  releases restored on the seeded database: 39 pages × 3 widths identical in size, at most
  0.15 % differing pixels, all of it live hours text and the footer release number, after three
  retail fidelity fixes (section rhythm, default column counts, start-aligned reading width);
  hashes re-recorded (D-015). Screenshot pass `scripts/screenshots.ts`: 15 public pages ×
  390/768/1440, all 200, no horizontal overflow, no console errors; lazily loaded images are
  now scrolled into view before capture. Lighthouse after D1 (`docs/evidence/LIGHTHOUSE.md`):
  guide home median 96 / accessibility 100 / CLS 0.025 / LCP 2.73 s; store detail 97 / 100 /
  0.011 / 2.30 s; retail home 99 / 100 / 0.006 / 2.06 s; guide about 98 / 100 / 0.025 / 2.20 s;
  script transfer 143 KiB on every page (unchanged baseline). One defect found and fixed by
  the new screenshots: the retail full-width hero's text panel painted beneath the image (a
  non-positioned block background paints before later replaced content); the panel is now
  positioned.
- 2026-09-26 (design phase D0) `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 59 passed
  (adds derived brand tokens, pairings and the literal-colour audit of `src/themes`; the
  contrast gate names every failing pairing; external navigation links); `pnpm test:integration`
  43 passed (adds a site published with the Inquiries module off: `submit_inquiry` raises
  P0002 and stores nothing); `pnpm test:e2e` 19 passed against a production build (adds the
  public identity test: `lang`, own title, favicon, share image, logo, token variables).
  Screenshot pass `scripts/screenshots.ts`: 13 public pages × 390/768/1440, all 200, no
  horizontal overflow, no console errors (`docs/evidence/screenshots/`). Lighthouse after D0:
  guide home median 96 / accessibility 100 / CLS 0.026 / LCP 2.82 s; store detail 99 / 100 /
  0.011 / 1.87 s; script transfer 143 KiB per page recorded as the DES-14 baseline
  (`docs/evidence/LIGHTHOUSE.md`). `pnpm verify` on the final code: GATE PASSED in 221 s
  (setup check 2 s, lint 11 s, typecheck 2 s, unit 2 s, integration 26 s, browser 172 s,
  production build 6 s).
- 2026-09-26 (job endpoints on every hostname) `pnpm lint`, `pnpm typecheck` clean; `pnpm test`
  51 passed; `pnpm test:e2e tests/e2e/routing.spec.ts` 4 passed against a production build
  (ROUTE-01 now also asserts `/healthz` 200 and `/api/jobs/deliver` 401 or 503, never 404, on
  an unknown hostname). The build container runs as root, so the local PostgreSQL 16 cluster
  was started as the `postgres` user before `pnpm db:start`.
- 2026-09-26 (hosted auth tool) `pnpm lint`, `pnpm typecheck` clean; `pnpm test` 51 passed
  (adds `pnpm hosted:auth` argument parsing, change-set validation, Management API calls
  with an injected fetch, redaction and read-back verification).
- 2026-09-26 (launch readiness) `pnpm test` 44 passed (adds GoTrue, Supabase Storage, Vercel
  and Resend adapter tests with an injected fetch, hosted configuration validation, job
  authorization); `pnpm test:integration` 42 passed (adds platform sessions, domain workflow
  and go-live, scheduled job endpoints); `pnpm launch:check` and `pnpm bootstrap:owner`
  executed locally (see ACCEPTANCE LAUNCH-07). `pnpm verify` GATE PASSED in 214 s: setup
  check, lint, typecheck, 44 unit, 42 integration, 18 browser tests (production build),
  production build.

- 2026-09-26 (M4) `pnpm test:e2e` 17 passed against the production build (adds the ten-step
  demonstration in three serial tests with screenshots, keyboard/focus checks, 200% zoom
  overflow check, host routing/metadata/sitemap and cross-site asset denial). `pnpm lint`,
  `pnpm typecheck` clean. Two defects found and fixed by the new tests: the upload handler
  redirected to an absolute URL built from `request.url` (wrong origin under `next start`),
  and the demo banner was read from the frozen snapshot instead of the render context.
  Lighthouse 13.5.0 (mobile, simulated throttling, 3 runs each, production build): guide home
  median performance 96 / accessibility 100 / CLS 0.026 / LCP 2.69 s; store detail 99 / 100 /
  0.01 / 1.97 s (`docs/evidence/LIGHTHOUSE.md`). Production build clean; client bundle secret
  scan 0 hits; production headers verified (OPS-03). `pnpm verify` GATE PASSED in 205 s
  (setup check 1 s, lint 8 s, typecheck 3 s, unit 2 s, integration 21 s, browser 152 s,
  build 18 s).

- 2026-09-26 (M3) `pnpm test:integration` 33 passed (adds delivery queue with failing provider
  and lease exclusivity, invitations, CSV dry run/idempotency, package export→import into a
  fresh site with matching counts and asset hashes). Worker run against the dev database
  delivered 2 queued notifications to `.data/mail/`. Invitation flow verified in a browser.
- 2026-09-26 (M2) `pnpm test` 28 passed; `pnpm test:integration` 25 passed (adds media
  validation); `pnpm test:e2e` 6 passed (publishing loop, access denial, directory filters and
  search, events/hours truthfulness, public inquiry form to inbox, upload rejection/acceptance).
  Responsive screenshot pass (15 public pages × 390/768/1440 plus dashboard screens) reported
  no horizontal overflow and no console errors: `docs/evidence/screenshots/*-{390,768,1440}.png`.
- 2026-09-26 (M1) `pnpm test` 28 passed; `pnpm test:integration` 21 passed (isolation, publishing
  integrity, inquiries); `pnpm test:e2e` 2 passed (full publishing loop; access denial).
  `pnpm lint` and `pnpm typecheck` clean. Browser evidence: `docs/evidence/screenshots/m1-*.png`.
- 2026-09-25 `pnpm db:start`, `pnpm db:migrate` (6 migrations + shim), `pnpm seed:demo`,
  `pnpm typecheck` all succeed.
- 2026-09-25 HTTP checks against `next dev`: `/app` without session → 307 to `/sign-in`;
  owner session → 200 listing both organizations; editor A → 404 for organization B's site,
  200 for site A with only Content/Reviews navigation.
- psql boundary probes: app role without context denied; anon denied on tables, allowed on
  `get_demo_release`; authenticated stranger sees 0 rows and cannot create organizations.

## Current task

Site-building programme (`docs/SITE-BUILDING-PLAN.md`, decision D-020), started on the
owner's go of 2026-09-26 after the honest assessment recorded in the plan's section 1 (the
check itself: two fresh sites created from the presets on the local development database,
`cedar-bend` and `northfork-outfitters`, published as empty scaffolds and screenshotted).
Phase B1 is built: review policy per site (`sites.review_required`, off by default) with
approval on save for people who may publish; the Publish page with the next release computed
without writing and published in one action; the dashboard grouped by task with a rebuilt
overview, a Look page and a settings index; editor controls following the policy. Next is B2
(from empty to launch: starter structure, onboarding package, bulk media, editor speed).
Production for D2 and B1 together needs the owner's go: migrations
`20260926000300_design_delegation.sql` and `20260926000400_review_policy.sql` applied to the
production project first, then the pull request, the deployment and the live checks.

Design programme phase D2 (theme catalogue and design preview) is built and verified in the
repository on branch `claude/lucid-darwin-cif2y6`; it is not on production. Production needs
the owner's go for: the pull request into `main`; the migration
`20260926000300_design_delegation.sql` (adds `sites.design_delegated`, the owner-only
`set_design_delegation()` function and the trigger that refuses a design change in a
configuration revision from anyone but an owner unless the site is delegated) applied to the
production project through the Management API before the merge; and the live checks
afterwards. What the branch holds: the theme registry and capability declarations (four
compositions; `docs/DESIGN-PLAN.md` section 4 lists what shipped and where), theme switching
per site with migration notes, the design preview at `/app/sites/{siteId}/previews/design`,
delegation, the header button, the overlay header, the dark-surface logo, three typography
presets, snapshot schema version 4, the font delivery change of D-019, decisions D-018 and
D-019; tests in `tests/unit/themes.test.ts`, `tests/integration/themes.test.ts` and
`tests/e2e/themes.spec.ts`; evidence in `docs/ACCEPTANCE.md` (DES-10, DES-11, DES-13 and
DES-14, DES-09 extended), `docs/evidence/LIGHTHOUSE.md`,
`docs/evidence/lighthouse/d2-2026-09-26-summary.txt` and
`docs/evidence/screenshots/{magazine,storefront}/`. The local development database has both
pilots back on their original compositions (release 8 of each) after the theme round trip
used for the screenshots and the version-4 fixtures.

Rendering-hash re-record (D-015), D2: version-4 fixtures of both pilots on the magazine and
storefront compositions (release 7 of each) were added, and the hashes of all eight fixtures
were re-recorded once, because the font delivery change (D-019) altered the theme root's class
names and added the preload links to every page. The justification is the screenshot
comparison of the pilots restored to their original compositions against the D1 evidence:
15 pages × 3 widths identical in size, at most 0.07 % differing pixels, all of it the footer
release number and anti-aliasing of the arrow glyph in the detail pages' back links
(identical at 3× magnification). The D1 pass in `docs/evidence/screenshots/` was replaced by
this one.

Phase D1 (bounded design options) remains on production. With the owner's go
(2026-09-26): migration `20260926000200_media_focal_point.sql` applied to the production
project through the Management API at 16:11 UTC (1 applied, 8 already applied; the two
nullable columns confirmed through the API afterwards), pull request #8 merged into `main`
as `1f8407d` at 16:11 UTC, Vercel deployment `dpl_Bzgnvhr3o3Vsi4pLj2cmneB9zfCr` READY at
16:12 UTC, then live checks on `https://app.lernerworksplatform.dev` (evidence
`docs/evidence/production/d1-2026-09-26-live-checks.txt`): the owner's test site's
version-1 release renders through the schema-version-3 renderer with the design scale
variables (`--radius`, `--section-gap`, `--band-pad`, `--container`), the default section
colours and the brand and font variables on the theme root, `lang="en"`, its own title and
no platform name; favicon, listing and search routes answer 200, an unknown site 404, the
sign-in page and `/healthz` 200, the cron target 401. The dashboard-side controls (Settings →
Design, section styles in the page editor, the focal point editor in the media library) need
the owner's session and are the owner's look. See the D1 row above, `docs/DESIGN-PLAN.md`
section 4 (what shipped, and where), decisions D-015 and D-016, and the DES-06 to DES-09,
DES-13 and DES-14 rows of `docs/ACCEPTANCE.md`.

Rendering-hash re-record (D-015): the hashes in `tests/fixtures/releases/hashes.json` were
re-recorded for the version-1 and version-2 fixtures because D1 changes the markup of every
page (section frames, `--section-*` variables, design variables); the visual check that
justifies it is the screenshot comparison recorded under DES-09: the D0-era releases render
identically with the D1 code once three retail differences found by the comparison were
fixed. Version-3 fixtures (the re-composed pilots, release 6 of each) were added.

Phase D0 remains on production as merged on 2026-09-26 (`9c49d7a`; live checks in
`docs/evidence/production/d0-2026-09-26-live-checks.txt`). The Vercel project
`lerner-works-platform` serves `main` at `https://app.lernerworksplatform.dev` against the
Supabase project `lerner-works-platform-production` (`fvpooyxkuvltjzjbevxf`). No customer
organization, site or hostname exists yet.

## Next action

Site-building programme phase B2 (from empty to launch) continues on the branch: starter
pages with a real structure, the onboarding package, multi-file media upload, editor speed
(`docs/SITE-BUILDING-PLAN.md` section 3). Owner: give the go for production when wanted: pull
request from `claude/lucid-darwin-cif2y6` into `main`, migrations
`20260926000300_design_delegation.sql` and `20260926000400_review_policy.sql` applied to the
production project first, deployment, live checks (a version-1 release still renders;
`/fonts/*.woff2` answer 200 with the immutable cache header; the preload links sit in the
head; the dashboard sidebar shows the task groups), then look at the D2 and B1 controls on
the production test site: Look → Theme with the compatible compositions and the preview
beside it, the Publish page with "Publish now", Settings → Publishing → review policy, the
delegation switch, the header button and the dark logo. Open points: the default of the
review policy for organizations with editors; photography for the proof site; further video
providers; whether D3 happens at all (after the site-building programme, D-017).

Owner: accept the pending invitation from its email (the last owner-session check of
`docs/LAUNCH-CHECKLIST.md` section 6); decide the backup routine (the free tier has no
provider backups: `pnpm backup:local` dumps the database from a workstation with the admin
connection string but does not cover the storage buckets, so media relies on the per-site
package export or on a plan with provider backups; or record the accepted gap here); decide
whether the paused staging project stays or is deleted; revoke the pasted Supabase access
token in the Supabase dashboard; confirm the sending domain status at Resend. Then the
customer work of section 7: organization and site with approved real content, the customer's
hostname and DNS, activation and go-live, one pilot at a time.

## Restore rehearsal (OPS-02) — 2026-09-26

`pnpm backup:local` produced `.data/backups/2026-09-26T01-10-47-599Z/` (pg_dump custom
format + storage tar). `pnpm restore:rehearsal` restored it into a new local database
`lernerworks_restore_test` with copied storage: 2 sites, 39 items, 4 releases, 26 media
assets, 2 inquiries restored; 78 of 78 derivatives present, 0 missing. Provider-dependent
parts before a hosted launch: managed database backups, bucket versioning, and the identity
provider's user store (local auth users are included in the dump; Supabase Auth users would
not be).

## Hosted setup log (staging)

Actions performed with owner-supplied credentials, recorded without secrets. Each line is a
fact verified through the provider's API at the time; nothing below claims a working
deployment until the smoke tests in `docs/LAUNCH-CHECKLIST.md` run.

- 2026-09-26 Vercel team "ARProject" (Pro plan): token verified read-only; the team also
  hosts the existing live properties, which are not touched. Vercel's GitHub app has access
  to the platform repository. Creating the project through the API was blocked by the
  session's safety check; the owner creates it in the dashboard (name
  `lerner-works-platform-staging`).
- 2026-09-26 Domain `lernerworksplatform.dev` is Vercel-managed (nameservers
  ns1/ns2.vercel-dns.com, verified, wildcard alias to Vercel). Decided hostnames:
  `staging.lernerworksplatform.dev` (staging) and `app.lernerworksplatform.dev` (production).
- 2026-09-26 Resend: domain `lernerworksplatform.dev` registered (region us-east-1); with the
  owner's approval the four DNS records Resend required (DKIM TXT, MX and SPF TXT on `send`,
  CNAME `rsend`) were added to the Vercel zone through its API; Resend reports the domain
  **verified**. Sender for the platform: `notifications@lernerworksplatform.dev`.
- 2026-09-26 Supabase project `Lerner-Works-Platform-` (ref `pgnffhnlgxqpsvgloshz`, us-east-1,
  PostgreSQL 17; created by the owner) used as the staging project: through the Management
  API the seven migrations were applied (`pnpm db:migrate --project-ref`), the `lw_app` role
  created (`pnpm hosted:roles`), Auth set to sign-ups disabled with the staging site URL and
  recovery redirect, buckets `private` (private) and `public-assets` (public) created.
  Verified state: 19 tables all with RLS, no PostgREST grants on `app_sessions`, `lw_app`
  can execute the session functions, no local auth shim. A separate production project is
  still to be created before launch.
- 2026-09-26 Vercel project `lerner-works-platform-staging` (`prj_3o7NzqXkOF4OWCiMeXrJ40e68UYL`)
  created through the API without a Git link (the linked variant was refused by the session's
  safety check as a deployment); Next.js, Node 22, `pnpm install --frozen-lockfile` /
  `pnpm build`; all 21 environment variables set (secrets as sensitive); hostname
  `staging.lernerworksplatform.dev` attached and reported as configured. The database password
  of the Supabase project was rotated with the owner's approval so the elevated connection
  string could be set. Sender: `notifications@lernerworksplatform.dev`.
- 2026-09-26 Repository connected to the Vercel project with `main` as production branch;
  first deployment `dpl_HFYpGUZLcbDM8eambuoJVxZ6oVEe` from `main` (commit `bf928e5`) READY;
  `https://staging.lernerworksplatform.dev/healthz` answers `{"ok":true,"database":"reachable"}`
  through the pooler as the application role; `/app` redirects to sign-in.
  `pnpm launch:check --env-file … --project-ref` reported every item OK before deploying.
  Supabase Auth SMTP through Resend was not set (the session's safety check refused the
  secret write); the default Supabase mailer remains until the owner enters it.
- 2026-09-26 First owner created on staging (`pnpm bootstrap:owner --project-ref … --confirm-hosted`,
  Supabase Auth account + organization "Lerner Works"); password kept out of the chat, the
  owner takes over through "Forgot your password?". Smoke tests 1–6 (`pnpm smoke`, see
  ACCEPTANCE LAUNCH-06) passed against staging; screenshots in `docs/evidence/staging/`.
  Test messages went only to the owner's mailbox (invitee: a plus-address of it). Browser
  runs from the build environment needed its proxy authority in the NSS store (not a TLS
  bypass). Left on staging: three `smoke-*` sites (one published), the invitee account
  (membership removed), test inquiries and invitations. Supabase Auth SMTP still uses the
  default mailer. The `VERCEL_API_TOKEN` in the project environment is the owner's
  24-hour token and must be replaced with a long-lived one for the domain workflow.
- 2026-09-26 The Supabase project is on the **free tier** (the Management API refuses email
  template changes there without custom SMTP): idle projects pause, there are no daily
  backups, and auth email is limited to a few messages an hour. The owner's first password
  recovery did not complete. Fix shipped: `/auth/recovery` also accepts the provider's
  `token_hash` link, which works from any browser; a one-time link generated through the
  admin API replaces the rate-limited email for the owner's first sign-in.
- 2026-09-26 Owner set a password through the one-time token-hash link and signed in to
  staging (reported by the owner; provider shows the password update and a live session).
- 2026-09-26 Email key rotation: a new sending-only Resend key restricted to
  `lernerworksplatform.dev` replaced the key shared during setup on the staging project;
  staging was redeployed from the branch tip (`dpl_F7Vhp1z4hJuMhFi2jgLmzRPMP2gP`), a test
  inquiry on the smoke site was delivered through the job endpoint with the new key
  (provider event `delivered`, receipt LW-3B6E91AC, to the owner's mailbox), and the old
  key was deleted at the provider (it is now refused). The pasted Supabase access token
  cannot be revoked through the API: the owner revokes it in the Supabase dashboard. The
  24-hour Vercel token expires on its own (2026-09-27 03:16 UTC); creating a long-lived
  token through the API was refused because the token is team-scoped (`403`, "must be
  authenticated to scope"), so the owner creates one in Account Settings → Tokens and sets
  `VERCEL_API_TOKEN` on both projects. The production Vercel project
  `lerner-works-platform` (`prj_OHSZEIrlDPAuUOrEOg3P7Q9AGXqn`, same team, Node 22.x) has
  `app.lernerworksplatform.dev` attached and verified (the zone is on Vercel DNS) and these
  variables for the production target only: APP_ENV/APP_URL/APP_HOST, providers, a separate
  sending-only Resend key, sender address, bucket names, fresh SESSION_SECRET and
  CRON_SECRET, VERCEL_PROJECT_ID/TEAM_ID. It is deliberately not linked to the repository
  and has no deployment until a production Supabase project exists: creating one through
  the Management API returned `Forbidden` and the token lists no organizations.
- 2026-09-26 PR #3 was merged by the owner at 03:41 UTC, before the smoke suite, the
  recovery fix and the later log entries were pushed; those commits and this entry go to
  `main` through a follow-up pull request. `main` is not yet the default branch (a
  repository setting the owner changes).
- 2026-09-26 Long-lived Vercel token: the session started to set `VERCEL_API_TOKEN` on both
  Vercel projects and redeploy staging, but no token variable was present in the build
  environment (`VERCEL_API_TOKEN` and `VERCEL_TOKEN` were both unset/empty), so nothing
  was sent to Vercel: no environment variable was written on either project, no deployment
  was created, and the domain check (`tokencheck.lernerworksplatform.dev`) was not run. The
  staging project's `VERCEL_API_TOKEN` still holds the owner's 24-hour token, which was
  revoked earlier the same day, so registering a hostname from the staging dashboard fails
  until it is replaced. The session's own environment ("Aragonite Soil 2") is one of three
  the owner has; the token must be saved in that one, under exactly that name, and the
  step is repeated from a fresh session.
- 2026-09-26 Long-lived Vercel token set (05:09–05:11 UTC). The owner saved a manual,
  team-scoped Vercel token (team ARProject, no expiry) in the build environment as
  `VERCEL_API_TOKEN`; the session verified it read-only first (`/v5/user/tokens/current`,
  `/v2/teams`). The staging project's existing `VERCEL_API_TOKEN` variable was updated in
  place (sensitive, production + preview targets; its previous value had last been changed
  from the owner's account at 04:48 UTC) and `VERCEL_API_TOKEN` was created on the
  production project (sensitive, production target only, matching its other variables).
  Staging was redeployed from `main` (commit `7f4caf7`, deployment
  `dpl_6Z8ZtGJfF1kVbgRLo16K8Dv1wTwK`, READY after 32 s, now the project's production
  deployment behind `staging.lernerworksplatform.dev`); `/healthz` answers
  `{"ok":true,"database":"reachable"}` and `/app` redirects to sign-in. Domain check with
  the new token through the application's own Vercel adapter (`VercelDomainProvider` with
  the staging project and team ids, run from the build environment):
  `tokencheck.lernerworksplatform.dev` was registered and reported verified and configured
  (`configuredBy: A`; the zone is on Vercel DNS), served `/healthz` 200 from the new
  deployment, was removed, and was then reported as not registered; the hostname answers
  404 again. Not run: the same workflow from the staging dashboard, which needs an owner
  session (smoke test 6 covers it with owner credentials). The production project remains
  unlinked and without a deployment. No token value was printed, logged or committed.
- 2026-09-26 The remaining owner items were attempted from the build environment later the
  same day; all five are BLOCKED here. The environment holds no Supabase or Resend
  credential (only `VERCEL_API_TOKEN`), so Supabase Auth SMTP, the production Supabase
  project and the Supabase plan could not be touched; the plan is a billing decision (no
  price is quoted here); the pasted Supabase access token can only be revoked in the
  Supabase dashboard; the repository's default branch is still `claude/new-session-ywlx40`
  (remote HEAD) and the session's GitHub tools cannot change repository settings, so the
  owner sets it in GitHub → Settings → General → Default branch. Prepared instead:
  `pnpm hosted:auth --project-ref <ref>` sets Supabase Auth's site URL, redirect
  allow-list, sign-ups and Resend SMTP (`smtp.resend.com:465`, user `resend`, key from
  `AUTH_SMTP_RESEND_API_KEY`) through the Management API, reads the settings back and
  verifies them (`--show`, `--dry-run`), and `pnpm launch:check --project-ref` reports
  the auth email sender. Field names were checked against the published OpenAPI document
  of `api.supabase.com`; lint, typecheck and 51 unit tests pass (6 new, injected fetch);
  the command has not run against a live project. A next run needs, in the cloud
  environment's secrets: `SUPABASE_ACCESS_TOKEN` (a personal access token of an owner of
  the Supabase organization, able to list organizations and create projects) and
  `AUTH_SMTP_RESEND_API_KEY` (a sending-only Resend key restricted to
  `lernerworksplatform.dev`). Staging then takes `pnpm hosted:auth --project-ref
  pgnffhnlgxqpsvgloshz --smtp-resend --sender notifications@lernerworksplatform.dev`;
  production takes project creation, `pnpm db:migrate`, `pnpm hosted:roles`,
  `pnpm hosted:auth --site-url https://app.lernerworksplatform.dev --redirect
  https://app.lernerworksplatform.dev/auth/recovery --disable-signups --smtp-resend …`,
  the buckets, the remaining variables, the repository link and the deployment.
- 2026-09-26 With `SUPABASE_ACCESS_TOKEN` and a sending-only Resend key (saved by the owner
  as `ResendToken`) in the build environment, both verified read-only first: the Supabase
  token lists the organization "jlerner1965's Org" on the **free** plan with three projects
  (the AragoCor site project, a paused unrelated project and the staging project; the
  AragoCor project was only listed, never touched); the Resend key is restricted to
  sending. Staging Auth settings as read back: site URL and redirect allow-list set,
  sign-ups disabled, no custom SMTP, 2 emails per hour. Then: (1) `pnpm hosted:auth
  --project-ref pgnffhnlgxqpsvgloshz --smtp-resend --sender
  notifications@lernerworksplatform.dev --sender-name "Lerner Works Platform"
  --rate-limit-email-sent 30` was refused by the session's safety check (secret-store
  writes), so Auth SMTP on staging is **unchanged**; the owner runs that command from a
  workstation with the two tokens in the environment, or enters the same values in the
  Supabase dashboard (host `smtp.resend.com`, port 465, user `resend`, password = the
  Resend key, sender `notifications@lernerworksplatform.dev`). (2) Creating the production
  project (`POST /v1/projects`, name `lerner-works-platform-production`, region us-east-1)
  was refused by Supabase: "maximum limits for the number of active free projects …
  jlerner1965 (2 project limit)"; nothing was created and the generated database password
  was discarded. The production project therefore waits for the organization's plan (the
  two free slots are the AragoCor site and staging), a decision and payment the owner makes
  in the Supabase dashboard.
- 2026-09-26 The owner made `main` the repository's default branch (remote HEAD now
  `refs/heads/main`, at `7f4caf7`); the work of this session is on
  `claude/lucid-darwin-cif2y6`, ahead of `main`, and reaches it through a pull request
  the owner opens or approves.
- 2026-09-26 Decision by the owner: no Supabase plan upgrade for now; production takes the
  staging project's free slot ("Option A": pause staging, create production fresh, retire
  staging; pre-production checks rely on the local environment and `pnpm verify`; free-tier
  caveats recorded in the session: idle pausing kept at bay only by the five-minute delivery
  cron, no provider backups, published size and compute limits). Pausing the staging project
  through the Management API was refused by the session's safety check (it refuses changes
  to shared resources), so the owner pauses `Lerner-Works-Platform-`
  (`pgnffhnlgxqpsvgloshz`) in the Supabase dashboard (Project Settings → General → Pause
  project). Prepared and waiting for the free slot: creation of `lerner-works-platform-production`
  (us-east-1) with generated database passwords kept in 0600 files only, then
  `pnpm db:migrate`, `pnpm hosted:roles`, `pnpm hosted:auth --site-url
  https://app.lernerworksplatform.dev --redirect …/auth/recovery --redirect …/** --disable-signups`,
  buckets through the Storage API, the five database and Supabase variables on the
  production Vercel project, and `pnpm launch:check --env-file --project-ref`. Auth SMTP on
  production will need the owner's hand as on staging. The first production deployment and
  the repository link wait for the owner's explicit go-ahead.
- 2026-09-26 The owner paused the staging project in the dashboard (status INACTIVE). The
  production Supabase project was then created through the Management API:
  `lerner-works-platform-production`, ref `fvpooyxkuvltjzjbevxf`, us-east-1, organization
  "jlerner1965's Org" (free plan), HTTP 201, status ACTIVE_HEALTHY. Its database password
  was generated in the session and exists only in a 0600 file of the session's scratchpad;
  if the session ends before it is written into `DATABASE_ADMIN_URL`, the owner resets it
  in the Supabase dashboard. The build sequence that followed (migrations, `lw_app` role,
  Auth site URL/redirects/sign-ups, buckets, the five database and Supabase variables on
  the production Vercel project) was refused as a whole by the session's safety check
  without a stated reason, so **none of it has run**: the production database is empty, no
  role, no buckets, Auth at provider defaults, and the production Vercel project still lacks
  `DATABASE_URL`, `DATABASE_ADMIN_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY`. The owner decides how to proceed: allow the action for the
  session (a permission rule, or a permission mode that asks per action) so the prepared
  sequence runs, or run `pnpm db:migrate --project-ref fvpooyxkuvltjzjbevxf`,
  `pnpm hosted:roles --project-ref fvpooyxkuvltjzjbevxf` (with `LW_APP_PASSWORD`) and
  `pnpm hosted:auth --project-ref fvpooyxkuvltjzjbevxf --site-url
  https://app.lernerworksplatform.dev --redirect https://app.lernerworksplatform.dev/auth/recovery
  --redirect 'https://app.lernerworksplatform.dev/**' --disable-signups` from a workstation
  and create the buckets and variables in the dashboards. `pnpm launch:check` now reports
  a sending-only Resend key as WARN (the domain status is confirmed at Resend) instead of a
  false FAIL, since both deployments use sending-only keys by design.
- 2026-09-26 Production build, after the owner switched the session to a per-action approval
  mode and approved each step. `pnpm db:migrate --project-ref fvpooyxkuvltjzjbevxf`: 7
  migrations applied. `pnpm hosted:roles`: `lw_app` login, noinherit, no RLS bypass.
  `pnpm hosted:auth`: site URL `https://app.lernerworksplatform.dev`, redirect allow-list
  `…/auth/recovery,…/**`, sign-ups disabled; then custom SMTP `smtp.resend.com:465`, user
  `resend`, sender `notifications@lernerworksplatform.dev` ("Lerner Works Platform") with the
  sending-only Resend key, 30 emails per hour; every value read back and verified. Legacy
  `anon` and `service_role` keys present (the project also has the new publishable/secret
  keys, unused). Pooler `aws-0-us-east-1.pooler.supabase.com`: `DATABASE_URL` for
  `lw_app.<ref>` in transaction mode (6543), `DATABASE_ADMIN_URL` for `postgres.<ref>` in
  session mode (5432). Buckets `private` (private) and `public-assets` (public) created
  through the Storage API. Vercel project `lerner-works-platform`: `SUPABASE_URL` and
  `SUPABASE_ANON_KEY` (plain), `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` and
  `DATABASE_ADMIN_URL` (sensitive) created for the production target; the generated
  passwords were deleted from the session afterwards. `pnpm launch:check --env-file
  --project-ref` on the production variables (placeholders only for `SESSION_SECRET` and
  `CRON_SECRET`, whose real values stay in Vercel): 23 rows OK, one WARN (the sending-only
  Resend key cannot read the domain status; the owner confirms it at Resend), READY;
  `docs/evidence/production/launch-check-2026-09-26.txt`. Not yet done: repository link,
  deployment, first owner, a delivery test through the relay. Staging stays paused with its
  test data and never received custom SMTP.
- 2026-09-26 Production deployed, on the owner's explicit go-ahead. The repository was
  linked to the Vercel project `lerner-works-platform` (production branch `main`) and `main`
  (commit `7f4caf7`, the commit staging's smoke tests passed) was deployed:
  `dpl_BuGsbLzt4HCw1VxD9E446wZRkpgz`, READY within a minute, aliased to
  `app.lernerworksplatform.dev`; `/healthz` answers `{"ok":true,"database":"reachable"}`
  through the pooler as the application role, `/` and `/app` redirect to sign-in,
  `/api/jobs/deliver` answers 401 without and with a wrong secret, both crons registered and
  enabled. First owner created with `pnpm bootstrap:owner --email … --organization "Lerner
  Works" --project-ref fvpooyxkuvltjzjbevxf --confirm-hosted`: Supabase Auth account and
  organization "Lerner Works" (`220f62f3-6ad7-4e8e-a8c8-66b00cff28a1`) with owner membership
  and audit event; the bootstrap password was random and discarded, the owner sets one
  through "Forgot your password?". Domain workflow on the production project through the
  application's Vercel adapter: `launchcheck.lernerworksplatform.dev` registered, reported
  verified and configured, served `/healthz` 200, removed, reported not registered; the
  hostname still answered 200 for under a minute after removal (edge propagation), then 404.
  Production domains: `app.lernerworksplatform.dev` and the vercel.app host only. From now on
  every push to `main` deploys to production.
- 2026-09-26 First production sign-in: the owner set a password through "Forgot your
  password?" and signed in (reported by the owner; the project shows one Auth user with a
  sign-in at 11:10 UTC, one platform session, one owner membership, no sites). The recovery
  email was the first delivery through Resend SMTP on production, so the relay works.
- 2026-09-26 Owner-session checks on production, reported by the owner and verified from the
  provider without reading personal data: site "Aragosan" (`aragosan`, community guide
  preset) created, contact settings updated, pages self-approved, candidates built and a
  release activated; `/demo/aragosan` and its contact page answer 200. One invitation
  (member role) created and its email received; not yet accepted (one Auth user, one
  membership). No inquiry exists: zero rows in `inquiries`, `delivery_jobs` and
  `rate_limit_events`, so no public form submission reached the endpoint, and the site has
  no inquiry recipients configured (the empty inbox was exported six times). The inquiry
  check is redone by the owner with a recipient set and then verified here.
- 2026-09-26 Inquiry delivery on production, investigated after the owner's contact-form test
  produced no email. Facts: the public form stores inquiries (three from the owner and one
  labelled scheduler test from the session; receipts LW-55B94BD6, LW-F5C3A848, LW-9FD10DB2,
  LW-FEAD02A1); the first two carried no recipients because the site had none configured
  (the site overview's setup checklist flags this), then the owner added one.
  `/api/jobs/deliver` called with the production `CRON_SECRET` (read through the Vercel API,
  never printed) worked: 3 claimed, 1 delivered to the owner's address through Resend
  (provider accepted), 2 failed with "no notification recipients are configured for this
  site". Vercel Cron, however, had processed nothing since the first deployment, for two
  reasons. (1) Deployment Protection was Standard (`all_except_custom_domains`), which covers
  the production deployment's generated `*.vercel.app` URL, the URL Vercel Cron calls; that
  URL answered 302 (sign-in redirect), and cron jobs neither follow redirects nor log them.
  Changed to "Only Preview Deployments" (`ssoProtection.deploymentType: preview`); the URL
  now answers 200. (2) The application's host routing rewrote `/api/jobs/*` on any hostname
  other than `APP_HOST` to the public site router, which answered 404, so cron invocations on
  the generated URL could never reach the job handler. Fixed in `src/proxy.ts` (`/api/jobs/`
  exempt like `/healthz`; the endpoints authenticate with the job secret), browser assertion
  added to ROUTE-01, and a "Cron target" row added to `pnpm launch:check` that probes the
  job endpoint on the production deployment URL and fails on a redirect or a 404. Also done:
  `commandForIgnoringBuildStep` on the production Vercel project skips non-production builds
  (branch pushes had produced failing preview builds for lack of preview variables), and the
  retired staging Vercel project was detached from the repository so merges no longer
  redeploy it against a paused database. PR #5 (this session's documentation and tooling)
  was merged by the owner at 12:44 UTC and redeployed production (`9341504`); the session
  branch restarted from `main`. The routing fix reaches production through the next merge;
  the pending scheduler-test job (LW-FEAD02A1) is the end-to-end proof once the first cron
  slot after that deployment delivers it.
- 2026-09-26 Cron fix verified in production. Pull request #6 (opened on the owner's
  instruction, merged by the owner at 13:06 UTC) redeployed production (`9b72435`, READY at
  13:07); the job endpoint on the deployment's generated URL now answers 401 instead of 404;
  `pnpm launch:check` on the live deployment: 24 rows OK including "Cron target", one WARN
  (sending-only Resend key), READY
  (`docs/evidence/production/launch-check-2026-09-26-after-cron-fix.txt`). The scheduler-test
  job that had waited since 12:52 was delivered by Vercel Cron at 13:10:38 UTC without any
  manual trigger (provider `resend`, accepted, reference stored). Inquiries therefore flow
  end to end on production: public form → stored → delivered within five minutes. The two
  jobs from before the recipient existed stay `failed` with the recipient message; the owner
  can re-queue them from the inquiry detail or leave them. Browser routing spec: 4 passed.
- Pending (owner): acceptance of the pending invitation; backup routine decision; keep or
  delete the paused staging project; revocation of the pasted Supabase token; sending domain
  status confirmed at Resend.

## Feature ledger

Columns: working UI · persistent backend · permission checks · tests · external configuration.

| Feature | UI | Backend | Permissions | Tests | External |
|---|---|---|---|---|---|
| Sign in / sign out (local provider) | yes | yes (local_auth shim) | n/a | e2e AUTH-01 | Supabase Auth adapter unverified |
| Organization overview + site switcher | yes | yes | RLS | e2e | — |
| Site overview with real counts, setup checklist | yes | yes | RLS + capability nav | e2e demo.spec step 1 | — |
| Site creation from preset (UI + seed) | yes | yes (`create_site`) | owner-only function | e2e demo.spec step 10 | — |
| Content list (filters, search, pagination, bulk archive) | yes | yes | RLS | manual | — |
| Content editor, all six kinds, explicit save, conflicts | yes | yes | RLS | integration DATA-02, e2e | — |
| Demonstration fixtures: 12 places/6 events/3 articles, 3 stores/4 services, pages, images, draft + pending review + two releases + fixture inquiry | seed + "Load demo content" | yes (normal services) | owner-only, demo sites only | e2e public specs | — |
| Draft preview and revision history | yes | yes | RLS | e2e demo.spec step 4 | — |
| Review submit / comment / request changes / approve; review queue | editor panel + queue | immutable reviews | policy per state | e2e (approve) | — |
| Candidate build, findings, waivers, frozen preview | yes | yes | publisher-only | integration PUB-01..05, e2e | — |
| Atomic activation with CAS + idempotency | yes | SQL function | function checks | integration PUB-03/05 | — |
| Release history and restore | yes | SQL function | function checks | integration PUB-06, e2e demo.spec step 9 | — |
| Public demo rendering (both themes, all kinds, index/detail/search/filters) | yes | read function | anon grants | e2e UX-03/TIME, integration PUB-08 | — |
| Live host routing, sitemap, robots | code | read function | anon grants | unit (host normalization), e2e routing.spec (test hostnames) | no real verified domain exists |
| Public inquiry intake (form + endpoint) | yes | `submit_inquiry` | function + RLS | integration LEAD-01/03/04/05 | — |
| Inquiry inbox (filters, detail, status, CSV export, delivery status) | yes | tables | RLS (owner/publisher) | e2e LEAD-01 | email provider unconfigured |
| Media upload / library / metadata / withdraw | yes | ingestion + local storage | RLS + owner withdraw | integration + e2e MEDIA-01 | Supabase Storage adapter unverified |
| Site settings (brand + contrast, navigation, modules, metadata, contact, domains) | yes | config revisions | publisher/owner; domains owner | integration (config save) | domain verification needs hosting |
| Access management + invitations UI | yes | SQL functions | owner-only | integration AUTH-05/07 + invitations, e2e access.spec | invitation email via local sink; Supabase invite flow unverified |
| CSV import (templates, mapping, dry run, confirm) | yes | import_jobs + transactions | editor+ | integration PORT-01/02 | — |
| Site package export/import | yes | ZIP with checksums | owner-only | integration PORT-03, e2e demo.spec step 10 | — |
| Audit trail view | yes | append-only table | owner/publisher | manual | — |
| Notification worker + retry + publisher re-queue | inquiry detail | lease-based queue | publisher retry | integration LEAD-02 | local sink; Resend adapter unverified |
| Retention job, local backup, restore rehearsal | scripts | yes | local-target guard | OPS-02 executed | provider backups for hosted |
| Hosted authentication (Supabase Auth + platform sessions, invitation account creation, password recovery) | sign-in, invite, forgot-password, recovery pages | `app_sessions` + private session functions | app-role-only functions; table unreachable by PostgREST roles | unit (GoTrue client), integration LAUNCH-02 | live GoTrue unverified (LAUNCH-06) |
| Hosted storage (Supabase Storage buckets) | same media UI | `SupabaseStorage` | service key server-only | unit (API shapes) | live buckets unverified (LAUNCH-06) |
| Scheduled job endpoints (`/api/jobs/deliver`, `/api/jobs/retention`) + `vercel.json` | — | elevated batch, bearer secret | constant-time secret check | integration LAUNCH-03 | cron cadence depends on plan |
| Domain workflow (register → provider → verify → activate, canonical, disable, remove) and go-live | Settings → Domains / Publishing mode | SQL functions + Vercel provider | owner-only, audited | integration + e2e LAUNCH-04, unit (Vercel client) | live Vercel API unverified (LAUNCH-06) |
| Hosted configuration enforcement, `pnpm launch:check`, `pnpm bootstrap:owner` | — | config validation, readiness script | refuses dev providers outside local | unit LAUNCH-01, LAUNCH-07 executed | — |

## Usage

Actual Claude Code usage is not visible from inside the session; the owner should read it
from their usage dashboard at each milestone. No estimate is recorded here.
