# Launch checklist

The hosted launch runbook: what the owner must create and approve, what to configure, and
how to prove each step before customers use it. The code, migrations, scripts and checks
referenced here exist in this repository and are verified locally; the hosted providers
themselves are exercised for the first time when this checklist is executed
(`docs/RELEASE-REPORT.md` §5 lists exactly what is unverified until then).

Order: staging first, with staging data only; production only after staging passes the
smoke tests; customer domains one site at a time.

## 0. Decisions and accounts (owner)

- [ ] Confirm plan eligibility and prices and record the approved choices (no free-tier
      assumption is made anywhere in this repository):
  - Vercel: commercial use, custom domain limits, function duration, **cron frequency**
    (Hobby plans run crons at most daily, which is too slow for inquiry notifications; a
    Pro plan or an external scheduler calling the job endpoints is required).
  - Supabase: database size, storage egress, auth email limits, backups (point-in-time
    recovery is a paid add-on), pooler connections.
  - Transactional email (Resend): monthly volume, sending domain.
- [ ] Create separate **staging** and **production** Supabase projects and Vercel projects.
      Never point staging at production data.
- [ ] Choose the dashboard hostname (`APP_HOST`, for example `app.example`) and the sending
      address (`NOTIFY_FROM_ADDRESS`) on a domain the agency controls. Existing Lerner Works
      properties, Inside the Towns and AragoCor are never touched by this launch.

## 1. Supabase project (per environment)

1. Apply the migrations. Either with the Supabase CLI (`supabase link --project-ref <ref>`
   then `supabase db push`, which applies `supabase/migrations/*.sql`; **never** apply
   `supabase/local/`, the local-only auth shim) or, without the CLI, through the Management
   API with a personal access token:
   `SUPABASE_ACCESS_TOKEN=... pnpm db:migrate --project-ref <ref>`.
2. Create the `lw_app` connecting role (no table privileges):
   `LW_APP_PASSWORD=$(openssl rand -hex 24) SUPABASE_ACCESS_TOKEN=... pnpm hosted:roles --project-ref <ref>`
   (or run `supabase/hosted/0001_application_roles.sql` in the SQL editor with the password
   placeholder replaced). Keep the password for `DATABASE_URL`. The script can run before or
   after the migrations; run it again after any migration that adds session functions.
3. Authentication → Settings: **disable new user sign-ups** (onboarding is invitation-only);
   set Site URL to `APP_URL`; add `APP_URL/auth/recovery` to the redirect allow-list; keep
   email confirmation on. Without the dashboard, the same settings go through the Management
   API: `SUPABASE_ACCESS_TOKEN=... pnpm hosted:auth --project-ref <ref> --site-url <APP_URL>
   --redirect <APP_URL>/auth/recovery --disable-signups`. Configure the auth email sender:
   the default Supabase mailer sends a few messages an hour and is for testing only. For
   Resend, create a sending-only API key restricted to the sending domain and run
   `AUTH_SMTP_RESEND_API_KEY=... SUPABASE_ACCESS_TOKEN=... pnpm hosted:auth --project-ref <ref>
   --smtp-resend --sender <NOTIFY_FROM_ADDRESS> --sender-name "<name>"` (Resend's relay
   `smtp.resend.com:465`, user `resend`; the command reads the settings back and verifies
   them without printing the key; `--show` prints the current settings, `--dry-run` the
   change set). Customise the "Reset password" template if wanted (the link uses
   `{{ .ConfirmationURL }}`).
4. Storage: create bucket `private` (private) and bucket `public-assets` (public). Do not
   add public bucket policies beyond the defaults; the platform writes with the service key.
5. Copy the connection strings (pooler, transaction or session mode) for `lw_app` and for
   `postgres`, the anon key and the service role key into the environment (step 3 below).

## 2. Email and domain providers

- [ ] Resend: add and verify the sending domain of `NOTIFY_FROM_ADDRESS`; create one
      sending-only API key per environment, restricted to that domain (the smoke suite's
      `SMOKE_RESEND_API_KEY` needs a full-access key to read messages back; keep it out of
      the deployed environment).
- [ ] Vercel: create an API token scoped to the team; note the project id and team id. With
      these set, the dashboard registers customer hostnames on the project and shows the
      provider's own verification and DNS records (nothing is inferred locally).

## 3. Vercel project environment variables

From `.env.example`; required outside local (the application refuses to start otherwise):

