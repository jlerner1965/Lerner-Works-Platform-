import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { seedInfo, withUser, endPool, adminClient, key, approveAll, publish, demoSnapshot } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { getItem, saveRevision } from "@/server/data/content";
import { ingestImage } from "@/server/media/ingest";
import { renderScenePng } from "@/server/demo/images";
import { getStorage } from "@/server/media/storage";
import { buildCandidate, getCandidate } from "@/server/publishing/candidates";
import { activateCandidate, restoreRelease } from "@/server/publishing/activate";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";

const { users, sites, organizations } = seedInfo();
const owner = users.owner;
const siteB = sites.rangeAthletics;

afterAll(async () => {
  await endPool();
});

describe("images across releases (MEDIA-02, PUB-07)", () => {
  it("replacing a store image and restoring the old release resolves the historical image", async () => {
    // The picture that is replaced and later withdrawn is the test's own upload: the seeded
    // storefront picture stays untouched, since the pilot's home and About pages also show it.
    const longmont = () => withUser(owner, async (db) => {
      const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteB} and r.slug = 'longmont'`;
      return (await getItem(db, row!.id))!;
    });
    const upload = async (seed: number, title: string) => {
      const bytes = await renderScenePng({ type: "storefront", sign: "Range Athletics", awning: "#bf4a0d", wall: "#e6e9ee", trim: "#12213a", seed, detail: "gear" });
      const result = await withUser(owner, (db) => ingestImage(db, { siteId: siteB, organizationId: organizations.rangeAthletics, userId: owner, bytes, filename: `${title.toLowerCase()}.png`, declaredMime: "image/png", title, altText: `${title} storefront`, license: "CC0-1.0" }));
      expect(result.ok).toBe(true);
      return result.ok ? result.asset.id : "";
    };
    const initial = await longmont();
    const oldAssetId = await upload(998, "Original");
    await withUser(owner, (db) => saveRevision(db, { itemId: initial.item.id, baseRevisionId: initial.revision.id, payload: { ...initial.revision.payload, featuredImageAssetId: oldAssetId }, authorId: owner }));
    await approveAll(owner, siteB);
    await publish(owner, siteB, "baseline");
    const before = (await demoSnapshot("range-athletics"))!;
    const oldMedia = (before.snapshot as unknown as ReleaseSnapshot).media[oldAssetId]!;
    const storage = getStorage();
    expect(await storage.existsPublic(oldMedia.variants.w480!.path)).toBe(true);

    // Upload a replacement and publish it.
    const store = await longmont();
    const replacementId = await upload(999, "Replacement");
    await withUser(owner, (db) => saveRevision(db, { itemId: store.item.id, baseRevisionId: store.revision.id, payload: { ...store.revision.payload, featuredImageAssetId: replacementId }, authorId: owner }));
    await approveAll(owner, siteB);
    const second = await publish(owner, siteB, "replace image");
    const after = (await demoSnapshot("range-athletics"))!;
    const afterSnap = after.snapshot as unknown as ReleaseSnapshot;
    expect(Object.keys(afterSnap.media)).toContain(replacementId);
    expect(await storage.existsPublic(afterSnap.media[replacementId]!.variants.w480!.path)).toBe(true);
    // Old public derivative is retained (never deleted while a release references it).
    expect(await storage.existsPublic(oldMedia.variants.w480!.path)).toBe(true);

    // Restore the previous release: the historical image resolves again.
    const restored = await restoreRelease(owner, before.releaseId, key(), "revert image change");
    expect(restored.outcome).toBe("restored");
    const back = (await demoSnapshot("range-athletics"))!;
    const backSnap = back.snapshot as unknown as ReleaseSnapshot;
    expect(backSnap.media[oldAssetId]?.variants.w480?.path).toBe(oldMedia.variants.w480!.path);
    expect(await storage.existsPublic(oldMedia.variants.w480!.path)).toBe(true);
    void second;

    // Withdrawing the old asset blocks restoring releases that contain it.
    await withUser(owner, (db) => db`select public.withdraw_media_asset(${oldAssetId}, 'rights withdrawn for the test')`);
    await expect(withUser(owner, (db) => db`select * from public.restore_release(${before.releaseId}, ${key()}, 'again', array[1])`)).rejects.toMatchObject({ code: "P0001" });
    const admin = adminClient();
    try {
      const [rel] = await admin<{ restorationBlockedReason: string | null }[]>`select restoration_blocked_reason from public.releases where id = ${before.releaseId}`;
      expect(rel!.restorationBlockedReason).toContain("withdrawn");
    } finally {
      await admin.end();
    }
  });

  it("leaves the prior release active when asset preparation fails, and the failure is retryable (PUB-07)", async () => {
    const before = (await demoSnapshot("range-athletics"))!;
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteB)))!;
    // Make a small change so the candidate differs, then sabotage one private derivative.
    const service = await withUser(owner, async (db) => {
      const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteB} and r.slug = 'bike-service'`;
      return (await getItem(db, row!.id))!;
    });
    await withUser(owner, (db) => saveRevision(db, { itemId: service.item.id, baseRevisionId: service.revision.id, payload: { ...service.revision.payload, summary: "Tune-ups, brake bleeds, wheel builds and flats while you wait." }, authorId: owner }));
    await approveAll(owner, siteB);
    const { candidate } = await buildCandidate(owner, ctx.site);
    expect(candidate.state).toBe("ready");
    const media = Object.values(candidate.manifest.media).find((m) => m.variants.w480)!;
    const storage = getStorage();
    const variant = media.variants.w480!;
    const original = await storage.getPrivate(variant.key);
    expect(original).not.toBeNull();
    // Sabotage: remove the already-published public copy and the private derivative, so
    // preparation must copy and cannot.
    fs.rmSync(path.join(process.env.STORAGE_LOCAL_DIR ?? ".data/test-storage", "public", variant.path), { force: true });
    await storage.deletePrivatePrefix(variant.key);
    const failed = await activateCandidate(owner, candidate.id, key(), "should fail");
    expect(failed.outcome).toBe("assets_failed");
    expect((await demoSnapshot("range-athletics"))!.releaseId).toBe(before.releaseId);
    const still = (await withUser(owner, (db) => getCandidate(db, candidate.id)))!;
    expect(still.state).toBe("ready");
    // Repair and retry with the same candidate.
    await storage.putPrivate(variant.key, original!, "image/webp");
    const ok = await activateCandidate(owner, candidate.id, key(), "retry after repair");
    expect(ok.outcome).toBe("activated");
    expect((await demoSnapshot("range-athletics"))!.releaseId).not.toBe(before.releaseId);
  });
});

