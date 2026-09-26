import { afterAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { seedInfo, withUser, endPool, approveAll, publish, demoSnapshot } from "./helpers";
import { ingestImage } from "@/server/media/ingest";
import { renderScenePng } from "@/server/demo/images";
import { createContentItem } from "@/server/data/content";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { normalizeSnapshot, type ReleaseSnapshot } from "@/server/publishing/snapshot";
import { themesForPreset } from "@/themes/capabilities";
import { getTheme } from "@/themes";

/**
 * Site-building programme B3, end to end through the real services: a page carrying every
 * new section (people, logo strip, image and text rows, photo band, hero collage, portraits
 * on quotations, gallery lightbox, click-to-load map, rich text blocks) is saved, approved,
 * built and published; the release carries the picture every section refers to, and every
 * composition written for the preset renders the page from the frozen snapshot without a
 * script for the lightbox or the band.
 */
const { users, sites, organizations } = seedInfo();
const owner = users.owner;
const siteA = sites.pineHollow;
const now = new Date("2026-09-26T12:00:00Z");

afterAll(async () => {
  await endPool();
});

describe("the B3 section vocabulary publishes and renders in every composition", () => {
  it("carries the referenced picture into the release and renders each section from the snapshot", async () => {
    const suffix = Date.now().toString(36);
    const bytes = await renderScenePng({ type: "portrait", initials: "TE", bg: "#e9dcc6", fg: "#24382f", accent: "#a4502b", seed: 3 });
    const ingested = await withUser(owner, (db) => ingestImage(db, { siteId: siteA, organizationId: organizations.pineHollow, userId: owner, bytes, filename: "editor.png", declaredMime: "image/png", title: "Test editor portrait", altText: "Stylised portrait of a fictional editor", license: "CC0-1.0" }));
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) return;
    const assetId = ingested.asset.id;
    const slug = `b3-sections-${suffix}`;
    const payload = {
      schemaVersion: 1,
      title: "Design richness check",
      slug,
      summary: "A page exercising the B3 section vocabulary end to end through the real services.",
      body: [],
      featuredImageAssetId: null,
      metaTitle: "",
      metaDescription: "",
      indexable: true,
      sourceUrl: "",
      lastVerifiedOn: "",
      attribution: "",
      sections: [
        { id: "s-hero", type: "image_hero", variant: "collage", heading: "Richness check", subheading: "Every new section on one page.", imageAssetId: assetId, extraImageAssetIds: [assetId], ctaLabel: "", ctaPath: "" },
        { id: "s-rows", type: "image_text", heading: "Rows", items: [{ assetId, heading: "A row with a picture", body: [{ type: "paragraph", text: "Words beside a picture." }], ctaLabel: "Contact", ctaPath: "/contact" }] },
        { id: "s-team", type: "team", heading: "People", items: [{ name: "Test Editor", role: "Editor", text: "Keeps the dates.", assetId, path: "/contact" }] },
        { id: "s-logos", type: "logo_strip", heading: "Members of", items: [{ assetId, label: "Test mark", path: "https://members.example" }] },
        { id: "s-quotes", type: "quotes", items: [{ text: "It works.", attribution: "Test Editor", role: "", assetId }] },
        { id: "s-gallery", type: "gallery", lightbox: true, items: [{ assetId, caption: "The portrait" }, { assetId, caption: "" }] },
        { id: "s-band", type: "image_band", heading: "A band", text: "Over a picture.", imageAssetId: assetId, tint: "accent", strength: "strong", ctaLabel: "Contact", ctaPath: "/contact", appearance: { align: "center" } },
        { id: "s-map", type: "map_link", heading: "Map", provider: "google", embed: true, latitude: 40.015, longitude: -105.27, address: { line1: "1 Main Street", locality: "Pine Hollow", region: "CO", postalCode: "80999", approved: true } },
        { id: "s-text", type: "rich_text", heading: "Blocks", body: [{ type: "paragraph", text: "Some words." }, { type: "divider" }, { type: "callout", text: "A callout." }, { type: "button", label: "Ask", target: "/contact" }] },
      ],
    };
    const created = await withUser(owner, (db) => createContentItem(db, { siteId: siteA, organizationId: organizations.pineHollow, kind: "page", payload, authorId: owner, changeNote: "B3 richness check" }));
    expect(created.item.id).toBeTruthy();
    await approveAll(owner, siteA);
    await publish(owner, siteA, "B3 richness check");

    const live = (await demoSnapshot("pine-hollow"))!;
    const snapshot = normalizeSnapshot(live.snapshot)!;
    // The release carries the picture under every field that refers to it, and the page's additive fields as saved.
    expect(snapshot.media[assetId]?.alt).toBe("Stylised portrait of a fictional editor");
    const page = snapshot.items[created.item.id]!;
    const sections = page.payload.sections as Array<Record<string, unknown>>;
    expect(sections[0]!.extraImageAssetIds).toEqual([assetId]);
    expect(sections[5]!.lightbox).toBe(true);
    expect(sections[7]!.embed).toBe(true);
    expect(snapshot.routes.some((r) => r.path === `/${slug}`)).toBe(true);

    for (const theme of themesForPreset(snapshot.site.preset)) {
      const themed: ReleaseSnapshot = { ...snapshot, config: { ...snapshot.config, design: { ...snapshot.config.design, theme: theme.key } } };
      const basePath = "/demo/pine-hollow";
      const ctx = makeRenderContext({ snapshot: themed, basePath, mode: "demo", path: `/${slug}`, query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: now, now });
      const html = renderToStaticMarkup(getTheme(themed).render(ctx, resolveRoute(themed, `/${slug}`)));
      expect(html, theme.key).toContain(`${theme.key}-theme`);
      expect(html, theme.key).not.toContain("<script");
      expect(html, theme.key).not.toContain("<iframe");
      expect(html, theme.key).toContain("Test Editor");
      expect(html, theme.key).toContain('id="lb-s-gallery-1"');
      expect(html, theme.key).toContain("lw-wash-accent-strong");
      expect(html, theme.key).toContain("Show map");
      expect(html, theme.key).toContain('class="lw-callout"');
      expect(html, theme.key).toMatch(/<a [^>]*href="https:\/\/members.example"[^>]*rel="noreferrer"/);
      expect((html.match(/Stylised portrait of a fictional editor/g) ?? []).length, `${theme.key} renders the picture in every section`).toBeGreaterThanOrEqual(8);
    }
  });
});
