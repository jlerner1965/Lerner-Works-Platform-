import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Points the application modules at the isolated test database and local sinks. Imported
 * first by the global setup and by every integration test file (via setupFiles).
 */
export function applyTestEnv(): { adminUrl: string; appUrl: string } {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, quiet: true });
  const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
  const appUrl = process.env.DATABASE_TEST_URL;
  if (!adminUrl || !appUrl || adminUrl.includes("CHANGE_ME")) {
    throw new Error("DATABASE_TEST_URL / DATABASE_TEST_ADMIN_URL are not configured. Run `pnpm db:start`.");
  }
  if (!/_test$/.test(new URL(adminUrl).pathname)) throw new Error("Refusing: test database name must end in _test.");
  process.env.APP_ENV = "local";
  process.env.DATABASE_URL = appUrl;
  process.env.DATABASE_ADMIN_URL = adminUrl;
  process.env.STORAGE_LOCAL_DIR = ".data/test-storage";
  process.env.NOTIFY_LOCAL_DIR = ".data/test-mail";
  process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";
  process.env.APP_URL ??= "http://localhost:3100";
  process.env.APP_HOST ??= "localhost:3100";
  return { adminUrl, appUrl };
}

export const TEST_PASSWORD = "correct-horse-battery-staple-2026";
