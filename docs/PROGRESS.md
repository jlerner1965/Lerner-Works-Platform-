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
| D2 Theme catalogue and design preview | DONE (2026-09-26, on production: pull request #9 merged by the owner as `d82bf6c`, migration `20260926000300_design_delegation.sql` applied at 20:32 UTC, live checks in `docs/evidence/production/d2-b1-2026-09-26-live-checks.txt`) | Theme registry with capability declarations (four compositions, two per preset: magazine for the guide, storefront for the retail business), theme switching per site with migration notes and compatibility checks on save, import and publication, design preview of the draft configuration over the active release at 390/768/1440, per-site design delegation (owner-only switch, database trigger, audit), header button, overlay header, dark-surface logo, three more self-hosted typography presets, snapshot schema version 4 with eight frozen releases in the rendering-hash test, fonts served from `public/fonts/` with a per-preset preload (D-019). DES-10 and DES-11 PASS; Lighthouse and the 143 KiB script budget recorded. Bounded by D-017 (not a page builder). |
| D3 Visual in-context editing | OPTIONAL (owner's decision 2026-09-26; decided after D2 is in customer use, D-017) | Editable preview with keyboard-equivalent reordering, side-panel forms on the same schemas, live tokens, explicit save; same review and publication path; nothing beyond the same validated structures. |
| B1 Publish in one step, navigate by task (`docs/SITE-BUILDING-PLAN.md`) | DONE (2026-09-26, on production: pull request #10 merged by the owner as `167c9d1`, migration `20260926000400_review_policy.sql` applied at 20:32 UTC, live checks in `docs/evidence/production/d2-b1-2026-09-26-live-checks.txt`) | Per-site review policy with approval on save for people who may publish (migration `20260926000400_review_policy.sql`, D-020); Publish page computing the next release without writing and publishing it in one action; sidebar grouped by task, overview built around content, look and publish with a checklist of actual missing data; Look page with brand, design and the preview together; Settings without the design cards and with a section index; editor labels following the policy. SB-01 to SB-03 PASS (integration and browser tests, screenshots in `docs/evidence/dashboard/`); SB-06 measured by `tests/e2e/walkthrough.spec.ts` (create, brand, five places, publish: 19 screens, 30 fields, 25 actions after B1; 4 empty-state notices on the published fresh home, for B2 to remove). |
| B2 From empty to launch (`docs/SITE-BUILDING-PLAN.md`) | DONE (2026-09-26; on `main` since pull request #11, merged by the owner as `4c69036` at 22:18 UTC; its migration `20260926000500_onboarding_package.sql` was already on production, applied with the D2 and B1 ones; the live checks on production are still to be run) | A section with nothing to show is left out of the public page by one rule shared by the four compositions and the validator (D-021); starter pages whose slots fill themselves, with a new `category_list` section; the onboarding package (template, dry run, one-transaction apply of images, rows and settings; migration `20260926000500_onboarding_package.sql`); CSV imports for articles and services with body text and featured images; multi-file upload with an alternative-text pass; quick add, duplicate, category suggestions and site defaults in the editor; imports approved on save under the review policy. SB-04 and SB-05 PASS, SB-06 re-measured (`docs/ACCEPTANCE.md`). |
| B3 Design richness inside the boundary (`docs/SITE-BUILDING-PLAN.md`) | DONE (2026-09-26; on `main` since pull request #11 with B2, merged by the owner as `4c69036` at 22:18 UTC, no migration; the live checks on production are still to be run) | Richer section vocabulary as typed sections and enumerated options (D-022): people, logo strip, image-and-text rows, photo band, portraits on quotations, hero collage/offset/statement, gallery lightbox drawn by CSS, click-to-load map (D-013 extended), rich text divider/callout/button; shared renderers used by all six compositions; the almanac (guide) and practice (location business) compositions; both pilots re-composed; snapshot schema version 5 with the earlier eight frozen releases unchanged and version-5 fixtures added; `scripts/set-demo-theme.ts`. SB-07 PASS; DES-13 and DES-14 re-measured (144 KiB script, +1 KiB for the map); screenshots per composition. Open: the owner's judgement on two sample sites with real photography (B4). |
| B4 The proof (`docs/SITE-BUILDING-PLAN.md`) | DONE in the repository (2026-09-26; on `main` since pull request #12, merged by the owner as `89a2f7b` at 23:37 UTC, no migration; the live checks on production are still to be run); the owner's judgement and own timing pending (SB-09) | Two realistic client sites with public-domain photography (Library of Congress, Carol M. Highsmith Archive; D-023) written as onboarding packages in `src/server/demo/proof/` (`pnpm proof:package`): Cedar Bend Guide (19 places, 7 events, 6 articles, 40 photographs) and Bookcliff Farm Markets (3 markets, 5 services, 21 photographs). Built end to end through the dashboard by `tests/e2e/proof.spec.ts`, counted per task and timed, captured under every composition of each preset (`docs/evidence/proof/`). Three defects found by the build and fixed: the proxy's 10 MB body buffer truncating a larger package, the settings sheet's opening picture ignored on a text-only home, colours failing contrast passing the dry run. Open: the owner's judgement on the captures and their own timed build on production with the packages (SB-08). |
| B5 Documents, links and the workbook (`docs/SITE-BUILDING-PLAN.md`) | DONE (2026-09-27; on production: pull request #14 merged by the owner as `a601e6c`, deployed READY at 02:00 UTC; migrations `20260927000100_media_documents.sql` and `20260927000200_content_kind_link.sql` applied at 02:02 UTC through the Management API, after the merge; public live checks in `docs/evidence/production/b5-2026-09-27-live-checks.txt`; the dashboard side is the owner's look) | The owner's review of B4 asked for PDFs beside the pictures, pages that are links to other websites and Excel instead of CSV (D-024). Documents in Media (PDF only, 25 MB, `media_assets.kind`; `document:<id>` link targets in text, buttons and section links; attachments on every item; the Downloads page section; served from the release as `<sha256>.pdf` inline with `nosniff`; a withdrawn document blocks the release; the site and onboarding packages carry them). Links as a content kind of both presets (https only, category, picture, summary, button label; cards that open the other site without a referrer; the `/links` index and its navigation entry once a link is published; a page of its own for search). The onboarding workbook (`content.xlsx` template with a sheet per kind, Site, Images, Documents and a Read me; uploaded on its own or inside the package; read by an OOXML subset in code and converted to the CSV files before the dry run; the proof packages carry it). Snapshot schema version 6, the ten earlier frozen releases unchanged, both pilots carrying sample links and documents. SB-10, SB-11 and SB-12 PASS. |
| B6 Removing a site or an organization (`docs/SITE-BUILDING-PLAN.md`) | DONE (2026-09-27; on production: pull request #15 merged by the owner as `4b0d99d` at 03:33 UTC and deployed at once, migration `20260927000300_removal.sql` applied at 02:52 UTC through the Management API, ahead of the merge this time, so the code found its functions in place; `/healthz` 200 on the deployment; the dashboard-side checks need the owner's session) | Owner-only deletion with a typed confirmation (D-025): Settings → Remove this site (the rows in one transaction with the `site.deleted` audit event, the files after, public copies kept while another site's release carries them, refused while live on a domain, the trail kept and the removed sites listed on the organizations page); Organizations → Remove organization… (sites first, then memberships and invitations, the row kept as a tombstone with its trail, the last organization owned refused). OPS-04 and OPS-05 PASS. |
| SB-09, the bar | The owner's verdict on 2026-09-27: NOT MET ("not something I would use, way too complicated, not enough easy customization like being able to upload zip"); B7 decided the same day | The platform's machinery (hosting on the client's domain, releases and restore, the inquiry inbox, access, audit) stays; the layer that decides how a site looks is not what an agency builds with. The bar is re-judged on the first real client site hosted the B7 way (`docs/SITE-BUILDING-PLAN.md`). |
| B7 Uploaded sites (`docs/SITE-BUILDING-PLAN.md`) | DONE in the repository (2026-09-27, D-026; on the branch as `d5125e9`, rebased onto `main` after pull request #15 had merged B6 six minutes before the B7 push; gated; migration `20260927000400_uploaded_sites.sql` applied to the production project at 03:38 UTC through the Management API, ahead of the merge). The Vercel side is done by the owner at 03:47 UTC: `*.preview.lernerworksplatform.dev` on the project's production target (verified) and `PREVIEW_DOMAIN` for production, redeployed. Waiting for the B7 pull request and its merge; then the live checks | A site built anywhere is uploaded as a ZIP and hosted as an immutable release: `sites.site_type` (`structured` or `uploaded`, chosen at creation; no preset, no starter pages), the archive checked before anything changes (`src/server/uploaded/archive.ts`: what a static host serves, safe paths, `index.html` at the top or inside one folder, 64 MB / 2,000 files / 25 MB a file, server-side files refused), files stored under their content hash and the release inserted and activated by one idempotent function (`publish_uploaded_release`, snapshot schema series 101), served on a preview hostname of its own (`<key>.<PREVIEW_DOMAIN>`, never the dashboard's origin, `no-store`, `noindex`) and on the live domain (clean addresses, the site's own 404 page, content-hash ETags, a minute at the CDN) by `src/server/uploaded/serve.ts` behind the proxy's rewrite (`/uploaded/<mode>/<target>/files/…`, the form to `…/inquiry`); the site's own contact form posts to `/_lw/inquiry` and lands in the inbox with a redirect back to its thanks page; a dashboard of Upload (check, publish, releases, restore), Inbox, Settings, Team and the activity log; the sample site "Harbor Lane Studio"; removal takes the files. UP-01 to UP-04 in `docs/ACCEPTANCE.md`; the owner's guide `docs/UPLOADED-SITES.md`. |

## Environment blockers (precise)

- **No container runtime**: Docker client present, daemon absent (`/var/run/docker.sock`
  missing). `supabase start` cannot run. Mitigation: local PostgreSQL 16 server + local auth
  shim (see `docs/DECISIONS.md` D-002). Supabase Auth/Storage adapters are unverified here.
- **Supabase CLI** not installable: GitHub release downloads are denied by the egress proxy.
- Hosted services (Vercel, Supabase project, transactional email) are not configured; no
  account or credential exists in this environment. Nothing was faked.

## Last verified results

- 2026-09-27 (site-building phase B7, uploaded sites) `pnpm verify` on the final code: GATE
  PASSED in 843 s (setup check 1 s, lint 18 s, typecheck 16 s, unit 6 s, integration 77 s,
  browser 702 s, production build 23 s): 170 unit tests in 22 files (adds `uploaded.test`: the
  sample ZIP inspected, a zipped folder's name dropped, droppings and hidden files skipped, a
  form posting elsewhere pointed out, the refusals, the manifest recognised and restorable, path
  resolution, the headers, nothing without the routing header, the proxy's rewrites of a
  preview hostname to the file handler and of `/_lw/inquiry` to the form handler with a page
  named `inquiry` left a file; `site-nav.test` gains the sidebar of an uploaded site); 85
  integration tests in 22 files (adds `uploaded.test`: publish and serve on the preview
  hostname and the live domain, the form into the inbox with the honeypot and a missing
  field, a second version and a restore, removal taking the files); 42 browser tests against a
  production build (adds `uploaded.spec`: the whole path from Create site → Uploaded to a
  restored release, UP-01 to UP-04). Found by the browser test before the gate, on the dev
  server: the form post answered 405, because a route folder named `_lw` is private to
  Next.js and the post fell to the file handler; the handlers now live under `files/` and
  `inquiry/` and the proxy maps `/_lw/inquiry`, with a unit test on the mapping. After the
  gate, `20260927000400_uploaded_sites.sql` was applied to the production project through the
  Management API at 03:38:21 UTC (1 applied, 15 already applied), ahead of the merge, and
  verified read-only: `site_type` with `structured, uploaded`; `sites.site_type` not null
  defaulting to `structured`; `create_site` with nine parameters (the eight-parameter
  signature gone, which the deployed B5 code still resolves through the default),
  `publish_uploaded_release`, `get_host_site_type` (callable by `anon`) and `delete_site`; the
  `import_jobs` check with `uploaded_site`
  (`docs/evidence/production/b7-2026-09-27-migration.txt`).
- 2026-09-27 (site-building phase B6, removal) `pnpm verify` on the final code: GATE PASSED in
  840 s (setup check 1 s, lint 19 s, typecheck 3 s, unit 6 s, integration 77 s, browser 703 s,
  production build 31 s): 161 unit tests in 21 files (adds the Supabase adapter's public
  deletion in `hosted-adapters.test`); 81 integration tests in 21 files (adds `removal.test`:
  a site with published media deleted with its rows and files while another site's shared
  public copies stay, the refusals, an organization deleted with its sites and tombstoned, the
  last-organization guard); 41 browser tests against a production build (adds `removal.spec`).
  The first gate run stopped at the typecheck on a torn `routes.d.ts` that a dev-server
  browser run had left under `.next-e2e/dev/`; the gate now removes that directory before it
  starts (`scripts/verify.ts`), and nothing in the code changed between the runs.
- 2026-09-27 (site-building phase B5) `pnpm verify` on the final code: GATE PASSED in 795 s
  (setup check 1 s, lint 19 s, typecheck 3 s, unit 6 s, integration 77 s, browser 652 s,
  production build 37 s): 160 unit tests in 21 files (adds `documents.test`: the public names
  and headers, the `document:` targets, the downloads section and attachments under every
  composition, the manifest's kinds and the validator's blockers; `links.test`: the kind, its
  routes, cards, index and page under every composition; `xlsx.test`: the workbook reader and
  writer and the sheet matching; `onboarding.test` and `proof.test` on the workbook; two
  version-6 fixtures in `rendering-hash.test`, the ten earlier ones unchanged); 78
  integration tests in 20 files (adds `documents.test`, `links.test`, `workbook.test`); 40
  browser tests against a production build (adds `documents.spec`, `links.spec`,
  `workbook.spec`; the proof builds run with the workbook packages). Found by the gate and
  fixed: the site package's path check named the content kinds by hand and refused a pilot
  package carrying links (it is built from the registry now); the onboarding spec expected
  the template's seven CSV files (four files now, the workbook among them); the workbook spec
  imported a link with the same title as a pilot fixture link. The first gate run had failed
  on the package check in three integration tests; nothing else changed between the runs.
- 2026-09-26 (site-building phase B4) `PROOF_EVIDENCE=1 pnpm verify` on the final code: GATE
  PASSED in 620 s (setup check 1 s, lint 17 s, typecheck 3 s, unit 5 s, integration 72 s,
  browser 513 s, production build 9 s): 133 unit tests in the gate run, 136 on the unit suite
  re-run after `proof.test` (the proof sites' pictures, sheets, settings and rights) was added
  to the same commit; 70 integration tests (adds `proof.test`: both packages dry-run clean,
  import in one step, publish with no blocker and render under every composition;
  `onboarding.test` extended: the dry run refuses colours that fail the contrast pairings);
  37 browser tests against a production build (adds `proof.spec`: Cedar Bend Guide built end
  to end in 12 screens, 83 fields and 43 actions, 36 s scripted, 25 s of it the package import
  of 50 pictures; Bookcliff Farm Markets in 8 screens, 52 fields and 26 actions, 18 s; 85
  captures under six compositions, all 200 with no overflow and no console error, written
  into `docs/evidence/proof/` by the evidence switch). The rendering hashes of the ten frozen
  releases are unchanged (no renderer change). Four defects found by the proof build and
  fixed on the way: the proxy's default 10 MB request-body buffer silently truncated the 14 MB
  package (the import then failed to parse it; `proxyClientMaxBodySize` is 64 MB now, the
  size the import promises); the settings sheet's opening picture had no effect on the
  location business's text-only starter hero (it becomes a picture hero when the composition
  offers one); colours that fail the publication gate's contrast pairings passed the dry run
  and blocked the first publish (the dry run refuses them, naming the pairing); the quick-add
  form said "Add a event". The proof's own scripted time is not a person's: the person's
  timing is the owner's, on production, with the same packages (SB-09).
- 2026-09-26 (site-building phase B3) `pnpm verify` on the final code: GATE PASSED in 426 s
  (setup check 2 s, lint 18 s, typecheck 16 s, unit 5 s, integration 39 s, browser 337 s,
  production build 9 s): 133 unit tests (adds `rich-sections.test`: the capabilities of every
  composition, the nothing-to-show rule and slot hints for the new sections, a page rendered
  under all six compositions from a synthetic release, the hero treatments with and without a
  picture, the map offered to a live visitor and withheld otherwise, the validator's blockers
  and warnings, every picture reference collected into the manifest; `richtext.test`: the
  divider, callout and button blocks; `design-options.test`: the B3 schema; `themes.test`: six
  registered compositions; `rendering-hash.test` over ten frozen releases, the eight earlier
  ones unchanged), 68 integration tests (adds `rich-sections.test`: SB-07 end to end through
  the real services; `themes.test` extended: the B3 compositions switched to and back), 35
  browser tests against a production build (adds to `themes.spec`: under the almanac the
  navigation rail, the lightbox opened, moved and closed by links alone and the map panel;
  under the practice the header's phone number and contact button, the location cards and the
  hours table; `design.spec`: the editor's new sections and treatments). Found by the gate and
  fixed on the way: the package import's placeholder pass stripped the required pictures out
  of a page's logo strip and image-and-text rows and failed the schema (the placeholder now
  leaves sections out); the onboarding result listed the starter pages in database order (Home
  before About now, whatever order the rows come back in); the lightbox dialog exposed two
  links named Close, the click-away backdrop and the button (the backdrop is now a pointer
  affordance hidden from assistive technology). Two test couplings removed: the media test
  owns the picture it withdraws instead of the pilot's storefront picture, which the
  re-composed home and About pages also show; the guide's home page no longer links to the
  About page, whose slug the route test renames.
- 2026-09-26 (site-building phase B2) `pnpm verify` on the final code: GATE PASSED in 400 s
  (setup check 1 s, lint 15 s, typecheck 3 s, unit 5 s, integration 34 s, browser 321 s,
  production build 21 s): 113 unit tests (adds `starter-structure.test`: the
  nothing-to-show rule per section type, the category list's counts and order, both presets'
  starter pages parsed, rendered without a placeholder notice on all four compositions and
  validated with the sections left out named, the editor's slot hints; `onboarding.test`:
  the template's files and sheets, the CSV specs for every kind, rows to payloads with body
  text, images and pending service references; `snake-keys.test`: every stored key survives
  the database client's key transform), 66 integration tests (adds `onboarding.test`: dry
  run and one-transaction apply of a full package with images, settings and page text,
  refusals, a plain CSV cannot name an image, services before stores; `editor-speed.test`:
  every kind created from a title with the site's defaults, the category asked for a place,
  duplicates with free slugs, approved for the owner and not for an editor; `media-batch.test`:
  the alternative-text pass; `import-export.test` extended: approval on save for imports and
  the stored column mapping's round trip), 32 browser tests against a production build (adds
  `onboarding.spec`: SB-04 and SB-05 with screenshots and timings; `walkthrough.spec` and
  `public.spec` updated for quick add and the multi-file upload). The rendering hashes of the
  eight frozen releases are unchanged: the pilots have no empty section, so the renderer rule
  altered no recorded output and no re-record was needed. Three defects found and fixed on the
  way: "New article" could not create an article (the empty default attribution failed the
  schema; now the site is the default author); the event-time parser lived in a client
  component module and failed when the CSV and onboarding imports called it in a production
  build (moved to `src/lib/local-time.ts`); and the database client camel-cases the keys of
  stored json maps, so the CSV job's column mapping came back unusable at confirmation and
  the imported nothing (keys restored on read, `src/lib/snake-keys.ts`, with a unit test over
  every key and an integration test through a stored job). Walk-through after B2 (SB-06): 14
  screens, 30 fields, 20 actions, 4.1 s scripted, 0 empty-state notices; SB-04 4.4 s scripted
  from site creation to the published site checked; SB-05 twenty images in 3.7 s scripted.
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
overview, a Look page and a settings index; editor controls following the policy. Phase B2 is
built: a section with nothing to show is left out of the public page (D-021), starter pages
whose slots fill themselves (category list, latest places, upcoming events, latest articles,
store finder, services) with the setup checklist naming the text still to write, the
onboarding package (Import & export: template download, dry run, one-transaction apply of
images, rows and the settings sheet), CSV imports for articles and services with body text
and featured images, multi-file upload with an alternative-text pass, quick add and duplicate
in the editor with category suggestions and site defaults, and imports approved on save under
the review policy. Phase B3 is built (D-022): the section vocabulary gained people, a logo
strip, image-and-text rows, a photo band, portraits on quotations, the hero treatments
offset, collage and statement, a gallery lightbox drawn by `:target` CSS, a click-to-load
map (D-013 extended: nothing from the provider before the visitor asks; Apple Maps stays a
link) and rich text divider, callout and button blocks, every one a typed section or an
enumerated option validated on save, on import and at publication and rendered by every
composition from `src/themes/shared/rich-sections.tsx`; the almanac (`src/themes/almanac`:
navigation rail, numbered sections, fact sheets) and practice (`src/themes/practice`: slim
header with the phone number, soft panels, numbered services, hours table) compositions;
both pilots re-composed with the new sections (`src/server/demo/fixtures`, with portrait and
mark scenes in `src/server/demo/images.ts`); snapshot schema version 5, the eight earlier
frozen releases unchanged, version-5 fixtures of the pilots on the new compositions added;
`scripts/set-demo-theme.ts` for the per-composition evidence passes. B2 and B3 reached
`main` on 2026-09-26 when the owner merged pull request #11 (`4c69036`, 22:18 UTC; the B2
migration was already applied, see below; B3 has none), and B4 (the proof) followed in pull
request #12 (`89a2f7b`, 23:37 UTC); the live checks on production after those deployments are
still to be run.

Phase B5 is on production (2026-09-27, D-024; pull request #14 merged by the owner as
`a601e6c` and deployed at 02:00 UTC, the two migrations applied at 02:02 UTC, evidence in
`docs/evidence/production/b5-2026-09-27-live-checks.txt`), from the owner's review of B4: documents
in Media (`src/server/media/ingest.ts` ingests PDFs by signature and trailer into
`media_assets` rows of kind `document`, migration `20260927000100_media_documents.sql`;
`src/server/media/content-types.ts` names and serves the public copies; `document:<id>` link
targets in rich text, buttons and section links; `attachments` on every item and the
`downloads` page section rendered by `src/themes/shared/documents.tsx` under all six
compositions; the manifest, the validator, the site package and the onboarding package carry
documents), links to other websites as a content kind (`src/modules/link.ts`, migration
`20260927000200_content_kind_link.sql`; `src/themes/shared/links.tsx` renders the cards, the
`/links` index and the link's own page; the index route exists only once a link is published;
quick add asks for the address; links import from a sheet), and the onboarding workbook
(`src/server/import/xlsx.ts`, `src/server/import/workbook.ts`; the template is `content.xlsx`;
a workbook uploads on its own or inside the package; `src/server/demo/proof/package.ts` writes
the proof packages with it). Snapshot schema version 6 (`SnapshotMedia.kind` and `mime`, the
`file` variant); version-6 fixtures of both pilots added with their sample links and
documents, the ten earlier fixtures' hashes unchanged. Tests at three levels (`documents`,
`links`, `xlsx` and `workbook`); screenshots `docs/evidence/dashboard/b5-*.png`.

Phase B6 (removing a site or an organization, D-025) is built on the branch on 2026-09-27:
`supabase/migrations/20260927000300_removal.sql` (`delete_site`, `delete_organization`,
`record_removal_leftovers`; organizations gain `status = 'deleted'`, `deleted_at`,
`deleted_by`), `src/server/data/removal.ts` (rows first, then the asset folders and the public
copies no other site's release carries, leftovers to the audit trail), the actions and forms
(`src/server/actions/removal.ts`, `src/components/admin/removal-forms.tsx`), the Settings card,
the organization removal page (`/app/organizations/<id>/remove`) and the organizations page's
notice and "Removed:" line; `deletePublic` on both storage adapters. Tests: unit
`hosted-adapters.test`, integration `removal.test`, e2e `removal.spec`; screenshots
`docs/evidence/dashboard/b6-*.png`.

The same day the owner judged the platform against the bar (SB-09 not met; their words in
`docs/ACCEPTANCE.md`) and decided B7, uploaded sites, with the agent (`docs/SITE-BUILDING-PLAN.md`
section 3).

Phase B7 (uploaded sites, D-026) is built on the branch on 2026-09-27:
`supabase/migrations/20260927000400_uploaded_sites.sql` (the `site_type` enum and column,
`create_site` with a site type, `publish_uploaded_release`, `get_host_site_type`, `delete_site`
taking an uploaded release's files into account), `src/server/uploaded/archive.ts` (the ZIP
inspection: served types, safe paths, a single top-level folder dropped, `__MACOSX` and
droppings skipped, limits, the manifest and the path resolution), `src/server/uploaded/publish.ts`
(files to the public store under their content hash, then the one idempotent function),
`src/server/uploaded/serve.ts` (the file handler and the form endpoint behind the proxy's
routing header), `src/proxy.ts` (preview hostnames under `PREVIEW_DOMAIN` and customer
hostnames of uploaded sites rewritten to `/uploaded/<mode>/<target>/files/…` and `…/inquiry`,
the kind of site per hostname asked of `/api/public/site-type` and remembered a minute),
`src/server/inquiries/intake.ts` in form mode (a redirect to the site's `next` page with the
receipt, plain pages for refusals), the dashboard for the site kind (`create-site-form`, the
overview `uploaded-overview.tsx`, `upload/` with the check page, publish, releases and restore,
the layout guard on structured-only routes, the sidebar, Settings trimmed), the sample site
`src/server/demo/uploaded-sample.ts`. Tests: unit `uploaded.test` (inspection, refusals,
manifest, path resolution, headers, the proxy's rewrites), `site-nav.test`; integration
`uploaded.test` (publish and serve, the form into the inbox, restore, removal of the files);
e2e `uploaded.spec` (the whole path in the browser, UP-01 to UP-04); screenshots
`docs/evidence/dashboard/b7-*.png`. Found by the browser test: a route folder named `_lw` is
private to Next.js and never routed, so the form post fell to the file handler (405); the
handlers now live under `files/` and `inquiry/` and the proxy maps `/_lw/inquiry` to the
latter.

D2 and B1 reached production on 2026-09-26: the owner merged pull request #9 (D2, `d82bf6c`,
deployed 18:08 UTC) and pull request #10 (B1, `167c9d1`, deployed 20:31 UTC). The merges
came before their migrations: the migrations `20260926000300_design_delegation.sql`,
`20260926000400_review_policy.sql` and, ahead of its own code, `20260926000500_onboarding_package.sql`
were applied to the production project through the Management API at 20:32 UTC (3 applied,
9 already applied), as soon as the merges were seen; the B1 code ran about a minute without
its column, the D2 code about two hours without the delegation column and trigger (owners'
design changes worked; nothing wrote to the missing column). The live checks afterwards
(`docs/evidence/production/d2-b1-2026-09-26-live-checks.txt`) all pass. The session branch
was restarted from `main` (`167c9d1`) for the B2 work. For the next release the order is the
documented one: migration first, then the merge.

What D2 put on the branch: the theme registry and capability declarations (four
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

Phase B6 is on production (pull request #15, `4b0d99d`, merged by the owner at 03:33 UTC on
2026-09-27 and deployed at once; its migration had been applied at 02:52 UTC). Phase B7 is on
the branch `claude/lucid-darwin-cif2y6` as `d5125e9`, rebased onto that merge because the
pull request had merged six minutes before the B7 push; its migration
`20260927000400_uploaded_sites.sql` was applied to the production project at 03:38 UTC and
verified (the enum, the column with its default, the four functions with their grants, the
widened check), so the deployed B6 code runs against it unharmed and the B7 deployment will
find everything in place. The owner has already done the Vercel side (03:47 UTC): the wildcard
hostname `*.preview.lernerworksplatform.dev` on the project's production target, verified, and
`PREVIEW_DOMAIN=preview.lernerworksplatform.dev` for production, redeployed (READY 03:49 UTC);
the wildcard reaches the project (the B6 code answers 404 on it, as it treats the hostname as
an unknown customer domain). What remains is the B7 pull request from the branch and its
merge (on the owner's go; none is open), then the live checks on the deployment: create an
uploaded site, upload the sample ZIP from its Upload page, publish, open
`https://<key>.preview.lernerworksplatform.dev/` (the page, `X-Robots-Tag: noindex`, a
`robots.txt` that disallows everything), send the sample's contact form and find the message
in Inbox, restore v1. B7 is done in the sense of the programme when one real client site is
live this way with its form delivering and the owner has used restore once; the step after
that, a hand-built page pulling in the platform's live pieces through markers, is decided when
a real site asks for it.

Site-building programme phase B5 (documents, links and the workbook, `docs/SITE-BUILDING-PLAN.md`
section 3) is on production: the owner merged pull request #14 (`a601e6c`) on 2026-09-27 and
Vercel had it READY at 02:00:03 UTC; the two migrations (`20260927000100_media_documents.sql`:
the `media_kind` type, `media_assets.kind`, dimensions nullable with a check by kind;
`20260927000200_content_kind_link.sql`: the `link` value of `content_kind`) were applied
through the Management API at 02:02:26 UTC, as soon as the merge was seen, and verified
afterwards (column, constraint and enum value present; 2 applied, 12 already applied). The
dashboard therefore ran about two minutes on the B5 code without its column and kind: any
dashboard page opened in that window that reads media or the content kinds failed with the
"Something went wrong" page (the public pages read release snapshots and were unaffected);
the owner reported one such page with reference code 3780686530 right after the merge. The
public live checks pass (`docs/evidence/production/b5-2026-09-27-live-checks.txt`: a
version-1 release renders, `/links` answers 404 on a site with no published link, sign-in and
`/healthz` 200). Still the owner's on the live dashboard, needing their session: the
onboarding template downloads as `content.xlsx`; a PDF uploads to Media and, attached and
published, opens from the public page; a link added from the Links list is at `/links` after
publishing; a workbook uploaded on its own dry-runs; and the B2, B3 and B4 live checks still
to be run (a package of more than 10 MB uploads whole, the proxy's body limit being 64 MB
now). What remains the owner's from B4: (4) their own timed
build of a client site on production with the packages (`pnpm proof:package --site cedar-bend`
and `--site bookcliff`, now carrying `content.xlsx`; each imported on a fresh site of its
preset through Import & export, then Look → composition, the home page composed as wanted,
Publish now; the steps and the counts of the scripted build are in
`docs/evidence/proof/README.md` and `latest.json`), the time recorded in the SB-08 row of
`docs/ACCEPTANCE.md`; (5) their judgement of the captures in `docs/evidence/proof/` and of the
sites on production against the bar: would they choose the platform over building the site by
hand, and does the result look launch-ready rather than templated? On the production test
site the B3 additions are there to look at:
Look → Theme lists the third composition (almanac or practice) with the preview beside it,
the page editor's Add section offers People, Logo strip, Image and text rows and Photo band,
the image hero's style list the Collage, Offset and Statement treatments, a gallery its
lightbox switch, a quotation its portrait, the map section its "Offer the map" switch with
coordinates, and the body editor's formatting help the `---`, `!note` and `!button` lines; and
the B2 controls: Import & export → the onboarding package, Media → a multi-file upload and its
alternative-text pass, a content list's quick add and the editor's Duplicate, the overview's
checklist naming the home introduction and the About page. Open points: the default of the
review policy for organizations with editors; further video providers; whether D3 happens at
all (after the site-building programme, D-017).

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
| Demonstration fixtures: 12 places/6 events/3 articles/3 links, 3 stores/4 services/2 links, pages, images, two documents each, draft + pending review + two releases + fixture inquiry | seed + "Load demo content" | yes (normal services) | owner-only, demo sites only | e2e public specs | — |
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
| Documents in Media (PDF upload, downloads under items and in a page section, links from text and buttons, served from the release) | yes | `media_assets.kind`, private original + public `<sha256>.pdf` | RLS + publication validator | unit and integration `documents.test`, e2e `documents.spec` (SB-10) | — |
| Links to other websites (content kind, cards that open the other site, `/links` index once published, own page) | yes | content items of kind `link` | RLS + module switch | unit and integration `links.test`, e2e `links.spec` (SB-11) | — |
| Onboarding workbook (`content.xlsx` template, uploaded alone or in the package, converted to the sheets before the dry run) | yes | import jobs + one transaction | editor+ (settings sheet: owner) | unit `xlsx.test`, `onboarding.test`, `proof.test`; integration `workbook.test`; e2e `workbook.spec` (SB-12) | — |
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
