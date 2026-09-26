import crypto from "node:crypto";
import { withUser, type Db } from "@/server/data/db";
import { loadSiteContext, type SiteRow } from "@/server/data/access";
import { createContentItem, saveRevision, getItem, validatePayload, type RevisionRow } from "@/server/data/content";
import { getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { ingestImage } from "@/server/media/ingest";
import { renderScenePng } from "@/server/demo/images";
import { buildCandidate } from "@/server/publishing/candidates";
import { activateCandidate } from "@/server/publishing/activate";
import { pineHollowFixture, pineHollowHero } from "@/server/demo/fixtures/pine-hollow";
import { rangeAthleticsFixture } from "@/server/demo/fixtures/range-athletics";
import type { FixtureItem, FixtureSite, FixtureImage } from "@/server/demo/fixtures/types";
import type { ContentKind } from "@/modules/registry";

export interface LoadDemoResult {
  siteId: string;
  created: number;
  updated: number;
  unchanged: number;
  images: number;
  releases: string[];
  log: string[];
}

export function fixtureForSite(key: string, now: Date): FixtureSite | null {
  if (key === "pine-hollow") return pineHollowFixture(now);
  if (key === "range-athletics") return rangeAthleticsFixture(now);
  return null;
}

const FIXTURE_LICENSE = "CC0-1.0 — original vector artwork generated for this demonstration";

async function ensureImage(db: Db, site: SiteRow, userId: string, siteKey: string, image: FixtureImage): Promise<string> {
  const marker = `fixture://${siteKey}/${image.key}`;
  const existing = await db<{ id: string }[]>`select id from public.media_assets where site_id = ${site.id} and source_url = ${marker} and status = 'ready' limit 1`;
  if (existing[0]) return existing[0].id;
  const png = await renderScenePng(image.scene);
  const result = await ingestImage(db, {
    siteId: site.id,
    organizationId: site.organizationId,
    userId,
    bytes: png,
    filename: `${image.key}.png`,
    declaredMime: "image/png",
    title: image.title,
    altText: image.alt,
    decorative: image.decorative ?? false,
    attributionText: "Original artwork created for the Lerner Works demonstration",
    license: FIXTURE_LICENSE,
    sourceUrl: marker,
  });
  if (!result.ok) throw new Error(`fixture image ${image.key}: ${result.error}`);
  return result.asset.id;
}

/** Replaces "@external-id" references and "@imagekey" asset references with real ids. */
function resolveRefs(value: unknown, itemIds: Map<string, string>, assetIds: Map<string, string>): unknown {
  if (typeof value === "string" && value.startsWith("@")) {
    const key = value.slice(1);
    return itemIds.get(key) ?? assetIds.get(key) ?? value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, itemIds, assetIds));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveRefs(v, itemIds, assetIds);
    return out;
  }
  return value;
}

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.keys(val as object).sort().reduce((o: Record<string, unknown>, k) => ((o[k] = (val as Record<string, unknown>)[k]), o), {}) : val));
}

async function upsertItem(db: Db, site: SiteRow, userId: string, item: FixtureItem, payload: Record<string, unknown>, counters: LoadDemoResult): Promise<{ itemId: string; revision: RevisionRow; changed: boolean }> {
  const kind = item.kind as ContentKind;
  const normalized = validatePayload(kind, { schemaVersion: 1, ...payload });
  const existing = await db<{ id: string }[]>`select id from public.content_items where site_id = ${site.id} and kind = ${kind} and external_id = ${item.externalId}`;
  if (!existing[0]) {
    const created = await createContentItem(db, { siteId: site.id, organizationId: site.organizationId, kind, payload: normalized, authorId: userId, externalId: item.externalId, changeNote: "Loaded demonstration content" });
    counters.created++;
    return { itemId: created.item.id, revision: created.revision, changed: true };
  }
  const current = (await getItem(db, existing[0].id))!;
  if (stable(current.revision.payload) === stable(normalized)) {
    counters.unchanged++;
    return { itemId: current.item.id, revision: current.revision, changed: false };
  }
  const saved = await saveRevision(db, { itemId: current.item.id, baseRevisionId: current.revision.id, payload: normalized, authorId: userId, changeNote: "Updated demonstration content" });
  if (!saved.ok) throw new Error(`concurrent change while loading ${item.externalId}`);
  counters.updated++;
  return { itemId: current.item.id, revision: saved.revision, changed: true };
}