| Variable | Value |
|---|---|
| `APP_ENV` | `staging` or `production` |
| `APP_URL` | `https://<dashboard host>` |
| `APP_HOST` | `<dashboard host>` (the vercel.app host can be used for staging before DNS exists) |
| `DATABASE_URL` | pooler string for `lw_app` |
| `DATABASE_ADMIN_URL` | pooler string for `postgres` (session mode) |
| `SESSION_SECRET` | 32+ random characters |
| `AUTH_PROVIDER` | `supabase` |
| `STORAGE_PROVIDER` | `supabase` |
| `NOTIFY_PROVIDER` | `resend` |
| `NOTIFY_RESEND_API_KEY`, `NOTIFY_FROM_ADDRESS` | from Resend |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `SUPABASE_STORAGE_PRIVATE_BUCKET`, `SUPABASE_STORAGE_PUBLIC_BUCKET` | `private`, `public-assets` |
| `CRON_SECRET` (or `JOB_TRIGGER_SECRET`) | 32+ random characters; Vercel Cron sends it as a bearer token |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | for domain registration and verification |
| `PREVIEW_DOMAIN` (optional) | `preview.<platform domain>`, for example `preview.lernerworksplatform.dev`; an uploaded site's preview answers on `https://<site key>.<PREVIEW_DOMAIN>/` and needs the wildcard hostname `*.<PREVIEW_DOMAIN>` added to the Vercel project (section 7). Unset, uploaded sites have no preview and serve only on their live domain |

`vercel.json` schedules `/api/jobs/deliver` every 5 minutes and `/api/jobs/retention`
daily. Build command `pnpm build`, install `pnpm install --frozen-lockfile`, Node 22.

## 4. Readiness check (before the first sign-in)

Run the hosted variables through the readiness report from a workstation (the file is not
committed):

```bash
pnpm launch:check --env-file .env.staging
```

It verifies configuration completeness, both database connections and their privileges
(application role has no table access; elevated role bypasses RLS), migrations, absence of
the local auth shim, RLS on every table, session-table exposure, absence of `.example`
demonstration accounts, live-site invariants, Supabase Auth reachability with sign-ups
disabled, the auth email sender (custom SMTP or the default mailer; with `--project-ref`),
both storage buckets and their visibility, the Resend sending domain status (read only; a
sending-only key reports WARN and the status is confirmed at Resend), the job secret and
cron schedule, the Vercel project, and that the job endpoint answers 401 on the production
deployment's generated URL (the cron target; a redirect or 404 there means Vercel Cron would
run and deliver nothing). Every item must be OK (WARN is
acceptable only where the report says so). It never prints secrets and sends no email.

## 5. First owner

```bash
BOOTSTRAP_PASSWORD='<temporary, 12+ characters>' pnpm bootstrap:owner --email owner@agency.example --organization "Agency name" --confirm-hosted
```

Run with the hosted variables exported. Creates the Supabase Auth account (confirmed) and
the organization with the owner membership, and records an audit event. The owner signs in,
then changes the password through "Forgot your password?" (email from Supabase Auth). Every
further person is invited from the dashboard (Access → Invite), which sends the invitation
through the notification queue.

## 6. Staging smoke tests (record the results in `docs/ACCEPTANCE.md`)

1. Sign in as the owner; create a site from a preset; upload an image; edit, review, build a
   candidate, preview, activate; the demo route serves it. Confirms Supabase Auth, Storage
   (private and public buckets) and the database.
2. Invite a second person; the invitation email arrives (Resend); accept; the new account
   can sign in; revoke access; the next request is denied.
3. Submit the public inquiry form; within the cron cadence the inbox shows "delivered" and
   the recipient receives the email. Confirms the job endpoint, the queue and Resend.
4. Trigger `/api/jobs/deliver` manually with the wrong secret (401) and the right one (200).
5. Forgot-password flow end to end (email, `/auth/recovery`, new password, sign-in).
6. Register a staging hostname you control in Settings → Domains, register it with the
   provider, add the records it shows, check verification, activate, go live; the hostname
   serves the site with canonical metadata and a sitemap; the demo route returns 404; return
   to demonstration mode; the hostname returns 404 again.
7. Take a database backup (Supabase dashboard) and confirm the storage buckets are included
   in the backup plan; note the restore procedure in `docs/OPERATIONS.md`.

`pnpm smoke` automates 1–6 against a deployed environment (`tests/smoke/staging.spec.ts`,
variables `SMOKE_BASE_URL`, `SMOKE_OWNER_EMAIL`, `SMOKE_OWNER_PASSWORD`, `SMOKE_JOB_SECRET`,
optional `SMOKE_INVITEE_EMAIL`, `SMOKE_HOSTNAME`, `SMOKE_RESEND_API_KEY`, `SMOKE_SITE_ID` /
`SMOKE_SITE_KEY` to reuse a site). Every message it sends goes to the owner's own mailbox;
the invitee must be a mailbox the owner controls. Screenshots land in `docs/evidence/staging/`.
Behind a TLS-inspecting proxy, import the proxy's authority into the browser NSS store
rather than ignoring certificate errors.

