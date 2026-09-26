import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export const projectRoot = path.resolve(__dirname, "..", "..");

/** Loads .env (if present) into process.env without overriding existing variables. */
export function loadEnv(): void {
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("CHANGE_ME")) {
    throw new Error(`${name} is not configured. Run \`pnpm db:start\` or edit .env (see .env.example).`);
  }
  return value;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function parseDatabaseUrl(url: string): { host: string; database: string; user: string } {
  const u = new URL(url);
  return { host: u.hostname, database: u.pathname.replace(/^\//, ""), user: decodeURIComponent(u.username) };
}

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(parseDatabaseUrl(url).host);
  } catch {
    return false;
  }
}

/**
 * Guards destructive or seed operations: the database must be on this machine and its name
 * must carry an explicit non-production suffix. Never satisfied by a hosted Supabase URL.
 */
export function assertSafeLocalTarget(url: string, purpose: string): void {
  const { host, database } = parseDatabaseUrl(url);
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${purpose} refused: database host "${host}" is not local.`);
  }
  if (!/_(dev|test|e2e)$/.test(database)) {
    throw new Error(`${purpose} refused: database "${database}" must end in _dev, _test or _e2e.`);
  }
  if ((process.env.APP_ENV ?? "local") !== "local") {
    throw new Error(`${purpose} refused: APP_ENV must be "local" (is "${process.env.APP_ENV}").`);
  }
}

/** Redacts passwords in connection strings for logs. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid url>";
  }
}
