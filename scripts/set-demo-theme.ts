/**
 * Switches a demonstration site's composition (`design.theme`) as the agency owner and
 * publishes the change through the ordinary configuration, candidate and activation
 * services. Used for the per-composition screenshot pass and the fixture export described
 * in docs/OPERATIONS.md; the same step done by hand is Look → Design → Theme, then Publish.
 *
 *   pnpm exec tsx scripts/set-demo-theme.ts --site pine-hollow --theme almanac
 *   pnpm exec tsx scripts/set-demo-theme.ts --site range-athletics --theme default
 *
 * Local only: refuses unless APP_ENV=local and the database is a local *_dev/_test/_e2e one.
 */
import crypto from "node:crypto";
import postgres from "postgres";
import type { ThemeKey } from "@/modules/site-config";
import { assertSafeLocalTarget, loadEnv, requireEnv } from "./lib/env";

loadEnv();

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main(): Promise<void> {
  const key = opt("site");
  const theme = opt("theme");
  if (!key || !theme) throw new Error("usage: set-demo-theme.ts --site <site key> --theme <theme key | default>");
  const adminUrl = requireEnv("DATABASE_ADMIN_URL");
  assertSafeLocalTarget(adminUrl, "Demo composition switch");
  const { themeKeys } = await import("@/modules/site-config");
  if (theme !== "default" && !(themeKeys as readonly string[]).includes(theme)) throw new Error(`unknown theme "${theme}"; one of default, ${themeKeys.join(", ")}`);
  const { withUser, endPool } = await import("@/server/data/db");
  const { loadSiteContext } = await import("@/server/data/access");
  const { getCurrentSiteConfig, saveSiteConfig } = await import("@/server/data/sites");
  const { buildCandidate } = await import("@/server/publishing/candidates");
  const { activateCandidate } = await import("@/server/publishing/activate");
  const { themeCompatibilityIssues } = await import("@/themes/capabilities");
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {}, transform: postgres.camel });
  try {
    const [owner] = await admin<{ id: string }[]>`select id from auth.users where email = 'owner@lernerworks.example'`;
    if (!owner) throw new Error("the demonstration owner account does not exist; run pnpm seed:demo first");
    const [site] = await admin<{ id: string; mode: string }[]>`select id, mode from public.sites where key = ${key}`;
    if (!site) throw new Error(`no site with key "${key}"`);
    if (site.mode !== "demo") throw new Error(`site "${key}" is not a demonstration site`);
    const ctx = await withUser(owner.id, (db) => loadSiteContext(db, site.id));
    if (!ctx) throw new Error("site not visible to the owner");
    const changed = await withUser(owner.id, async (db) => {
      const current = await getCurrentSiteConfig(db, site.id);
      if (!current) throw new Error("site has no configuration");
      if (current.config.design.theme === theme) return false;
      const next = structuredClone(current.config);
      next.design = { ...next.design, theme: theme as ThemeKey | "default" };
      const issues = themeCompatibilityIssues(ctx.site.preset, next.design);
      if (issues.length) throw new Error(issues.map((i) => i.message).join(" "));
      const saved = await saveSiteConfig(db, { siteId: site.id, organizationId: ctx.site.organizationId, baseRevisionId: current.id, config: next, authorId: owner.id, changeNote: `Composition switched to ${theme}` });
      if (!saved.ok) throw new Error("configuration changed concurrently");
      console.log(`${key}: configuration revision ${saved.revision.version} (theme ${theme})`);
      return true;
    });
    if (!changed) {
      console.log(`${key}: already on ${theme}; nothing to publish`);
      return;
    }
    const { candidate } = await buildCandidate(owner.id, ctx.site);
    if (candidate.state !== "ready") throw new Error(`candidate blocked: ${candidate.validation.blockers.map((b) => b.message).join(" | ")}`);
    const result = await activateCandidate(owner.id, candidate.id, crypto.randomUUID(), `Composition switched to ${theme}`);
    if (result.outcome !== "activated") throw new Error(`activation failed: ${JSON.stringify(result)}`);
    console.log(`${key}: published release ${result.releaseId.slice(0, 8)} with the ${theme} composition`);
  } finally {
    await admin.end();
    await endPool();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
