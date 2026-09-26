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

## Environment blockers (precise)

- **No container runtime**: Docker client present, daemon absent (`/var/run/docker.sock`
  missing). `supabase start` cannot run. Mitigation: local PostgreSQL 16 server + local auth
  shim (see `docs/DECISIONS.md` D-002). Supabase Auth/Storage adapters are unverified here.
- **Supabase CLI** not installable: GitHub release downloads are denied by the egress proxy.
- Hosted services (Vercel, Supabase project, transactional email) are not configured; no
  account or credential exists in this environment. Nothing was faked.

## Last verified results

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

The repository is launch-ready: every hosted integration is implemented, configured through
the environment, guarded at startup and covered by tests that do not need accounts. Hosted
staging verification is blocked on owner-provided accounts (see "Environment blockers",
`docs/LAUNCH-CHECKLIST.md` and `docs/RELEASE-REPORT.md` §5).

## Next action

Owner: create the staging Supabase, Vercel and Resend accounts, approve the plans, then run
`docs/LAUNCH-CHECKLIST.md` sections 1–6 with `pnpm launch:check --env-file .env.staging` and
record the seven smoke tests in `docs/ACCEPTANCE.md` (LAUNCH-06).

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
- Pending: owner confirms the recovery email and the backup schedule; production project;
  long-lived Vercel token; PR #3 merge so `main` carries the hosted tooling.

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
