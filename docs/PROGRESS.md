# Progress

Resume point for the build. Update after every milestone and before any context reset.

## Milestone state

| Milestone | State | Notes |
|---|---|---|
| M0 Foundation and setup | DONE (2026-09-25) | App runs, local PostgreSQL bootstrapped, 5 migrations + local auth shim applied, seeded accounts/orgs/sites, sign-in verified over HTTP, unauthorized site read returns 404 with no data. |
| M1 First complete publishing workflow | DONE (2026-09-26) | Edit → draft → approve → frozen candidate → preview → atomic activation → public demo route, verified by 28 unit, 21 integration and 2 browser tests. |
| M2 Complete editing and public experiences | DONE (2026-09-26) | All six content kinds editable and rendered; media pipeline with validation and derivatives; two fully populated fictional pilots with original generated artwork; search/filters; settings; site creation; responsive screenshots at 390/768/1440 with no overflow; 28 unit, 25 integration, 6 browser tests. |
| M3 Operational completion | DONE (2026-09-26) | Review queue, release restore, inquiry inbox + durable notification queue with worker, owner access management with local invitation flow, CSV import with dry run, portable site package export/import, audit log, retention job, backup + restore rehearsal. |
| M4 Verification and refinement | DONE (2026-09-26) | Acceptance matrix complete with evidence (38 PASS, 0 FAIL, 0 BLOCKED); ten-step demonstration automated with screenshots; browser suite moved to the production build; production build + secret inspection; Lighthouse lab runs; fresh-install rehearsal; release report in `docs/RELEASE-REPORT.md`. |

## Environment blockers (precise)

- **No container runtime**: Docker client present, daemon absent (`/var/run/docker.sock`
  missing). `supabase start` cannot run. Mitigation: local PostgreSQL 16 server + local auth
  shim (see `docs/DECISIONS.md` D-002). Supabase Auth/Storage adapters are unverified here.
- **Supabase CLI** not installable: GitHub release downloads are denied by the egress proxy.
- Hosted services (Vercel, Supabase project, transactional email) are not configured; no
  account or credential exists in this environment. Nothing was faked.

## Last verified results

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

All four milestones are done for the local release. Hosted staging remains blocked on
owner-provided accounts (see "Environment blockers" and `docs/RELEASE-REPORT.md` §5).

## Next action

With the owner: create the staging Supabase and Vercel projects and an email provider
account, then follow `docs/OPERATIONS.md` → "Hosted deployment" and verify the Supabase
Auth/Storage adapters and the email provider against staging before any customer data.

## Restore rehearsal (OPS-02) — 2026-09-26

`pnpm backup:local` produced `.data/backups/2026-09-26T01-10-47-599Z/` (pg_dump custom
format + storage tar). `pnpm restore:rehearsal` restored it into a new local database
`lernerworks_restore_test` with copied storage: 2 sites, 39 items, 4 releases, 26 media
assets, 2 inquiries restored; 78 of 78 derivatives present, 0 missing. Provider-dependent
parts before a hosted launch: managed database backups, bucket versioning, and the identity
provider's user store (local auth users are included in the dump; Supabase Auth users would
not be).

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

## Usage

Actual Claude Code usage is not visible from inside the session; the owner should read it
from their usage dashboard at each milestone. No estimate is recorded here.
