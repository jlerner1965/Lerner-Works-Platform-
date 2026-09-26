/**
 * Drops and recreates a LOCAL database, then migrates it. Requires --yes and refuses any
 * target that is not a local *_dev/*_test/*_e2e database. This is never part of app startup.
 */
import { loadEnv, redactUrl, requireEnv, assertSafeLocalTarget } from "./lib/env";
import { resetDatabase } from "./lib/db-admin";

loadEnv();

async function main(): Promise<void> {
  const useTest = process.argv.includes("--test");
  const url = requireEnv(useTest ? "DATABASE_TEST_ADMIN_URL" : "DATABASE_ADMIN_URL");
  assertSafeLocalTarget(url, "Database reset");
  if (!process.argv.includes("--yes")) {
    console.error(`WARNING: this will DELETE ALL DATA in ${redactUrl(url)}.\nRe-run with --yes to confirm.`);
    process.exit(1);
  }
  await resetDatabase(url, (line) => console.log(`  ${line}`));
  console.log("Reset complete. Run `pnpm seed:demo` to load fixtures.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
