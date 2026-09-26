/**
 * Creates (or re-keys) the application's connecting role on a hosted Supabase project through
 * the Management API, using supabase/hosted/0001_application_roles.sql. The password is read
 * from LW_APP_PASSWORD (generate one with `openssl rand -hex 24`) and never printed.
 *
 *   LW_APP_PASSWORD=... SUPABASE_ACCESS_TOKEN=... pnpm hosted:roles --project-ref <ref>
 */
import { loadEnv } from "./lib/env";
import { assertProjectRef, ensureApplicationRole, executeSql, managementToken } from "./lib/supabase-management";

loadEnv();

async function main(): Promise<void> {
  const ref = assertProjectRef(process.argv[process.argv.indexOf("--project-ref") + 1]);
  const password = process.env.LW_APP_PASSWORD ?? "";
  const token = managementToken();
  await ensureApplicationRole(ref, token, password);
  const rows = await executeSql<{ rolname: string; rolcanlogin: boolean; rolinherit: boolean; rolbypassrls: boolean }>(ref, token, "select rolname, rolcanlogin, rolinherit, rolbypassrls from pg_roles where rolname = 'lw_app'");
  const r = rows[0];
  if (!r || !r.rolcanlogin || r.rolinherit || r.rolbypassrls) throw new Error(`unexpected role state: ${JSON.stringify(rows)}`);
  console.log(`Role lw_app ensured on ${ref}: login, noinherit, no RLS bypass. Set DATABASE_URL to the pooler string with user lw_app.${ref} and this password.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
