/**
 * Starts local database services and prepares the local environment file.
 *
 * Preference order:
 *   1. Supabase CLI + a running container runtime (`supabase start`) when both are present.
 *   2. A locally installed PostgreSQL server (Ubuntu cluster or a reachable 127.0.0.1:5432).
 * The script never selects a remote/production target and never prints generated secrets.
 */
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, projectRoot } from "./lib/env";

loadEnv();

function has(cmd: string, args: string[] = ["--version"]): boolean {
  const r = spawnSync(cmd, args, { stdio: "ignore" });
  return r.status === 0;
}

function readEnvFile(file: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(file)) return map;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

function writeEnvFile(file: string, values: Map<string, string>): void {
  // Preserve the documented layout of .env.example, substituting values.
  const template = fs.readFileSync(path.join(projectRoot, ".env.example"), "utf8");
  const seen = new Set<string>();
  const lines = template.split("\n").map((raw) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(raw.trim());
    if (!m) return raw;
    seen.add(m[1]!);
    return `${m[1]}=${values.get(m[1]!) ?? m[2]}`;
  });
  for (const [k, v] of values) {
    if (!seen.has(k)) lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(file, lines.join("\n"), { mode: 0o600 });
}

function secret(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function main(): void {
  const envFile = path.join(projectRoot, ".env");
  const env = readEnvFile(envFile);
  const appEnv = env.get("APP_ENV") ?? "local";
  if (appEnv !== "local") {
    console.error(`db:start only manages local services (APP_ENV=${appEnv}). Nothing done.`);
    process.exit(1);
  }

  const hasSupabaseCli = has("supabase");
  const hasDocker = has("docker", ["info"]);
  const supabaseConfig = fs.existsSync(path.join(projectRoot, "supabase", "config.toml"));

  if (hasSupabaseCli && hasDocker && supabaseConfig) {
    console.log("Supabase CLI and a container runtime are available; starting the Supabase local stack.");
    const r = spawnSync("supabase", ["start"], { stdio: "inherit", cwd: projectRoot });
    if (r.status !== 0) {
      console.error("`supabase start` failed. See its output above.");
      process.exit(r.status ?? 1);
    }
    console.log("Supabase local stack started. Point DATABASE_URL/DATABASE_ADMIN_URL at the printed DB URL and run `pnpm db:migrate`.");
    return;
  }

  console.log("Container runtime/Supabase CLI not available; using the local PostgreSQL server.");
  if (!hasSupabaseCli) console.log("  - supabase CLI: not installed (optional for this mode)");
  if (!hasDocker) console.log("  - docker daemon: not reachable (optional for this mode)");

  const host = "127.0.0.1";
  const port = "5432";
  const ready = () => spawnSync("pg_isready", ["-h", host, "-p", port], { stdio: "ignore" }).status === 0;

  if (!ready()) {
    if (has("pg_lsclusters")) {
      const clusters = execFileSync("pg_lsclusters", ["--no-header"], { encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => l.trim().split(/\s+/));
      const first = clusters[0];
      if (first) {
        const [version, name] = first;
        console.log(`Starting PostgreSQL cluster ${version}/${name} ...`);
        const r = spawnSync("pg_ctlcluster", [version!, name!, "start"], { stdio: "inherit" });
        if (r.status !== 0) {
          console.error(`Could not start the cluster. Try: sudo pg_ctlcluster ${version} ${name} start`);
          process.exit(1);
        }
      }
    }
    if (!ready()) {
      console.error(
        "BLOCKER: no PostgreSQL server is reachable on 127.0.0.1:5432 and no local cluster could be started.\n" +
          "Install PostgreSQL 16 (or Docker + the Supabase CLI) and run `pnpm db:start` again.",
      );
      process.exit(1);
    }
  }
  console.log(`PostgreSQL is accepting connections on ${host}:${port}.`);

  // Credentials: generate once, keep in the ignored .env file.
  const adminPassword = extractPassword(env.get("DATABASE_ADMIN_URL")) ?? secret();
  const appPassword = extractPassword(env.get("DATABASE_URL")) ?? secret();
  const sessionSecret = env.get("SESSION_SECRET") && !env.get("SESSION_SECRET")!.includes("CHANGE_ME") ? env.get("SESSION_SECRET")! : secret(32);

  env.set("APP_ENV", "local");
  env.set("DATABASE_ADMIN_URL", `postgres://lw_admin:${encodeURIComponent(adminPassword)}@${host}:${port}/lernerworks_dev`);
  env.set("DATABASE_URL", `postgres://lw_app:${encodeURIComponent(appPassword)}@${host}:${port}/lernerworks_dev`);
  env.set("DATABASE_TEST_ADMIN_URL", `postgres://lw_admin:${encodeURIComponent(adminPassword)}@${host}:${port}/lernerworks_test`);
  env.set("DATABASE_TEST_URL", `postgres://lw_app:${encodeURIComponent(appPassword)}@${host}:${port}/lernerworks_test`);
  env.set("SESSION_SECRET", sessionSecret);

  const bootstrapSql = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'lw_admin') then
    create role lw_admin login createdb bypassrls password '${adminPassword}';
  else
    alter role lw_admin with login createdb bypassrls password '${adminPassword}';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'lw_app') then
    create role lw_app login noinherit password '${appPassword}';
  else
    alter role lw_app with login noinherit password '${appPassword}';
  end if;
end $$;
grant pg_signal_backend to lw_admin;
grant anon to lw_app with inherit false;
grant authenticated to lw_app with inherit false;
grant anon to lw_admin with inherit false;
grant authenticated to lw_admin with inherit false;
select format('create database %I owner lw_admin', d) from (values ('lernerworks_dev'), ('lernerworks_test')) as v(d)
  where not exists (select 1 from pg_database where datname = d) \\gexec
`;

  // The SQL (which contains generated passwords) is passed over stdin; nothing is written to disk.
  const attempts: Array<{ label: string; cmd: string; args: string[] }> = [];
  if (process.getuid && process.getuid() === 0) {
    attempts.push({ label: "su postgres", cmd: "su", args: ["postgres", "-c", "psql -v ON_ERROR_STOP=1 -q"] });
  }
  attempts.push({ label: "sudo -u postgres", cmd: "sudo", args: ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-q"] });
  attempts.push({ label: "psql (current user)", cmd: "psql", args: ["-v", "ON_ERROR_STOP=1", "-q", "-h", host, "-p", port, "-U", "postgres"] });

  let bootstrapped = false;
  const errors: string[] = [];
  for (const a of attempts) {
    const r = spawnSync(a.cmd, a.args, {
      input: bootstrapSql,
      stdio: ["pipe", "ignore", "pipe"],
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "" },
    });
    if (r.status === 0) {
      bootstrapped = true;
      console.log(`Roles and databases ensured (via ${a.label}).`);
      break;
    }
    errors.push(`${a.label}: ${(r.stderr || r.error?.message || `exit ${r.status}`).toString().trim().split("\n")[0]}`);
  }

  if (!bootstrapped) {
    console.error(
      "Could not run the role/database bootstrap as a PostgreSQL superuser automatically:\n" +
        errors.map((e) => `  - ${e}`).join("\n") +
        "\nRun it manually as a superuser, then re-run `pnpm db:start`:\n" +
        "  pnpm exec tsx scripts/db-start.ts --print-bootstrap | sudo -u postgres psql",
    );
    if (process.argv.includes("--print-bootstrap")) process.stdout.write(bootstrapSql);
    writeEnvFile(envFile, env);
    process.exit(1);
  }

  writeEnvFile(envFile, env);
  console.log(`Wrote ${path.relative(projectRoot, envFile)} (credentials are local-only and not printed).`);
  console.log("Next: pnpm db:migrate && pnpm seed:demo && pnpm dev");
}

function extractPassword(url: string | undefined): string | null {
  if (!url || url.includes("CHANGE_ME")) return null;
  try {
    const p = decodeURIComponent(new URL(url).password);
    return p || null;
  } catch {
    return null;
  }
}

main();
