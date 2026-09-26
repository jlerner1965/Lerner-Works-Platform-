/**
 * Starts the application against the isolated test database for browser tests. The test
 * database is reset and seeded by tests/e2e/global-setup.ts before this server is used.
 *
 * By default the suite runs against a production build written to `.next-e2e` (built here,
 * then served with `next start`), so the route table is fixed for the whole run. Set
 * E2E_USE_BUILD=0 to use `next dev` instead while iterating on a single spec; the Turbopack
 * dev server compiles routes on demand and has intermittently answered 404 for a nested
 * dynamic route that was first requested while another route was still compiling.
 */
import { spawn, spawnSync } from "node:child_process";
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
const useBuild = process.env.E2E_USE_BUILD !== "0";
if (useBuild) {
  console.log("e2e: building the application into .next-e2e (set E2E_USE_BUILD=0 to use next dev)");
  const build = spawnSync("pnpm", ["exec", "next", "build"], { stdio: "inherit", env });
  if (build.status !== 0) {
    console.error("e2e: production build failed");
    process.exit(build.status ?? 1);
  }
}
const child = spawn("pnpm", ["exec", "next", useBuild ? "start" : "dev", "--port", port], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