async function latestReviewState(db: Db, revisionId: string): Promise<string> {
  const rows = await db<{ state: string }[]>`select state::text from public.reviews where revision_id = ${revisionId} order by created_at desc limit 1`;
  return rows[0]?.state ?? "unsubmitted";
}

async function review(db: Db, site: SiteRow, userId: string, itemId: string, revisionId: string, state: "approved" | "submitted"): Promise<void> {
  if ((await latestReviewState(db, revisionId)) === state) return;
  await db`insert into public.reviews (organization_id, site_id, item_id, revision_id, state, actor_id) values (${site.organizationId}, ${site.id}, ${itemId}, ${revisionId}, ${state}, ${userId})`;
}

async function publish(userId: string, site: SiteRow, reason: string, log: string[]): Promise<string | null> {
  const ctx = await withUser(userId, (db) => loadSiteContext(db, site.id));
  if (!ctx) throw new Error("site not visible");
  const { candidate } = await buildCandidate(userId, ctx.site);
  if (candidate.state !== "ready") {
    throw new Error(`demo candidate blocked: ${candidate.validation.blockers.map((b) => b.message).join(" | ")}`);
  }
  const s = candidate.summary;
  if (!s.firstRelease && s.added.length + s.changed.length + s.removed.length + s.configFields.length + s.mediaAdded.length + (s.mediaChanged?.length ?? 0) === 0 && !s.navigationChanged) {
    await withUser(userId, (db) => db`update public.release_candidates set state = 'discarded' where id = ${candidate.id}`);
    log.push(`no changes to publish for "${reason}"`);
    return null;
  }
  const result = await activateCandidate(userId, candidate.id, crypto.randomUUID(), reason);
  if (result.outcome !== "activated") throw new Error(`demo activation failed: ${JSON.stringify(result)}`);
  log.push(`published release ${result.releaseId.slice(0, 8)} (${reason})`);
  return result.releaseId;
}

/**
 * Loads the fictional demonstration content into a demo site through the ordinary editing,
 * media, review and publishing services (as the acting user). Safe to repeat: items are
 * matched by external id, images by fixture key, and unchanged content is left alone.
 */
