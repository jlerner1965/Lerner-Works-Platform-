import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { assertSafeLocalTarget, parseDatabaseUrl, projectRoot } from "./env";

export const migrationsDir = path.join(projectRoot, "supabase", "migrations");
export const localShimDir = path.join(projectRoot, "supabase", "local");

export function listMigrationFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
  localShimApplied: boolean;
}

/**
 * Applies pending migrations from supabase/migrations in filename order, each inside its own
 * transaction, recording them in platform_meta.schema_migrations. On a plain PostgreSQL
 * server (no auth.uid()), the local auth shim is applied first. Never resets data.
 */
export async function runMigrations(adminUrl: string, log: (line: string) => void = () => {}): Promise<MigrateResult> {
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  const applied: string[] = [];
  const skipped: string[] = [];
  let localShimApplied = false;
  try {
    await sql.unsafe(`create schema if not exists platform_meta`);
    await sql.unsafe(
      `create table if not exists platform_meta.schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
    );
    const done = new Set((await sql`select name from platform_meta.schema_migrations`).map((r) => r.name as string));

    const hasAuth = (await sql<{ has_auth: boolean }[]>`select to_regprocedure('auth.uid()') is not null as has_auth`)[0]?.has_auth ?? false;
    const shimDone = done.has("local/0000_auth_shim.sql");
    if (!hasAuth || shimDone) {
      for (const file of listMigrationFiles(localShimDir)) {
        const name = `local/${file}`;
        const body = fs.readFileSync(path.join(localShimDir, file), "utf8");
        // The shim is idempotent; re-apply it so function updates land without a reset.
        await sql.begin(async (tx) => {
          await tx.unsafe(body);
          await tx`insert into platform_meta.schema_migrations (name) values (${name}) on conflict (name) do nothing`;
        });
        localShimApplied = true;
        log(`applied ${name}`);
      }
    }

    for (const file of listMigrationFiles(migrationsDir)) {
      if (done.has(file)) {
        skipped.push(file);
        continue;
      }
      const body = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into platform_meta.schema_migrations (name) values (${file})`;
      });
      applied.push(file);
      log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
  return { applied, skipped, localShimApplied };
}

/**
 * Drops and recreates a local database, then migrates it. Refuses anything that is not a
 * local _dev/_test/_e2e database. Used by tests (isolated test database) and `pnpm db:reset`.
 */
export async function resetDatabase(adminUrl: string, log: (line: string) => void = () => {}): Promise<void> {
  assertSafeLocalTarget(adminUrl, "Database reset");
  const { database, user } = parseDatabaseUrl(adminUrl);
  const maintenanceUrl = new URL(adminUrl);
  maintenanceUrl.pathname = "/postgres";
  const sql = postgres(maintenanceUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${database}' and pid <> pg_backend_pid()`,
    );
    await sql.unsafe(`drop database if exists "${database}"`);
    await sql.unsafe(`create database "${database}" owner "${user}"`);
    log(`recreated database ${database}`);
  } finally {
    await sql.end();
  }
  await runMigrations(adminUrl, log);
}
