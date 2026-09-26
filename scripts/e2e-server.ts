/**
 * Starts the application against the isolated test database for browser tests. The test
 * database is reset and seeded by tests/e2e/global-setup.ts before this server is used.
 */
import { spawn } from "node:child_process";
import { loadEnv } from "./lib/env";

loadEnv();
const port = process.env.E2E_PORT ?? "3100";
const env = {
  ...process.env,
  APP_ENV: "local",
  DATABASE_URL: process.env.DATABASE_TEST_URL,
  DATABASE_ADMIN_URL: process.env.DATABASE_TEST_ADMIN_URL,
  STORAGE_LOCAL_DIR: ".data/test-storage",
  NOTIFY_LOCAL_DIR: ".data/test-mail",
  APP_URL: `http://127.0.0.1:${port}`,
  APP_HOST: `127.0.0.1:${port}`,
  PORT: port,
  NEXT_DIST_DIR: ".next-e2e",
};
if (!env.DATABASE_URL || env.DATABASE_URL.includes("CHANGE_ME")) {
  console.error("DATABASE_TEST_URL is not configured; run pnpm db:start");
  process.exit(1);
}
const useBuild = process.env.E2E_USE_BUILD === "1";
const child = spawn("pnpm", ["exec", "next", useBuild ? "start" : "dev", "--port", port], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