export async function loadDemoContent(userId: string, siteId: string, opts: { now?: Date } = {}): Promise<LoadDemoResult> {
  const now = opts.now ?? new Date();
  const result: LoadDemoResult = { siteId, created: 0, updated: 0, unchanged: 0, images: 0, releases: [], log: [] };
  const ctx = await withUser(userId, (db) => loadSiteContext(db, siteId));
  if (!ctx) throw new Error("site not found");
  if (ctx.site.mode !== "demo") throw new Error("demonstration content can only be loaded into a site in demo mode");
  if (!ctx.capabilities.isOwner) throw new Error("only an organization owner can load demonstration content");
  const fixture = fixtureForSite(ctx.site.key, now);
  if (!fixture) throw new Error(`no demonstration fixture exists for site key "${ctx.site.key}"`);
  const site = ctx.site;

  // Images first (they are referenced by items and the hero).
  const assetIds = new Map<string, string>();
  await withUser(userId, async (db) => {
    const images: FixtureImage[] = [...fixture.items.flatMap((i) => (i.image ? [i.image] : [])), ...(fixture.images ?? [])];
    if (fixture.key === "pine-hollow") images.push(pineHollowHero);
    for (const img of images) {
      const before = await db<{ id: string }[]>`select id from public.media_assets where site_id = ${site.id} and source_url = ${`fixture://${fixture.key}/${img.key}`}`;
      const assetId = await ensureImage(db, site, userId, fixture.key, img);
      assetIds.set(img.key, assetId);
      if (!before[0]) result.images++;
      // Focal points are part of the fixture: set through the same column an editor's save uses.
      await db`update public.media_assets set focal_x = ${img.focal?.x ?? null}, focal_y = ${img.focal?.y ?? null} where id = ${assetId} and site_id = ${site.id}`;
    }
  });

  // Items: two passes so cross-references resolve regardless of order.
  const itemIds = new Map<string, string>();
  await withUser(userId, async (db) => {
    for (const item of fixture.items) {
      const existing = await db<{ id: string }[]>`select id from public.content_items where site_id = ${site.id} and kind = ${item.kind} and external_id = ${item.externalId}`;
      if (existing[0]) itemIds.set(item.externalId, existing[0].id);
    }
    // Create placeholders for new items so references can be resolved in the same pass.
    for (const item of fixture.items) {
      if (itemIds.has(item.externalId)) continue;
      // Adopt a preset starter page (same slug, no external id) instead of creating a duplicate route.
      const slug = String(item.payload.slug ?? "");
      const adoptable = await db<{ id: string }[]>`
        select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
        where i.site_id = ${site.id} and i.kind = ${item.kind} and i.external_id is null and i.archived_at is null and r.slug = ${slug} limit 1`;
      if (adoptable[0]) {
        await db`update public.content_items set external_id = ${item.externalId} where id = ${adoptable[0].id}`;
        itemIds.set(item.externalId, adoptable[0].id);
        continue;
      }
      const bare = resolveRefs({ ...item.payload, featuredImageAssetId: null }, new Map(), new Map()) as Record<string, unknown>;
      const stripped = stripUnresolved(bare);
      const created = await createContentItem(db, { siteId: site.id, organizationId: site.organizationId, kind: item.kind, payload: { schemaVersion: 1, ...stripped }, authorId: userId, externalId: item.externalId, changeNote: "Loaded demonstration content" });
      itemIds.set(item.externalId, created.item.id);
      result.created++;
    }
  });

  const applyItems = async (items: FixtureItem[], note: string) => {
    const revisions = new Map<string, { itemId: string; revision: RevisionRow; item: FixtureItem }>();
    await withUser(userId, async (db) => {
      for (const item of items) {
        const payload = resolveRefs({ ...item.payload, featuredImageAssetId: item.image ? assetIds.get(item.image.key) ?? null : (item.payload.featuredImageAssetId ?? null) }, itemIds, assetIds) as Record<string, unknown>;
        const counters = { ...result };
        const r = await upsertItem(db, site, userId, item, payload, counters);
        result.updated = counters.updated;
        result.unchanged = counters.unchanged;
        revisions.set(item.externalId, { itemId: r.itemId, revision: r.revision, item });
      }
      for (const { itemId, revision, item } of revisions.values()) {
        if (item.leaveAsDraft) continue;
        if (item.submitForReview) {
          await review(db, site, userId, itemId, revision.id, "submitted");
          continue;
        }
        await review(db, site, userId, itemId, revision.id, "approved");
      }
    });
    result.log.push(`${note}: ${items.length} items applied`);
  };

  // Site configuration (tagline, footer, description, hero image reference, mode label).
  await withUser(userId, async (db) => {
    const current = await getCurrentSiteConfig(db, site.id);
    if (!current) throw new Error("site has no configuration");
    const next = structuredClone(current.config);
    next.branding.tagline = fixture.config.tagline;
    next.footer.text = fixture.config.footerText;
    next.metadata.defaultDescription = fixture.config.defaultDescription;
    next.metadata.defaultTitle = site.name;
    if (fixture.config.logoImageKey) next.branding.logoAssetId = assetIds.get(fixture.config.logoImageKey) ?? null;
    if (fixture.config.shareImageKey) next.metadata.shareImageAssetId = assetIds.get(fixture.config.shareImageKey) ?? null;
    if (fixture.config.design) next.design = { ...next.design, ...fixture.config.design, overrides: { ...next.design.overrides, ...(fixture.config.design.overrides ?? {}) } };
    if (stable(next) !== stable(current.config)) {
      const saved = await saveSiteConfig(db, { siteId: site.id, organizationId: site.organizationId, baseRevisionId: current.id, config: next, authorId: userId, changeNote: "Demonstration configuration" });
      if (!saved.ok) throw new Error("configuration changed concurrently");
      result.log.push(`configuration revision ${saved.revision.version}`);
    }
  });

  if (!site.demoContentLoadedAt) {
    // First load: publish the initial state, then the follow-up change, so two historical
    // releases exist for the rollback demonstration.
    await applyItems(fixture.items, "initial content");
    const first = await publish(userId, site, "Demonstration content, first release", result.log);
    if (first) result.releases.push(first);
  }
  await applyItems(fixture.secondRelease.apply(fixture.items), fixture.secondRelease.note);
  const second = await publish(userId, site, fixture.secondRelease.note, result.log);
  if (second) result.releases.push(second);

  await withUser(userId, (db) => db`update public.sites set demo_content_loaded_at = now() where id = ${site.id}`);
  return result;
}

/** Removes "@..." references that could not be resolved yet (placeholders are re-saved later). */
function stripUnresolved(value: unknown): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string" && v.startsWith("@")) return null;
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== null);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as Record<string, unknown>;
}
