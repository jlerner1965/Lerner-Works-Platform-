import fs from "node:fs";
import crypto from "node:crypto";
import postgres, { type Sql } from "postgres";
import { withUser, withAnon, endPool } from "@/server/data/db";
import { buildCandidate } from "@/server/publishing/candidates";
import { activateCandidate } from "@/server/publishing/activate";
import { loadSiteContext } from "@/server/data/access";

export interface SeedInfo {
  organizations: { pineHollow: string; rangeAthletics: string };
  sites: { pineHollow: string; rangeAthletics: string };
  users: Record<string, string>;
}

export function seedInfo(): SeedInfo {
  return JSON.parse(fs.readFileSync(".data/test-seed.json", "utf8")) as SeedInfo;
}

export function adminClient(): Sql {
  return postgres(process.env.DATABASE_TEST_ADMIN_URL!, { max: 1, onnotice: () => {}, transform: postgres.camel });
}

export { withUser, withAnon, endPool };

export function key(): string {
  return crypto.randomUUID();
}

/** Approves every working revision of a site as the given user (owner/publisher). */
export async function approveAll(userId: string, siteId: string): Promise<void> {
  await withUser(userId, async (db) => {
    const rows = await db<{ id: string; itemId: string; organizationId: string }[]>`
      select r.id, r.item_id, r.organization_id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
      where i.site_id = ${siteId} and i.archived_at is null`;
    for (const r of rows) {
      const latest = await db<{ state: string }[]>`select state::text from public.reviews where revision_id = ${r.id} order by created_at desc limit 1`;
      if (latest[0]?.state === "approved") continue;
      await db`insert into public.reviews (organization_id, site_id, item_id, revision_id, state, actor_id) values (${r.organizationId}, ${siteId}, ${r.itemId}, ${r.id}, 'approved', ${userId})`;
    }
  });
}

/** Builds and activates a candidate through the real services. Returns the release id. */
export async function publish(userId: string, siteId: string, reason = "test"): Promise<{ releaseId: string; candidateId: string }> {
  const ctx = await withUser(userId, (db) => loadSiteContext(db, siteId));
  if (!ctx) throw new Error("no site context");
  const { candidate } = await buildCandidate(userId, ctx.site);
  if (candidate.state !== "ready") throw new Error(`candidate not ready: ${JSON.stringify(candidate.validation.blockers)}`);
  const result = await activateCandidate(userId, candidate.id, key(), reason);
  if (result.outcome !== "activated") throw new Error(`activation failed: ${JSON.stringify(result)}`);
  return { releaseId: result.releaseId, candidateId: candidate.id };
}

export async function demoSnapshot(siteKey: string): Promise<{ releaseId: string; snapshot: Record<string, unknown> } | null> {
  const rows = await withAnon((db) => db<{ releaseId: string; snapshot: Record<string, unknown> }[]>`select release_id, snapshot from public.get_demo_release(${siteKey})`);
  return rows[0] ?? null;
}
