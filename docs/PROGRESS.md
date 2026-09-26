# Progress

Resume point for the build. Update after every milestone and before any context reset.

## Milestone state

| Milestone | State | Notes |
|---|---|---|
| M0 Foundation and setup | DONE (2026-09-25) | App runs, local PostgreSQL bootstrapped, 5 migrations + local auth shim applied, seeded accounts/orgs/sites, sign-in verified over HTTP, unauthorized site read returns 404 with no data. |
| M1 First complete publishing workflow | DONE (2026-09-26) | Edit → draft → approve → frozen candidate → preview → atomic activation → public demo route, verified by 28 unit, 21 integration and 2 browser tests. |
| M2 Complete editing and public experiences | IN PROGRESS | |
| M3 Operational completion | NOT STARTED | |
| M4 Verification and refinement | NOT STARTED | |

## Environment blockers (precise)

- **No container runtime**: Docker client present, daemon absent (`/var/run/docker.sock`
  missing). `supabase start` cannot run. Mitigation: local PostgreSQL 16 server + local auth
  shim (see `docs/DECISIONS.md` D-002). Supabase Auth/Storage adapters are unverified here.
- **Supabase CLI** not installable: GitHub release downloads are denied by the egress proxy.
- Hosted services (Vercel, Supabase project, transactional email) are not configured; no
  account or credential exists in this environment. Nothing was faked.

## Last verified results

- 2026-09-26 `pnpm test` 28 passed; `pnpm test:integration` 21 passed (isolation, publishing
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

M2: media upload pipeline and library, site settings, fixture content for both pilots with
original images, "Load demo content", responsive review of both themes.

## Next action

Implement `src/server/media/*` (validation, derivatives), the Media screen and Settings screen,
then the fixture generator and images.

## Feature ledger

Columns: working UI · persistent backend · permission checks · tests · external configuration.

| Feature | UI | Backend | Permissions | Tests | External |
|---|---|---|---|---|---|
| Sign in / sign out (local provider) | yes | yes (local_auth shim) | n/a | e2e AUTH-01 | Supabase Auth adapter unverified |
| Organization overview + site switcher | yes | yes | RLS | e2e | — |
| Site overview with real counts, setup checklist | yes | yes | RLS + capability nav | manual | — |
| Site creation from preset (UI + seed) | yes | yes (`create_site`) | owner-only function | manual | — |
| Content list (filters, search, pagination, bulk archive) | yes | yes | RLS | manual | — |
| Content editor, all six kinds, explicit save, conflicts | yes | yes | RLS | integration DATA-02, e2e | — |
| Draft preview and revision history | yes | yes | RLS | manual | — |
| Review submit / comment / request changes / approve | editor panel | immutable reviews | policy per state | e2e (approve) | — |
| Candidate build, findings, waivers, frozen preview | yes | yes | publisher-only | integration PUB-01..05, e2e | — |
| Atomic activation with CAS + idempotency | yes | SQL function | function checks | integration PUB-03/05 | — |
| Release history and restore | yes | SQL function | function checks | integration PUB-06 | — |
| Public demo rendering (both themes, pages) | yes | read function | anon grants | e2e, integration PUB-08 | — |
| Live host routing, sitemap, robots | code | read function | anon grants | unit (host normalization) | no verified domain exists |
| Public inquiry intake (form + endpoint) | yes | `submit_inquiry` | function + RLS | integration LEAD-01/03/04/05 | — |
| Inquiry inbox | no | tables | RLS | — | email provider unconfigured |
| Media upload / library | picker only | table + storage provider | RLS | — | Supabase Storage adapter unverified |
| Site settings screen | no | data layer | RLS | integration (config save) | — |
| Access management + invitations UI | no | SQL functions | owner-only | integration AUTH-05/07 | invitation email via local sink |
| Import/export | no | tables | RLS | — | — |
| Audit trail | events written | yes | RLS | — | — |
| Notification worker | no | tables | — | — | local sink |

## Usage

Actual Claude Code usage is not visible from inside the session; the owner should read it
from their usage dashboard at each milestone. No estimate is recorded here.
