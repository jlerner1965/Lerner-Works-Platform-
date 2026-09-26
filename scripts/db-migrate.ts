/**
 * Applies pending migrations to the local development database (or the test database with
 * --test). Never resets data. Uses the elevated admin connection from .env.
 */
import { loadEnv, redactUrl, requireEnv } from "./lib/env";
import { runMigrations } from "./lib/db-admin";

loadEnv();

async function main(): Promise<void> {
  const useTest = process.argv.includes("--test");
  const url = requireEnv(useTest ? "DATABASE_TEST_ADMIN_URL" : "DATABASE_ADMIN_URL");
  console.log(`Migrating ${redactUrl(url)}`);
  const result = await runMigrations(url, (line) => console.log(`  ${line}`));
  if (result.localShimApplied) console.log("  local auth shim: applied (plain PostgreSQL target)");
  console.log(`Applied ${result.applied.length} migration(s); ${result.skipped.length} already applied.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
