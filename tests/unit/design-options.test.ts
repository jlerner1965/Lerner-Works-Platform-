import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sectionCapabilityIssues, designCapabilityIssues, resolveDesign, themeCapabilities, themeKeyForPreset } from "@/themes/capabilities";
import { columnsFor } from "@/themes/shared/design";
import { sectionSchema, sectionVariants, emptySection, pagePayloadSchema, type PageSection } from "@/modules/page";
import { siteConfigSchema, designSchema } from "@/modules/site-config";
import { presets } from "@/modules/presets";
import { normalizeSnapshot } from "@/server/publishing/snapshot";

/** Design programme D1: fixed vocabularies validated against the theme (DES-06) and additive schema changes (DES-09). */
describe("theme capabilities", () => {
  it("every theme offers the default variant of every section type it renders", () => {
    for (const caps of Object.values(themeCapabilities)) {
      for (const type of caps.sectionTypes) expect(caps.variants[type], `${caps.key} ${type}`).toContain("default");
      expect(caps.header).toContain(caps.defaults.header);
      expect(caps.hero).toContain(caps.defaults.hero);
      expect(caps.cards).toContain(caps.defaults.cards);
    }
    expect(themeKeyForPreset("community_guide")).toBe("guide");
    expect(themeKeyForPreset("location_business")).toBe("locations");
  });

  it("rejects a variant the theme does not offer with a message naming the section, the style and the choices", () => {
    const sections = [{ type: "image_hero", variant: "split" }, { type: "content_collection", variant: "featured" }];
    expect(sectionCapabilityIssues("guide", sections)).toEqual([]);
    const issues = sectionCapabilityIssues("locations", sections);
    expect(issues.map((i) => i.path)).toEqual(["sections.0.variant", "sections.1.variant"]);
    expect(issues[0]!.message).toContain("Section 1");
    expect(issues[0]!.message).toContain('"split"');
    expect(issues[0]!.message).toContain("Location business");
    expect(issues[0]!.message).toContain("default, full");
    // A custom payload path is reported at that path (used by the package import).
    expect(sectionCapabilityIssues("locations", [{ type: "image_hero", variant: "split" }], "payload.sections")[0]!.path).toBe("payload.sections.0.variant");
  });

  it("rejects section types a theme does not render and unknown variants everywhere", () => {
    expect(sectionCapabilityIssues("guide", [{ type: "location_collection" }])[0]!.path).toBe("sections.0.type");
    expect(sectionCapabilityIssues("locations", [{ type: "location_collection" }])).toEqual([]);
    expect(sectionCapabilityIssues("guide", [{ type: "faq", variant: "carousel" }])[0]!.message).toContain('"carousel"');
    expect(sectionCapabilityIssues("guide", [{ type: "faq" }])).toEqual([]); // missing variant means default
  });

  it("checks site-level design options against the theme and resolves the defaults", () => {
    expect(designCapabilityIssues("locations", { header: "default", hero: "split", cards: "default" }).map((i) => i.path)).toEqual(["design.hero"]);
    expect(designCapabilityIssues("guide", { header: "centered", hero: "split", cards: "text" })).toEqual([]);
    expect(resolveDesign("guide", { header: "default", hero: "default", cards: "default" })).toEqual({ header: "left", hero: "split", cards: "image-top" });
    expect(resolveDesign("locations", { header: "centered", hero: "default", cards: "image-side" })).toEqual({ header: "centered", hero: "full", cards: "image-side" });
  });
});

