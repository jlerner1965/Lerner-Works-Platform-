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

Production is live. The Vercel project `lerner-works-platform` is linked to the repository
with `main` as production branch and serves `main` (commit `7f4caf7`, the commit staging's
smoke tests passed) at `https://app.lernerworksplatform.dev` against the Supabase project
`lerner-works-platform-production` (`fvpooyxkuvltjzjbevxf`, free tier, in the slot of the
paused and retired staging project). The first owner account (the owner's address,
organization "Lerner Works") exists; the owner sets a password through "Forgot your
password?" (Resend SMTP). No customer organization, site or hostname exists yet.

## Next action

Owner (signed in to production on 2026-09-26; test site published, invitation sent): finish
the production checks of `docs/LAUNCH-CHECKLIST.md` section 6: add your address as an
inquiry recipient on the test site (Settings → Contact), submit the public contact form at
`/demo/aragosan/contact` and confirm the inbox shows it delivered, and accept the pending
invitation from its email; decide the
backup routine (the free tier has no provider
backups: `pnpm backup:local` on a schedule from a workstation, or an accepted gap recorded
here); decide whether the paused staging project stays or is deleted; revoke the pasted
Supabase access token in the Supabase dashboard; confirm the sending domain status at
Resend; open or approve the pull request that brings this branch's documentation and
tooling into `main` (a push to `main` deploys to production; the branch changes docs and
scripts only). Then the customer work of section 7: organization and site with approved real
content, the customer's hostname and DNS, activation and go-live, one pilot at a time.

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
- Pending (owner): merge the routing fix into `main` (a pull request from this branch), then
  the cron delivers the pending test inquiry by itself; acceptance of the pending invitation;
  backup routine decision; keep or delete the paused staging project; revocation of the
  pasted Supabase token; sending domain status confirmed at Resend.

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
