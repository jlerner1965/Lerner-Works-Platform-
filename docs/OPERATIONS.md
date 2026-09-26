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

## Backups and restore rehearsal

Site export (Settings → Export) is portability, not disaster recovery. Database backups:
`pg_dump` of the database (or the provider's backups); storage backups: copy of the
`.data/storage` tree (or the bucket). The restore rehearsal procedure and its result are
recorded in `docs/PROGRESS.md` once executed (OPS-02).

## Content rollback vs application rollback

- Content rollback: Publishing → Release history → Restore. Creates a new release from the
  historical snapshot; drafts and inquiries are untouched.
- Application rollback: redeploy the previous application build (hosting provider). Snapshot
  readers stay backward compatible with stored `schema_version` values.
