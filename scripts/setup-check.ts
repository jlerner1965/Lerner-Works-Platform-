/**
 * Reports local readiness without printing secrets: runtime versions, container runtime,
 * database reachability, migrations state, environment file completeness, and browsers.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadEnv, projectRoot, isLocalDatabaseUrl } from "./lib/env";
import { listMigrationFiles, migrationsDir } from "./lib/db-admin";

loadEnv();

type Status = "ok" | "warn" | "fail";
const rows: Array<{ status: Status; item: string; detail: string }> = [];
const add = (status: Status, item: string, detail: string) => rows.push({ status, item, detail });

function version(cmd: string, args = ["--version"]): string | null {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) return null;
  return (r.stdout || r.stderr).trim().split("\n")[0] ?? null;
}

async function main(): Promise<void> {
  const node = process.versions.node;
  add(Number(node.split(".")[0]) >= 22 ? "ok" : "fail", "Node.js", `v${node} (requires >= 22)`);
  const pnpm = version("pnpm");
  add(pnpm ? "ok" : "fail", "pnpm", pnpm ?? "not found (corepack enable; pnpm@10.33.0 pinned)");
  add(fs.existsSync(path.join(projectRoot, "node_modules", "next")) ? "ok" : "fail", "Dependencies", fs.existsSync(path.join(projectRoot, "node_modules", "next")) ? "installed" : "run pnpm install");

  const docker = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
  const supabase = version("supabase");
  add(docker ? "ok" : "warn", "Container runtime", docker ? "docker daemon reachable" : "not reachable (Supabase local stack unavailable; local PostgreSQL mode is used)");
  add(supabase ? "ok" : "warn", "Supabase CLI", supabase ?? "not installed (optional in local PostgreSQL mode)");
  const psql = version("psql");
  add(psql ? "ok" : "warn", "PostgreSQL client", psql ?? "psql not found");

  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) {
    add("fail", ".env", "missing — run pnpm db:start (copies .env.example and generates local credentials)");
  } else {
    const required = ["DATABASE_URL", "DATABASE_ADMIN_URL", "SESSION_SECRET", "APP_ENV"];
    const missing = required.filter((k) => !process.env[k] || process.env[k]!.includes("CHANGE_ME"));
    add(missing.length ? "fail" : "ok", ".env", missing.length ? `placeholders remain for ${missing.join(", ")}` : "required variables present (values not shown)");
    add(process.env.APP_ENV === "local" ? "ok" : "warn", "APP_ENV", process.env.APP_ENV ?? "unset");
    add(process.env.AUTH_PROVIDER === "local" ? "warn" : "ok", "Auth provider", process.env.AUTH_PROVIDER === "local" ? "local (development-only; hosted deployments use Supabase Auth)" : process.env.AUTH_PROVIDER ?? "unset");
    add("ok", "Storage provider", process.env.STORAGE_PROVIDER ?? "local");
    add("ok", "Notification provider", process.env.NOTIFY_PROVIDER === "local-sink" ? "local-sink (proves job processing only, not internet email)" : process.env.NOTIFY_PROVIDER ?? "unset");
  }

  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (adminUrl && !adminUrl.includes("CHANGE_ME")) {
    add(isLocalDatabaseUrl(adminUrl) ? "ok" : "warn", "Database target", isLocalDatabaseUrl(adminUrl) ? "local host" : "remote host (seeds and resets are refused)");
    const sql = postgres(adminUrl, { max: 1, connect_timeout: 5, onnotice: () => {} });
    try {
      const v = (await sql<{ v: string }[]>`select version() as v`)[0]?.v ?? "connected";
      add("ok", "Database connection", v.split(",")[0] ?? "connected");
      const exists = await sql`select to_regclass('platform_meta.schema_migrations') as t`;
      if (!exists[0]?.t) {
        add("fail", "Migrations", "not applied — run pnpm db:migrate");
      } else {
        const applied = new Set((await sql`select name from platform_meta.schema_migrations`).map((r) => r.name as string));
        const pending = listMigrationFiles(migrationsDir).filter((f) => !applied.has(f));
        add(pending.length ? "fail" : "ok", "Migrations", pending.length ? `${pending.length} pending — run pnpm db:migrate` : `${applied.size} applied`);
        const n = (await sql<{ n: number }[]>`select count(*)::int as n from public.sites`)[0]?.n ?? 0;
        add(n > 0 ? "ok" : "warn", "Seed data", n > 0 ? `${n} site(s) present` : "no sites — run pnpm seed:demo");
      }
    } catch (err) {
      add("fail", "Database connection", err instanceof Error ? err.message : String(err));
    } finally {
      await sql.end();
    }
  }

  const chromium = process.env.CHROMIUM_EXECUTABLE_PATH ?? process.env.PLAYWRIGHT_BROWSERS_PATH;
  add(chromium ? "ok" : "warn", "Browser for e2e", chromium ? `Playwright browsers path configured` : "PLAYWRIGHT_BROWSERS_PATH unset; run pnpm exec playwright install chromium if e2e tests fail");

  const width = Math.max(...rows.map((r) => r.item.length));
  let failed = false;
  for (const r of rows) {
    const mark = r.status === "ok" ? "OK  " : r.status === "warn" ? "WARN" : "FAIL";
    if (r.status === "fail") failed = true;
    console.log(`${mark}  ${r.item.padEnd(width)}  ${r.detail}`);
  }
  if (failed) {
    console.log("\nSome required checks failed. Fix the FAIL rows above before running the application.");
    process.exit(1);
  }
  console.log("\nReady. Next: pnpm dev (and pnpm worker:dev in a second terminal).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
