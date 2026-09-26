/**
 * Applies pending migrations. Default: the local development database (or the test database
 * with --test) over the elevated admin connection from .env. With --project-ref <ref> and
 * SUPABASE_ACCESS_TOKEN, applies them to a hosted Supabase project through the Management
 * API instead (used where direct database ports are unreachable). Never resets data; never
 * applies the local auth shim to a hosted project.
 */
import { loadEnv, redactUrl, requireEnv } from "./lib/env";
import { runMigrations } from "./lib/db-admin";
import { assertProjectRef, managementToken, runMigrationsViaManagementApi } from "./lib/supabase-management";

loadEnv();

async function main(): Promise<void> {
  const refIndex = process.argv.indexOf("--project-ref");
  if (refIndex >= 0) {
    const ref = assertProjectRef(process.argv[refIndex + 1]);
    console.log(`Migrating hosted project ${ref} through the Supabase Management API`);
    const result = await runMigrationsViaManagementApi(ref, managementToken(), (line) => console.log(`  ${line}`));
    console.log(`Applied ${result.applied.length} migration(s); ${result.skipped.length} already applied.`);
    return;
  }
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
