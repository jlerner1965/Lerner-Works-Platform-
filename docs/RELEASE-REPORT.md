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

The full matrix with per-row evidence is `docs/ACCEPTANCE.md`.

## 3. Performance (lab, local)

Lighthouse 13.5.0, mobile preset with simulated throttling (RTT 150 ms, 1.6 Mbps, 4× CPU),
three runs per page against the production build on this machine (full table and
conditions in `docs/evidence/LIGHTHOUSE.md`):

| Page | Median performance | Accessibility | CLS | Median LCP | Target LCP ≤ 2.5 s |
|---|---|---|---|---|---|
| Guide home `/demo/pine-hollow` | 96 | 100 | 0.026 | 2.69 s | missed by 0.19 s |
| Store detail `/demo/range-athletics/locations/longmont` | 99 | 100 | 0.01 | 1.97 s | met |

Performance ≥ 90 and CLS ≤ 0.1 are met on both pages. The guide home's LCP is bounded by the
simulated first-visit transfer (client runtime and two font files) rather than the hero
image; reducing it further means trimming client JavaScript on public pages. SEO scores of 66
are only the crawlability audit failing on purpose: demonstration routes are `noindex`.
Field Core Web Vitals cannot be claimed from these runs.

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

Release label: **hosted staging verified**, with these open items before "live pilot ready":

- The owner signed in to staging on 2026-09-26 (password set through a one-time token-hash
  link). The backup schedule is still the owner's check (physical backups enabled, no
  snapshot yet, point-in-time recovery off; the project is on the free tier).
- A separate **production** Supabase project. The Vercel project `lerner-works-platform`
  with `app.lernerworksplatform.dev` is prepared (Node 22.x, production-only variables, its
  own sending-only Resend key) but is not linked to the repository and has no deployment;
  it waits for the Supabase project, which the owner creates in the dashboard
  (`docs/LAUNCH-CHECKLIST.md` section 7). Staging holds test data.
- Supabase Auth SMTP through Resend (the session's safety check refused to write that
  secret; the default Supabase mailer is rate-limited and meant for testing).
- A long-lived Vercel API token in both project environments (the one on staging is the
  owner's 24-hour token; the API refused to create one from it).
- Real customer content, the customer's hostname and DNS, and the go-live decision.
- Plan costs for Vercel, Supabase and Resend remain the owner's to confirm; none is quoted here.

Credentials shared during setup: the Resend key was replaced by two sending-only keys (one
per environment) and deleted; the Vercel token expires within a day; the Supabase access
token is the owner's to revoke in the dashboard.

## 6. Known defects and limitations

- The Turbopack development server intermittently answered 404 for a nested dynamic route
  that was first requested while another route was still compiling. It affects `next dev`
  only; browser tests therefore run against a production build (`docs/DECISIONS.md` D-009).
  If it appears during manual use of `pnpm dev`, restart the dev server.
- Route handlers that redirect must use relative `Location` headers; one upload handler
  built an absolute URL from `request.url` and lost the session in production mode. Fixed in
  this release; other handlers were reviewed.
- The dashboard is functional and consistent but plain; the public themes are the polished
  surfaces. Editor forms are long on small screens (they scroll; nothing overflows).
- Search is a snapshot-backed text match, not a ranked index. Adequate for the pilot sizes.
- Only the latin subsets of the three typefaces are bundled.
- Sessions issued for the hosted provider are not revoked by a password change at the
  identity provider; an owner who suspects a compromised account should remove the
  membership (takes effect on the next request) and the person signs in again after
  recovery. `private.delete_user_sessions` exists for an operator to revoke all sessions.
- Local demonstration accounts and the local auth provider are refused outside
  `APP_ENV=local`; they must never be deployed.

## 7. How to operate the local release

- Restore a release: Publishing → Release history → open a release → review the difference
  → enter a reason → Restore. This creates a new release; nothing is rewritten.
- Export a site: Import / export → Download site package (ZIP with manifest and checksums).
  Import into another site with Upload and validate → Import package as drafts.
- Resume development: `docs/PROGRESS.md` (state, ledger, last results), `docs/DECISIONS.md`
  (D-001…D-009), `docs/OPERATIONS.md` (setup, resets, worker, backups), `pnpm verify`.
- Remaining setup for a hosted staging environment (requires the owner's accounts and
  approval): `docs/LAUNCH-CHECKLIST.md`, then `pnpm launch:check --env-file <file>` and
  `pnpm bootstrap:owner` for the first owner.

Local URLs only: `http://localhost:3000/app`, `http://localhost:3000/demo/pine-hollow`,
`http://localhost:3000/demo/range-athletics`. No public URL exists for this project.