Only after all seven pass can the release be labelled **hosted staging verified**.

## 7. Production

- [x] Repeat sections 1–3 on the production project with production secrets. State on
      2026-09-26: Supabase project `lerner-works-platform-production` (`fvpooyxkuvltjzjbevxf`,
      us-east-1, free tier in the slot of the paused staging project) has the 7 migrations,
      the `lw_app` role, Auth with sign-ups disabled, the site URL and recovery redirect, and
      Resend SMTP, and both buckets; Vercel project `lerner-works-platform` has
      `app.lernerworksplatform.dev` attached, Node 22.x, and every variable of section 3 for
      the production target. Not linked to the repository and not deployed until the owner's
      explicit go-ahead; with the link in place every push to `main` deploys to production.
- [x] `pnpm launch:check --env-file … --project-ref fvpooyxkuvltjzjbevxf` on 2026-09-26: 23
      rows OK, one WARN (sending-only Resend key; domain status confirmed at Resend), no
      `.example` accounts — `docs/evidence/production/launch-check-2026-09-26.txt`.
- [x] Deploy the same commit that passed staging. Vercel keeps previous deployments for an
      application rollback; content rollback is a release restore in the dashboard. Done on
      2026-09-26: repository linked with production branch `main`, deployment
      `dpl_BuGsbLzt4HCw1VxD9E446wZRkpgz` of `7f4caf7` READY at
      `https://app.lernerworksplatform.dev`; `/healthz` reports the database reachable,
      `/app` and `/` redirect to sign-in, `/api/jobs/deliver` answers 401 without and with a
      wrong secret, both crons enabled, the domain workflow proven on the production project
      with a throwaway hostname; first owner and organization "Lerner Works" created with
      `pnpm bootstrap:owner --project-ref … --confirm-hosted` (password discarded; the owner
      sets one through "Forgot your password?").
- [x] Uploaded sites (B7): set `PREVIEW_DOMAIN` (for example `preview.lernerworksplatform.dev`)
      on the production target and add the wildcard hostname `*.<PREVIEW_DOMAIN>` to the Vercel
      project (the zone is Vercel-managed, so the record is created with it); redeploy. Done by
      the owner on 2026-09-27 at 03:47 UTC: `*.preview.lernerworksplatform.dev` on the
      production target, verified; `PREVIEW_DOMAIN` for production only; redeployed (READY
      03:49 UTC). Needs the owner's go, like every change to the platform's own domain.
- [ ] After the B7 code is deployed: open `https://<site key>.<PREVIEW_DOMAIN>/` of a
      published uploaded site and confirm the page, the `X-Robots-Tag: noindex, nofollow`
      header and a `robots.txt` that disallows everything. Until then uploaded sites have no
      preview and serve only on their live domain.
- [ ] Create the customer organization and site; load **approved real content** (never the
      demonstration seed); publish; add the customer's hostname; complete verification with the
      customer's DNS provider; activate; go live. One pilot at a time.
- [ ] Confirm inquiry recipients on the site's Settings and send a real test inquiry.
- [ ] Record the launch in `docs/RELEASE-REPORT.md` with the date, commit and the live URL.

## 8. Headers the platform relies on

Host routing consults only the `Host` header; Vercel forwards the requested customer
hostname as `Host` for every domain attached to the project. `X-Forwarded-Host` is ignored.
The dashboard is served only on `APP_HOST`; a hostname under `PREVIEW_DOMAIN` is the preview
of an uploaded site (`<site key>.<PREVIEW_DOMAIN>`); every other hostname is resolved through
the verified domain registry, as an uploaded site's files or a structured site's pages, or
answered with a neutral 404. Three paths are exempt and answer on every hostname: `/healthz`,
the job endpoints under `/api/jobs/`, because Vercel Cron calls them on the deployment's
generated `*.vercel.app` URL, not on `APP_HOST`, and the public lookup under `/api/public/`
(`site-type?host=`), which the proxy itself calls to learn which kind of site a customer
hostname serves. For the same reason Deployment Protection must leave production deployment
URLs open ("Only Preview Deployments"): under Standard Protection the cron request is answered
with a sign-in redirect, which cron jobs do not follow, and nothing is logged.

## 9. What remains outside this repository

Account creation, plan selection, secrets, DNS changes and the deployment itself require the
owner's access and approval. Nothing here performs them, and nothing is reported as done
until the corresponding smoke test has been run.