describe("section and design schemas", () => {
  it("fills the variant and appearance defaults so older payloads keep rendering unchanged", () => {
    const parsed = sectionSchema.parse({ type: "text_hero", id: "s1", heading: "Hello", subheading: "", ctaLabel: "", ctaPath: "" });
    expect(parsed.variant).toBe("default");
    expect(parsed.appearance).toEqual({ background: "default", align: "start", width: "default" });
    for (const type of Object.keys(sectionVariants) as PageSection["type"][]) {
      const empty = emptySection(type, `e-${type}`);
      expect(empty.type).toBe(type);
      expect(sectionVariants[type]).toContain(empty.variant);
      expect(sectionSchema.safeParse(empty).success, type).toBe(true);
    }
    expect(emptySection("cta_banner", "c").appearance).toMatchObject({ background: "primary", align: "center" });
  });

  it("leaves grid columns to the theme unless the section sets them (each theme keeps its original grids)", () => {
    const collection = sectionSchema.parse({ type: "content_collection", id: "c", kind: "service" });
    expect(collection.type === "content_collection" && collection.columns).toBeUndefined();
    expect(columnsFor("guide", "content_collection", undefined)).toBe(3);
    expect(columnsFor("locations", "content_collection", undefined)).toBe(4);
    expect(columnsFor("guide", "feature_list", undefined)).toBe(4);
    expect(columnsFor("locations", "location_collection", undefined)).toBe(3);
    expect(columnsFor("locations", "content_collection", 2)).toBe(2);
    expect(sectionSchema.safeParse({ type: "gallery", id: "g", columns: 5 }).success).toBe(false);
  });

  it("validates the new section types", () => {
    const faq = sectionSchema.parse({ type: "faq", id: "f", heading: "Questions", items: [{ question: "When?", answer: [{ type: "paragraph", text: "Soon." }] }] });
    expect(faq.type === "faq" && faq.items[0]!.question).toBe("When?");
    expect(sectionSchema.safeParse({ type: "video", id: "v", provider: "youtube", videoId: "not a video id", title: "Clip", posterAssetId: null, caption: "" }).success).toBe(false);
    expect(sectionSchema.safeParse({ type: "video", id: "v", provider: "youtube", videoId: "dQw4w9WgXcQ", title: "Clip", posterAssetId: null, caption: "" }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "video", id: "v", provider: "vimeo", videoId: "76979871", title: "Clip", posterAssetId: null, caption: "" }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "video", id: "v", provider: "vimeo", videoId: "dQw4w9WgXcQ", title: "Clip", posterAssetId: null, caption: "" }).success).toBe(false);
    expect(sectionSchema.safeParse({ type: "map_link", id: "m", heading: "", text: "", label: "Directions", provider: "google", address: { line1: "1 Main St", line2: "", locality: "Boulder", region: "CO", postalCode: "80302", approved: true } }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "gallery", id: "g", columns: 3, aspect: "square", items: [{ assetId: "11111111-1111-4111-8111-111111111111", caption: "" }] }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "facts", id: "x", items: [{ label: "Stores", value: "4" }] }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "quotes", id: "q", items: [{ text: "Great.", attribution: "A visitor", role: "" }] }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "cta_banner", id: "b", heading: "Ready?", text: "", ctaLabel: "Go", ctaPath: "/contact", secondaryLabel: "", secondaryPath: "" }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "carousel", id: "z" }).success).toBe(false);
  });

  it("gives every site the design defaults and accepts only hex overrides", () => {
    const design = designSchema.parse({});
    expect(design).toMatchObject({ header: "default", hero: "default", cards: "default", radius: "none", density: "regular", container: "regular" });
    expect(Object.values(design.overrides).every((v) => v === "")).toBe(true);
    expect(designSchema.safeParse({ overrides: { surface: "#abcdef" } }).success).toBe(true);
    expect(designSchema.safeParse({ overrides: { surface: "red" } }).success).toBe(false);
    expect(designSchema.safeParse({ radius: "huge" }).success).toBe(false);
    const config = siteConfigSchema.parse(presets.community_guide.config({ siteName: "Test" }));
    expect(config.design.radius).toBe("none");
  });

  it("parses the preset starter pages through the current page schema", () => {
    for (const preset of Object.values(presets)) {
      for (const page of preset.initialPages({ siteName: "Test" })) {
        const parsed = pagePayloadSchema.safeParse(page.payload);
        expect(parsed.success, `${preset.key} ${String(page.payload.slug)}`).toBe(true);
      }
    }
  });
});

describe("normalising older releases", () => {
  const dir = path.resolve("tests/fixtures/releases");
  const files = fs.readdirSync(dir).filter((f) => /-v1\.json$/.test(f));

  it("gives version-1 snapshots the design defaults and every section its variant and appearance", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { schemaVersion: number; config: Record<string, unknown>; items: Record<string, { kind: string; payload: { sections?: Array<Record<string, unknown>> } }> };
      expect(raw.schemaVersion).toBe(1);
      expect(raw.config.design).toBeUndefined();
      const normalized = normalizeSnapshot(raw);
      expect(normalized).not.toBeNull();
      expect(normalized!.config.design).toMatchObject({ header: "default", radius: "none", density: "regular", container: "regular" });
      const pages = Object.values(normalized!.items).filter((i) => i.kind === "page");
      expect(pages.length).toBeGreaterThan(0);
      for (const page of pages) {
        for (const section of page.payload.sections as PageSection[]) {
          expect(section.variant).toBe("default");
          expect(section.appearance).toEqual({ background: "default", align: "start", width: "default" });
        }
      }
      // The stored release itself is left as it was.
      expect(raw.config.design).toBeUndefined();
    }
  });

  it("rejects unsupported schema versions", () => {
    expect(normalizeSnapshot({ schemaVersion: 99, site: {}, config: {}, items: {}, routes: [] })).toBeNull();
    expect(normalizeSnapshot(null)).toBeNull();
  });
});
