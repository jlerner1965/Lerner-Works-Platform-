/**
 * Creates the first agency owner and organization on an environment that has no members
 * yet (production onboarding is invite-only, so the very first owner cannot be invited).
 *
 *   BOOTSTRAP_PASSWORD='<at least 12 characters>' pnpm bootstrap:owner --email owner@agency.example --organization "Agency name" [--confirm-hosted] [--project-ref <ref>]
 *
 * With --project-ref (and SUPABASE_ACCESS_TOKEN) the database statements run through the
 * Supabase Management API instead of DATABASE_ADMIN_URL.
 *
 * Local: the account is created in the local auth shim. Hosted: the account is created in
 * Supabase Auth through the administrative API (confirmed, with the given password; the
 * owner should change it through "Forgot your password?" afterwards). Idempotent: an
 * existing account or organization is reused and the owner membership is ensured.
 * Refuses non-local targets without --confirm-hosted. Never prints the password.
 */
import postgres, { type Sql } from "postgres";
import { loadEnv, requireEnv, isLocalDatabaseUrl, redactUrl } from "./lib/env";
import { assertProjectRef, executeSql, managementToken } from "./lib/supabase-management";

loadEnv();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg("email")?.trim().toLowerCase();
  const orgName = arg("organization")?.trim();
  const password = process.env.BOOTSTRAP_PASSWORD ?? "";
  if (!email || !email.includes("@") || !orgName) {
    console.error("Usage: BOOTSTRAP_PASSWORD=... pnpm bootstrap:owner --email <email> --organization <name> [--confirm-hosted]");
    process.exit(2);
  }
  if (password.length < 12) {
    console.error("BOOTSTRAP_PASSWORD must be set (at least 12 characters).");
    process.exit(2);
  }
  const refIndex = process.argv.indexOf("--project-ref");
  const projectRef = refIndex >= 0 ? assertProjectRef(process.argv[refIndex + 1]) : null;
  const adminUrl = projectRef ? null : requireEnv("DATABASE_ADMIN_URL");
  if ((projectRef || !isLocalDatabaseUrl(adminUrl!)) && !process.argv.includes("--confirm-hosted")) {
    console.error(`Refusing to bootstrap on non-local target ${projectRef ?? redactUrl(adminUrl!)} without --confirm-hosted.`);
    process.exit(1);
  }
  const { getConfig } = await import("@/server/config");
  const cfg = getConfig();
  const admin = adminUrl ? postgres(adminUrl, { max: 1, onnotice: () => {} }) : managedSql(projectRef!, managementToken());
  try {
    let userId: string;
    if (cfg.AUTH_PROVIDER === "local") {
      userId = (await admin<{ id: string }[]>`select local_auth.upsert_user(${email}, ${password}) as id`)[0]!.id;
      console.log(`Local account ensured for ${email}.`);
    } else {
      const { GoTrueClient } = await import("@/server/auth/gotrue");
      const gotrue = new GoTrueClient(cfg.SUPABASE_URL!, cfg.SUPABASE_ANON_KEY!, cfg.SUPABASE_SERVICE_ROLE_KEY);
      const created = await gotrue.adminCreateUser(email, password);
      if (created.ok) {
        userId = created.user.id;
        console.log(`Supabase Auth account created for ${email}.`);
      } else if (created.reason === "exists") {
        const row = (await admin<{ id: string }[]>`select id from auth.users where lower(email) = ${email}`)[0];
        if (!row) throw new Error("the identity provider reports an existing account, but it is not visible in auth.users");
        userId = row.id;
        console.log(`Supabase Auth account already exists for ${email}; password unchanged.`);
      } else {
        throw new Error(`account creation failed: ${created.message}`);
      }
    }
    const existingOrg = (await admin<{ id: string }[]>`select id from public.organizations where name = ${orgName}`)[0];
    const org = existingOrg ?? (await admin<{ id: string }[]>`insert into public.organizations (name) values (${orgName}) returning id`)[0]!;
    const membership = await admin`insert into public.memberships (organization_id, user_id, organization_role, created_by)
      values (${org.id}, ${userId}, 'owner', ${userId})
      on conflict (organization_id, user_id) do update set organization_role = 'owner'
      where public.memberships.organization_role is distinct from 'owner'
      returning organization_id`;
    const changed = !existingOrg || membership.count > 0;
    if (changed) {
      await admin`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
        values (${org.id}, null, ${userId}, 'organization.bootstrapped', 'organization', ${org.id}, ${admin.json({ email, tool: "bootstrap-owner", organizationCreated: !existingOrg })})`;
    }
    console.log(`${email} is an owner of "${orgName}" (${org.id})${changed ? "" : " — nothing to change"}. Sign in at ${cfg.APP_URL}/sign-in.`);
  } finally {
    await admin.end();
  }
}

/**
 * A minimal tagged-template shim over the Management API SQL endpoint, so the same statements
 * run where no direct database connection exists. Parameters are inlined as quoted literals
 * (values here are ids, emails and names produced by this script).
 */
function managedSql(ref: string, token: string): Sql {
  const quote = (v: unknown): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "object" && v !== null && "__json" in (v as Record<string, unknown>)) return `'${JSON.stringify((v as { __json: unknown }).__json).replace(/'/g, "''")}'::jsonb`;
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  const fn = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? quote(values[i]) : ""), "");
    const rows = await executeSql(ref, token, text);
    return Object.assign(rows, { count: rows.length });
  };
  return Object.assign(fn, { json: (v: unknown) => ({ __json: v }), end: async () => {} }) as unknown as Sql;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
