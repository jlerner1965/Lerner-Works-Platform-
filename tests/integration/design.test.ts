import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { seedInfo, withUser, endPool, key, approveAll, publish, demoSnapshot } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { getItem, saveRevision } from "@/server/data/content";
import { buildCandidate } from "@/server/publishing/candidates";
import { exportSitePackage, dryRunPackage } from "@/server/import/package";
import { resolveDemoRelease, resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";

// The save action reads the signed-in user from the request; here the owner is signed in.
const { users, sites } = seedInfo();
const owner = users.owner;
const siteB = sites.rangeAthletics;

vi.mock("@/server/auth/session", () => ({
  requireUser: async () => ({ id: owner, email: "owner@lernerworks.example" }),
  getSessionUser: async () => ({ id: owner, email: "owner@lernerworks.example" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));

async function homeItem(siteId: string) {
  return withUser(owner, async (db) => {
    const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and r.slug = 'home'`;
    return (await getItem(db, row!.id))!;
  });
}

type Section = { type: string; variant?: string; [k: string]: unknown };

beforeAll(async () => {
  await approveAll(owner, siteB);
  await publish(owner, siteB, "design baseline").catch(() => undefined);
});

afterAll(async () => {
  await endPool();
});

describe("section styles are a fixed vocabulary per theme (DES-06)", () => {
  it("rejects a variant the retail theme does not offer when saving, without writing a revision", async () => {
    const { saveItemAction } = await import("@/server/actions/content");
    const home = await homeItem(siteB);
    const sections = (home.revision.payload.sections as Section[]).map((s, i) => (i === 0 && s.type === "image_hero" ? { ...s, variant: "split" } : s));
    expect(sections[0]!.variant).toBe("split");
    const result = await saveItemAction({ itemId: home.item.id, baseRevisionId: home.revision.id, payload: { ...home.revision.payload, sections } });
    expect(result.status).toBe("invalid");
    expect(result.message).toContain("style this site's theme does not offer");
    expect(result.issues).toEqual([expect.objectContaining({ path: "sections.0.variant", message: expect.stringContaining('"split"') })]);
    expect(result.issues![0]!.message).toContain("Location business");
    const after = await homeItem(siteB);
    expect(after.revision.id).toBe(home.revision.id);
  });

  it("saves an offered variant through the same action", async () => {
    const { saveItemAction } = await import("@/server/actions/content");
    const home = await homeItem(siteB);
    const sections = (home.revision.payload.sections as Section[]).map((s, i) => (i === 0 ? { ...s, variant: "stacked" } : s));
    const result = await saveItemAction({ itemId: home.item.id, baseRevisionId: home.revision.id, payload: { ...home.revision.payload, sections } });
    expect(result.status).toBe("saved");
    const after = await homeItem(siteB);
    expect((after.revision.payload.sections as Section[])[0]!.variant).toBe("stacked");
    // Put the original style back for the later tests.
    const restore = await saveItemAction({ itemId: after.item.id, baseRevisionId: after.revision.id, payload: home.revision.payload });
    expect(restore.status).toBe("saved");
  });

  it("blocks publication when a stored revision carries an unsupported variant, and names the section", async () => {
    const before = (await demoSnapshot("range-athletics"))!;
    const home = await homeItem(siteB);
    const sections = (home.revision.payload.sections as Section[]).map((s, i) => (i === 0 ? { ...s, variant: "split" } : s));
    // The data layer accepts the payload (the schema knows the variant); the theme check is a publication rule too.
    const saved = await withUser(owner, (db) => saveRevision(db, { itemId: home.item.id, baseRevisionId: home.revision.id, payload: { ...home.revision.payload, sections }, authorId: owner }));
    expect(saved.ok).toBe(true);
    await approveAll(owner, siteB);
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteB)))!;
    const { candidate } = await buildCandidate(owner, ctx.site);
    expect(candidate.state).toBe("blocked");
    const blocker = candidate.validation.blockers.find((b) => b.code === "variant_unsupported");
    expect(blocker).toMatchObject({ itemTitle: "Home", field: "sections.0.variant" });
    expect(blocker!.message).toContain('"split"');
    expect((await demoSnapshot("range-athletics"))!.releaseId).toBe(before.releaseId);
    // Repair.
    const broken = await homeItem(siteB);
    await withUser(owner, (db) => saveRevision(db, { itemId: broken.item.id, baseRevisionId: broken.revision.id, payload: home.revision.payload, authorId: owner }));
    await approveAll(owner, siteB);
  });

  it("refuses a package whose page uses a variant the target theme does not offer", async () => {
    const zip = await withUser(owner, async (db) => exportSitePackage(db, (await loadSiteContext(db, siteB))!.site));
    const entries = unzipSync(zip);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]!)) as { files: Array<{ path: string; sha256: string }> };
    const pagePath = Object.keys(entries).find((p) => p.startsWith("content/page/") && strFromU8(entries[p]!).includes('"image_hero"'))!;
    const doc = JSON.parse(strFromU8(entries[pagePath]!)) as { payload: { sections: Section[] } };
    doc.payload.sections = doc.payload.sections.map((s) => (s.type === "image_hero" ? { ...s, variant: "split" } : s));
    entries[pagePath] = new TextEncoder().encode(JSON.stringify(doc));
    manifest.files = manifest.files.map((f) => (f.path === pagePath ? { ...f, sha256: createHash("sha256").update(entries[pagePath]!).digest("hex") } : f));
    entries["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest));
    const dry = await withUser(owner, async (db) => dryRunPackage(db, (await loadSiteContext(db, siteB))!.site, zipSync(entries)));
    expect(dry.errors.some((e) => e.includes(pagePath) && e.includes('"split"'))).toBe(true);
  });
});

describe("focal points follow the image into every crop (DES-07)", () => {
  it("publishes the focal point with the asset and renders it as the image position", async () => {
    const home = await homeItem(siteB);
    const hero = (home.revision.payload.sections as Section[]).find((s) => s.type === "image_hero")!;
    const assetId = hero.imageAssetId as string;
    expect(assetId).toBeTruthy();
    const active = (await demoSnapshot("range-athletics"))!.snapshot as unknown as ReleaseSnapshot;
    expect(active.media[assetId]?.focal).toEqual({ x: 0.5, y: 0.38 }); // seeded fixture value
    // Move the focal point (as the media library's focal point editor does) and publish.
    await withUser(owner, (db) => db`update public.media_assets set focal_x = 0.25, focal_y = 0.75 where id = ${assetId} and site_id = ${siteB}`);
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteB)))!;
    const { candidate } = await buildCandidate(owner, ctx.site);
    expect(candidate.state).toBe("ready");
    expect(candidate.summary.mediaChanged).toContain(assetId);
    const { activateCandidate } = await import("@/server/publishing/activate");
    expect((await activateCandidate(owner, candidate.id, key(), "move focal point")).outcome).toBe("activated");

    const release = (await resolveDemoRelease("range-athletics"))!;
    expect(release.snapshot.media[assetId]!.focal).toEqual({ x: 0.25, y: 0.75 });
    const { getTheme } = await import("@/themes");
    const theme = getTheme(release.snapshot);
    const basePath = "/demo/range-athletics";
    const now = new Date("2026-09-26T12:00:00Z");
    const html = renderToStaticMarkup(theme.render(makeRenderContext({ snapshot: release.snapshot, basePath, mode: "demo", path: "/", query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: now, now }), resolveRoute(release.snapshot, "/")));
    // The same `object-position` applies to every viewport: the browser crops with `object-fit: cover`
    // around this point at 390, 768 and 1440 (the browser test checks the computed style).
    expect(html).toContain("object-position:25% 75%");
    expect(html).not.toContain("object-position:50% 38%");

    // Back to the fixture value.
    await withUser(owner, (db) => db`update public.media_assets set focal_x = 0.5, focal_y = 0.38 where id = ${assetId} and site_id = ${siteB}`);
    await publish(owner, siteB, "restore focal point");
    expect((await resolveDemoRelease("range-athletics"))!.snapshot.media[assetId]!.focal).toEqual({ x: 0.5, y: 0.38 });
  });
});
