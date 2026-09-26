import fs from "node:fs";
import path from "node:path";
import { listMigrationFiles, migrationsDir } from "./db-admin";

/**
 * Supabase Management API access for hosted projects: runs SQL through the project's query
 * endpoint (HTTPS, personal access token) where a direct database connection is not
 * available, and applies the repository migrations with the same bookkeeping as the local
 * runner (platform_meta.schema_migrations). Never applies supabase/local/.
 */

const API = "https://api.supabase.com";

export function managementToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN (a Supabase personal access token) is required for --project-ref operations.");
  return token;
}

export function assertProjectRef(ref: string | undefined): string {
  if (!ref || !/^[a-z]{20}$/.test(ref)) throw new Error("--project-ref must be the 20-letter Supabase project reference.");
  return ref;
}

export async function executeSql<T = Record<string, unknown>>(ref: string, token: string, query: string): Promise<T[]> {
  const res = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const body = JSON.parse(text) as { message?: string; error?: string };
      message = body.message ?? body.error ?? text;
    } catch {
      /* plain text error */
    }
    throw new Error(`SQL request failed (${res.status}): ${message.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T[]) : [];
}

export interface HostedMigrateResult {
  applied: string[];
  skipped: string[];
}

/**
 * Applies pending migrations to a hosted project through the Management API, one file per
 * request inside an explicit transaction, recording each in platform_meta.schema_migrations.
 * Refuses targets without Supabase Auth (the local shim is never applied remotely).
 */
export async function runMigrationsViaManagementApi(ref: string, token: string, log: (line: string) => void = () => {}): Promise<HostedMigrateResult> {
  const hasAuth = (await executeSql<{ has_auth: boolean }>(ref, token, "select to_regprocedure('auth.uid()') is not null as has_auth"))[0]?.has_auth;
  if (!hasAuth) throw new Error("The target has no auth.uid(); it is not a Supabase project. The local auth shim is never applied remotely.");
  await executeSql(ref, token, "create schema if not exists platform_meta; create table if not exists platform_meta.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await executeSql<{ name: string }>(ref, token, "select name from platform_meta.schema_migrations")).map((r) => r.name));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const file of listMigrationFiles(migrationsDir)) {
    if (done.has(file)) {
      skipped.push(file);
      continue;
    }
    const body = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const safeName = file.replace(/'/g, "''");
    await executeSql(ref, token, `begin;\n${body}\ninsert into platform_meta.schema_migrations (name) values ('${safeName}');\ncommit;`);
    applied.push(file);
    log(`applied ${file}`);
  }
  return { applied, skipped };
}

/** Runs supabase/hosted/0001_application_roles.sql with a real password (never logged). */
export async function ensureApplicationRole(ref: string, token: string, password: string): Promise<void> {
  if (password.length < 24 || /['\\]/.test(password)) throw new Error("the application role password must be at least 24 characters without quotes or backslashes");
  const file = path.join(migrationsDir, "..", "hosted", "0001_application_roles.sql");
  const body = fs.readFileSync(file, "utf8").replace("REPLACE_WITH_A_LONG_RANDOM_PASSWORD", password);
  // Keep the password current on re-runs: the script only creates the role when missing.
  await executeSql(ref, token, `${body}\nalter role lw_app with password '${password}';`);
}
