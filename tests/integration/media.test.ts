import { afterAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { seedInfo, withUser, endPool } from "./helpers";
import { ingestImage, sniffImageType } from "@/server/media/ingest";
import { getStorage } from "@/server/media/storage";
import { renderScenePng } from "@/server/demo/images";

const { users, sites, organizations } = seedInfo();

afterAll(async () => {
  await endPool();
});

async function png(width: number, height: number): Promise<Uint8Array> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 60 } } }).png().toBuffer();
}

describe("media ingestion (MEDIA-01)", () => {
  it("rejects SVG, HTML disguised as an image, mismatched declared types and undecodable files without storing anything", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const html = Buffer.from("<!doctype html><html><body>not an image</body></html>");
    const garbage = Buffer.from("this is definitely not an image at all, just text ................");
    const results = await withUser(users.owner, async (db) => [
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: svg, filename: "logo.svg", declaredMime: "image/svg+xml" }),
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: html, filename: "photo.png", declaredMime: "image/png" }),
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: await png(50, 50), filename: "photo.jpg", declaredMime: "image/jpeg" }),
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: garbage, filename: "photo.png", declaredMime: "image/png" }),
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: await png(50, 50), filename: "script.exe", declaredMime: "image/png" }),
    ]);
    expect(results.map((r) => (r.ok ? "ok" : r.code))).toEqual(["unsupported_type", "unsupported_type", "mismatch", "unsupported_type", "mismatch"]);
    const count = await withUser(users.owner, (db) => db`select count(*)::int as n from public.media_assets where site_id = ${sites.pineHollow} and title in ('logo', 'photo', 'script')`);
    expect(count[0]!.n).toBe(0);
  });

  it("rejects files over the size limit and images over the pixel limit", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const huge = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    const results = await withUser(users.owner, async (db) => [
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: big, filename: "big.png", declaredMime: "image/png" }),
      await ingestImage(db, { siteId: sites.pineHollow, organizationId: organizations.pineHollow, userId: users.owner, bytes: huge, filename: "huge.png", declaredMime: "image/png" }),
    ]);
    expect(results.map((r) => (r.ok ? "ok" : r.code))).toEqual(["too_large", "too_many_pixels"]);
  });

  it("stores a valid image privately with stripped derivatives and an RLS-scoped row; editors of other sites cannot see it", async () => {
    const bytes = await renderScenePng({ type: "landscape", palette: "day", seed: 77 });
    expect(sniffImageType(bytes)).toBe("image/png");
    const result = await withUser(users.owner, (db) => ingestImage(db, { siteId: sites.rangeAthletics, organizationId: organizations.rangeAthletics, userId: users.owner, bytes, filename: "scene.png", declaredMime: "image/png", title: "Test scene", altText: "Generated landscape", license: "CC0-1.0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const asset = result.asset;
    expect(asset.status).toBe("ready");
    expect(asset.width).toBe(1600);
    expect(Object.keys(asset.derivatives).sort()).toEqual(["w1600", "w480", "w960"]);
    const storage = getStorage();
    for (const d of Object.values(asset.derivatives)) {
      const data = await storage.getPrivate(d.key);
      expect(data).not.toBeNull();
      const meta = await sharp(data!).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(d.width);
      expect(meta.exif).toBeUndefined();
      expect(await storage.existsPublic(d.path)).toBe(false);
    }
    expect(asset.originalKey.startsWith(`${organizations.rangeAthletics}/${sites.rangeAthletics}/`)).toBe(true);
    const visibleToEditorA = await withUser(users.editorA, (db) => db`select id from public.media_assets where id = ${asset.id}`);
    expect(visibleToEditorA.length).toBe(0);
    await expect(withUser(users.editorA, (db) => db`update public.media_assets set alt_text = 'hacked' where id = ${asset.id}`)).resolves.toHaveLength(0);
  });

  it("never upscales small images", async () => {
    const bytes = await png(600, 400);
    const result = await withUser(users.owner, (db) => ingestImage(db, { siteId: sites.rangeAthletics, organizationId: organizations.rangeAthletics, userId: users.owner, bytes, filename: "small.png", declaredMime: "image/png", license: "test" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.asset.derivatives).sort()).toEqual(["w480", "w960"]);
      expect(result.asset.derivatives.w960!.width).toBe(600);
    }
  });
});
