/**
 * Hosted readiness report. Runs the configuration, database, identity, storage, notification,
 * scheduler and domain-provider checks that a staging or production environment must pass,
 * and prints OK / WARN / FAIL / SKIP per item without ever printing a secret. Exit code 1 when
 * any check fails. Use `--env-file <path>` to check a hosted environment's variables from a
 * local file that is not committed.
 *
 * It verifies what can be verified from here: credentials are exercised read-only (no email
 * is sent, no domain is changed). A passing report is a precondition for launch, not proof
 * of it; the smoke tests in docs/LAUNCH-CHECKLIST.md complete the picture.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";
import { loadEnv, projectRoot } from "./lib/env";
import { listMigrationFiles, migrationsDir } from "./lib/db-admin";

const envFileIndex = process.argv.indexOf("--env-file");
if (envFileIndex >= 0) {
  const file = process.argv[envFileIndex + 1];
  if (!file || !fs.existsSync(file)) {
    console.error("--env-file requires an existing file");
    process.exit(2);
  }
  dotenv.config({ path: path.resolve(file), override: true, quiet: true });
} else {
  loadEnv();
}

type Status = "OK" | "WARN" | "FAIL" | "SKIP";
const rows: Array<{ status: Status; item: string; detail: string }> = [];
const add = (status: Status, item: string, detail: string) => rows.push({ status, item, detail });
const hosted = (process.env.APP_ENV ?? "local") !== "local";
const need = (status: Status) => (hosted ? status : status === "FAIL" ? "WARN" : status);

async function main(): Promise<void> {
  const env = process.env.APP_ENV ?? "local";
  add("OK", "Environment", `APP_ENV=${env}${hosted ? "" : " (hosted checks are reported as warnings)"}`);

  const { getConfig } = await import("@/server/config");
  let cfg: ReturnType<typeof getConfig> | null = null;
  try {
    cfg = getConfig();
    add("OK", "Configuration", `valid for ${cfg.APP_ENV}: auth=${cfg.AUTH_PROVIDER}, storage=${cfg.STORAGE_PROVIDER}, notify=${cfg.NOTIFY_PROVIDER}`);
  } catch (err) {
    add("FAIL", "Configuration", err instanceof Error ? err.message : String(err));
  }
  const appUrl = process.env.APP_URL ?? "";
  add(appUrl.startsWith("https://") ? "OK" : need("FAIL"), "Application URL", appUrl.startsWith("https://") ? appUrl : `${appUrl || "unset"} (https required when hosted)`);
  const appHost = process.env.APP_HOST ?? "";
  add(/^(localhost|127\.0\.0\.1)/.test(appHost) ? need("FAIL") : "OK", "Application host", appHost || "unset");

  await databaseChecks();
  await appRoleChecks();
  await authChecks(cfg);
  await storageChecks(cfg);
  await notifyChecks(cfg);
  jobChecks(cfg);
  await domainProviderChecks(cfg);

  const width = Math.max(...rows.map((r) => r.item.length));
  let failed = false;
  console.log("\nLaunch readiness");
  for (const r of rows) {
    if (r.status === "FAIL") failed = true;
    console.log(`${r.status.padEnd(5)} ${r.item.padEnd(width)}  ${r.detail}`);
  }
  console.log(failed ? "\nNOT READY: fix the FAIL items above. See docs/LAUNCH-CHECKLIST.md." : hosted ? "\nREADY on these checks. Complete the smoke tests in docs/LAUNCH-CHECKLIST.md before announcing." : "\nLocal environment checked. Run with the hosted variables (--env-file) to assess a deployment.");
  process.exit(failed ? 1 : 0);
}

async function databaseChecks(): Promise<void> {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl || adminUrl.includes("CHANGE_ME")) {
    add(need("FAIL"), "Database (elevated)", "DATABASE_ADMIN_URL is not configured");
    return;
  }
  const sql = postgres(adminUrl, { max: 1, connect_timeout: 8, onnotice: () => {} });
  try {
    const v = (await sql<{ v: string }[]>`select version() as v`)[0]?.v ?? "connected";
    add("OK", "Database (elevated)", v.split(",")[0] ?? "connected");
    const bypass = (await sql<{ b: boolean }[]>`select rolbypassrls as b from pg_roles where rolname = current_user`)[0]?.b;
    add(bypass ? "OK" : "FAIL", "Elevated role", bypass ? "bypasses row-level security (required for worker and job endpoints)" : "does not bypass row-level security: worker and job endpoints would see no rows");
    const exists = await sql`select to_regclass('platform_meta.schema_migrations') as t`;
    if (!exists[0]?.t) {
      add("FAIL", "Migrations", "not applied");
    } else {
      const applied = new Set((await sql`select name from platform_meta.schema_migrations`).map((r) => r.name as string));
      const pending = listMigrationFiles(migrationsDir).filter((f) => !applied.has(f));
      add(pending.length ? "FAIL" : "OK", "Migrations", pending.length ? `${pending.length} pending: ${pending.join(", ")}` : `${applied.size} applied`);
    }
    const shim = (await sql<{ n: number }[]>`select count(*)::int as n from pg_namespace where nspname = 'local_auth'`)[0]?.n ?? 0;
    add(shim ? (hosted ? "FAIL" : "OK") : hosted ? "OK" : "WARN", "Local auth shim", shim ? (hosted ? "local_auth schema present on a hosted database: never apply supabase/local/ there" : "present (local development only)") : hosted ? "absent, as required" : "absent");
    const noRls = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`;
    add(noRls.length ? "FAIL" : "OK", "Row-level security", noRls.length ? `enabled on all but: ${noRls.map((r) => r.relname).join(", ")}` : "enabled on every public table");
    const exposed = await sql<{ grantee: string }[]>`
      select distinct grantee from information_schema.role_table_grants where table_schema = 'public' and table_name = 'app_sessions' and grantee in ('anon', 'authenticated')`;
    add(exposed.length ? "FAIL" : "OK", "Session table", exposed.length ? `granted to ${exposed.map((e) => e.grantee).join(", ")}` : "not reachable by anon/authenticated");
    const demo = (await sql<{ n: number }[]>`select count(*)::int as n from auth.users where email like '%.example'`)[0]?.n ?? 0;
    add(demo === 0 ? "OK" : process.env.APP_ENV === "production" ? "FAIL" : hosted ? "WARN" : "OK", "Demonstration accounts", demo === 0 ? "none" : `${demo} account(s) with .example addresses present${process.env.APP_ENV === "production" ? " (never in production)" : ""}`);
    const sites = await sql<{ id: string; key: string; mode: string; hasRelease: boolean; hasCanonical: boolean }[]>`
      select s.id, s.key, s.mode::text, s.active_release_id is not null as "hasRelease",
        exists (select 1 from public.domains d where d.site_id = s.id and d.is_canonical and d.status = 'active' and d.verified_at is not null) as "hasCanonical"
      from public.sites s where s.status = 'active' order by s.key`;
    const live = sites.filter((s) => s.mode === "live");
    const broken = live.filter((s) => !s.hasRelease || !s.hasCanonical);
    add(broken.length ? "FAIL" : "OK", "Sites", `${sites.length} active, ${live.length} live${broken.length ? `; live without release/canonical domain: ${broken.map((s) => s.key).join(", ")}` : ""}`);
    const domains = await sql<{ status: string; n: number }[]>`select status::text, count(*)::int as n from public.domains group by 1 order by 1`;
    add("OK", "Domains", domains.length ? domains.map((d) => `${d.n} ${d.status}`).join(", ") : "none registered");
  } catch (err) {
    add("FAIL", "Database (elevated)", err instanceof Error ? err.message : String(err));
  } finally {
    await sql.end();
  }
}

async function appRoleChecks(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("CHANGE_ME")) {
    add("FAIL", "Database (application)", "DATABASE_URL is not configured");
    return;
  }
  const sql = postgres(url, { max: 1, connect_timeout: 8, onnotice: () => {} });
  try {
    await sql`select 1`;
    add("OK", "Database (application)", "connected");
    let direct = false;
    try {
      await sql`select count(*) from public.sites`;
      direct = true;
    } catch {
      direct = false;
    }
    add(direct ? "FAIL" : "OK", "Application role", direct ? "can read tables directly (must have no table privileges)" : "has no direct table access");
    const canSwitch = await sql.begin(async (tx) => {
      await tx`select set_config('role', 'anon', true)`;
      await tx`select * from public.get_demo_release('__launch_check__')`;
      return true;
    }).catch(() => false);
    add(canSwitch ? "OK" : "FAIL", "Role switching", canSwitch ? "anon/authenticated switch works" : "cannot switch to anon (grant anon, authenticated to the application role)");
    const fn = (await sql<{ ok: boolean }[]>`select has_function_privilege(current_user, 'private.resolve_app_session(text)', 'execute') as ok`.catch(() => [{ ok: false }]))[0]?.ok;
    add(fn ? "OK" : need("FAIL"), "Session functions", fn ? "executable by the application role" : "not executable by the application role (run supabase/hosted/0001_application_roles.sql)");
  } catch (err) {
    add("FAIL", "Database (application)", err instanceof Error ? err.message : String(err));
  } finally {
    await sql.end();
  }
}

async function authChecks(cfg: { AUTH_PROVIDER: string; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string } | null): Promise<void> {
  const provider = cfg?.AUTH_PROVIDER ?? process.env.AUTH_PROVIDER ?? "local";
  if (provider !== "supabase") {
    add(need("FAIL"), "Identity provider", "local (development only)");
    return;
  }
  const url = cfg?.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = cfg?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    add("FAIL", "Identity provider", "SUPABASE_URL / SUPABASE_ANON_KEY missing");
    return;
  }
  const { GoTrueClient } = await import("@/server/auth/gotrue");
  const settings = await new GoTrueClient(url, anon, cfg?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY).settings();
  if (!settings.ok) {
    add("FAIL", "Identity provider", `Supabase Auth unreachable: ${settings.message}`);
    return;
  }
  add("OK", "Identity provider", "Supabase Auth reachable");
  add(settings.disableSignup === true ? "OK" : settings.disableSignup === false ? "FAIL" : "WARN", "Public sign-ups", settings.disableSignup === true ? "disabled (invite-only onboarding)" : settings.disableSignup === false ? "enabled: turn on 'Disable new user sign-ups' in Supabase Auth settings" : "unknown");
  add(cfg?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "FAIL", "Service role key", cfg?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY ? "present (server only)" : "missing (needed for invitations and storage)");
}

async function storageChecks(cfg: { STORAGE_PROVIDER: string; SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_STORAGE_PRIVATE_BUCKET: string; SUPABASE_STORAGE_PUBLIC_BUCKET: string } | null): Promise<void> {
  const provider = cfg?.STORAGE_PROVIDER ?? process.env.STORAGE_PROVIDER ?? "local";
  if (provider !== "supabase") {
    add(need("FAIL"), "Storage", "local disk (development only)");
    return;
  }
  const url = cfg?.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = cfg?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    add("FAIL", "Storage", "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    return;
  }
  const { SupabaseStorage } = await import("@/server/media/supabase-storage");
  const priv = cfg?.SUPABASE_STORAGE_PRIVATE_BUCKET ?? process.env.SUPABASE_STORAGE_PRIVATE_BUCKET ?? "private";
  const pub = cfg?.SUPABASE_STORAGE_PUBLIC_BUCKET ?? process.env.SUPABASE_STORAGE_PUBLIC_BUCKET ?? "public-assets";
  const storage = new SupabaseStorage(url, key, { private: priv, public: pub });
  try {
    const p = await storage.describeBucket(priv);
    add(p.exists && p.isPublic === false ? "OK" : "FAIL", "Private bucket", !p.exists ? `${priv} does not exist${p.message ? ` (${p.message})` : ""}` : p.isPublic ? `${priv} is public; it must be private` : `${priv} private`);
    const q = await storage.describeBucket(pub);
    add(q.exists && q.isPublic === true ? "OK" : "FAIL", "Public bucket", !q.exists ? `${pub} does not exist${q.message ? ` (${q.message})` : ""}` : q.isPublic ? `${pub} public` : `${pub} is private; published derivatives must be public`);
  } catch (err) {
    add("FAIL", "Storage", err instanceof Error ? err.message : String(err));
  }
}

async function notifyChecks(cfg: { NOTIFY_PROVIDER: string; NOTIFY_RESEND_API_KEY?: string; NOTIFY_FROM_ADDRESS: string } | null): Promise<void> {
  const provider = cfg?.NOTIFY_PROVIDER ?? process.env.NOTIFY_PROVIDER ?? "local-sink";
  if (provider !== "resend") {
    add(need("FAIL"), "Notifications", "local sink (no email is sent)");
    return;
  }
  const key = cfg?.NOTIFY_RESEND_API_KEY ?? process.env.NOTIFY_RESEND_API_KEY;
  const from = cfg?.NOTIFY_FROM_ADDRESS ?? process.env.NOTIFY_FROM_ADDRESS ?? "";
  if (!key) {
    add("FAIL", "Notifications", "NOTIFY_RESEND_API_KEY missing");
    return;
  }
  const fromDomain = from.split("@")[1]?.toLowerCase();
  if (fromDomain === "resend.dev") {
    add(process.env.APP_ENV === "production" ? "FAIL" : "WARN", "Notifications", `${from} is Resend's onboarding sender: it delivers only to the account owner's own address. Acceptable for staging smoke tests, never for production.`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      add("FAIL", "Notifications", `Resend responded ${res.status} to a read-only domain listing`);
      return;
    }
    const body = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    const match = (body.data ?? []).find((d) => d.name.toLowerCase() === fromDomain);
    add(match?.status === "verified" ? "OK" : "FAIL", "Notifications", match ? `Resend domain ${match.name} is ${match.status}` : `sending domain ${fromDomain ?? "(none)"} is not registered at Resend; NOTIFY_FROM_ADDRESS would be rejected`);
  } catch (err) {
    add("FAIL", "Notifications", `Resend unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function jobChecks(cfg: { jobTriggerSecret: string | undefined } | null): void {
  const secret = cfg?.jobTriggerSecret ?? process.env.JOB_TRIGGER_SECRET ?? process.env.CRON_SECRET;
  add(secret ? "OK" : need("FAIL"), "Scheduled jobs", secret ? "job secret configured for /api/jobs/deliver and /api/jobs/retention" : "JOB_TRIGGER_SECRET (or CRON_SECRET) missing: inquiries would never be sent");
  const vercelJson = path.join(projectRoot, "vercel.json");
  if (fs.existsSync(vercelJson)) {
    const crons = (JSON.parse(fs.readFileSync(vercelJson, "utf8")) as { crons?: Array<{ path: string; schedule: string }> }).crons ?? [];
    add("OK", "Cron schedule", crons.map((c) => `${c.path} (${c.schedule})`).join("; ") + " — plan limits decide the effective cadence");
  }
}

async function domainProviderChecks(cfg: { VERCEL_API_TOKEN?: string; VERCEL_PROJECT_ID?: string; VERCEL_TEAM_ID?: string } | null): Promise<void> {
  const token = cfg?.VERCEL_API_TOKEN ?? process.env.VERCEL_API_TOKEN;
  const project = cfg?.VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID;
  const team = cfg?.VERCEL_TEAM_ID ?? process.env.VERCEL_TEAM_ID;
  if (!token || !project) {
    add("WARN", "Domain provider", "not configured: customer domains cannot be registered or verified from the dashboard");
    return;
  }
  try {
    const u = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}`);
    if (team) u.searchParams.set("teamId", team);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      add("FAIL", "Domain provider", `Vercel responded ${res.status} for the project`);
      return;
    }
    const body = (await res.json()) as { name?: string };
    add("OK", "Domain provider", `Vercel project ${body.name ?? project} reachable`);
  } catch (err) {
    add("FAIL", "Domain provider", `Vercel unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
