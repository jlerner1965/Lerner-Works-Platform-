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

## Local auth provider

`AUTH_PROVIDER=local` stores bcrypt password hashes and opaque session tokens in the
`local_auth` schema created by `supabase/local/0000_auth_shim.sql`. The application refuses
this provider unless `APP_ENV=local` and the database host is local. It exists so the full
workflow can be verified without a container runtime; hosted deployments must use Supabase
Auth (`AUTH_PROVIDER=supabase`), which is not verified in this environment.

## Hosted deployment (not performed; requires owner accounts and approval)

1. Create separate staging and production Supabase projects; apply `supabase/migrations/`
   with the Supabase CLI (`supabase db push`). Do **not** apply `supabase/local/`.
2. Configure Supabase Auth (email provider, redirect URLs) and Storage buckets `private`
   and `public-assets`; set the storage provider to `supabase`.
3. Deploy the Next.js application (Vercel selected in the guide) with `APP_ENV=staging`,
   the database URLs (pooler connection string as `postgres`), `AUTH_PROVIDER=supabase`,
   `SUPABASE_*` keys (service role key server-side only), and a transactional email
   provider for `NOTIFY_PROVIDER`.
4. Run the notification worker through an authenticated scheduled endpoint or job service;
   verify scheduler limits before choosing a cadence.
5. Domain workflow: add the hostname in Settings → Domains, complete provider verification,
   then mark it active. Nothing in this repository infers DNS values or marks a domain
   verified because it was typed.
6. Check current plan eligibility and prices (Vercel, Supabase, email provider) and report
   them for approval. No free-tier promise is made.

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

- Content rollback: Publishing → Release history → Restore. Creates a new release from the
  historical snapshot; drafts and inquiries are untouched.
- Application rollback: redeploy the previous application build (hosting provider). Snapshot
  readers stay backward compatible with stored `schema_version` values.
