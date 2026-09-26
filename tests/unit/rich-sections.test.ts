import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getTheme } from "@/themes";
import { themeCapabilities, themesForPreset } from "@/themes/capabilities";
import { sectionHasContent } from "@/themes/shared/empty";
import { mapEmbedUrl } from "@/themes/shared/map-embed";
import { slotHint } from "@/components/admin/editor/sections-editor";
import { sectionSchema, type PageSection, type PageSectionInput } from "@/modules/page";
import { presets, type PresetKey } from "@/modules/presets";
import { kindRegistry } from "@/modules/registry";
import { siteConfigSchema } from "@/modules/site-config";
import { collectAssetRefs } from "@/server/publishing/manifest";
import { normalizeSnapshot, type ReleaseSnapshot, type SnapshotMedia } from "@/server/publishing/snapshot";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { validateManifest } from "@/server/publishing/validate";

/**
 * Site-building programme B3: the richer section vocabulary (people, logo strip, image and
 * text rows, photo band, gallery lightbox, portraits on quotations, hero treatments, the
 * click-to-load map) renders in every composition from tokens alone and without a script for
 * the lightbox or the band; validation names what is missing; the manifest carries every
 * picture the new sections refer to.
 */
const now = new Date("2026-09-26T12:00:00Z");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const C = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const D = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";

function media(id: string, alt: string): SnapshotMedia {
  const variant = (width: number) => ({ key: `k-${id}-${width}`, path: `${id}-w${width}.webp`, width, height: Math.round(width * 0.625), bytes: width * 100, hash: `h-${id}-${width}` });
  return { id, hash: `hash-${id}`, width: 2400, height: 1500, alt, decorative: false, title: alt, attribution: "", license: "Owner", variants: { w480: variant(480), w960: variant(960), w1600: variant(1600) } };
}

const richSections: PageSectionInput[] = [
  { id: "s-hero", type: "image_hero", variant: "collage", heading: "Cedar Bend, up close", subheading: "Four pictures, one town.", imageAssetId: A, extraImageAssetIds: [B, C], ctaLabel: "Look around", ctaPath: "/about" },
  { id: "s-rows", type: "image_text", heading: "How it works", items: [
    { assetId: A, heading: "Written by neighbours", body: [{ type: "paragraph", text: "Every entry is checked by someone who lives here." }], ctaLabel: "Meet them", ctaPath: "/about" },
    { assetId: B, heading: "Checked every season", body: [{ type: "paragraph", text: "Hours and prices are verified four times a year." }], ctaLabel: "", ctaPath: "" },
  ] },
  { id: "s-team", type: "team", heading: "The people", intro: "Three volunteers keep the guide honest.", items: [
    { name: "Ada Quill", role: "Editor", text: "Walks every trail twice a year.", assetId: A, path: "/about" },
    { name: "Bo Ferris", role: "Photographer", text: "", assetId: null, path: "" },
  ] },
  { id: "s-logos", type: "logo_strip", heading: "Members of", items: [{ assetId: C, label: "Cedar Bend Chamber", path: "https://chamber.example" }, { assetId: D, label: "", path: "" }] },
  { id: "s-quotes", type: "quotes", variant: "grid", items: [
    { text: "Finally a guide that says when the hours are unknown.", attribution: "Mara Lind", role: "Visitor", assetId: B },
    { text: "The map link got us there.", attribution: "Tom Reyes", role: "", assetId: null },
  ] },
  { id: "s-gal", type: "gallery", lightbox: true, items: [{ assetId: A, caption: "The creek path" }, { assetId: B, caption: "" }, { assetId: C, caption: "Market day" }] },
  { id: "s-band", type: "image_band", heading: "Come for the weekend", text: "Stay for the season.", imageAssetId: D, tint: "accent", strength: "strong", ctaLabel: "Plan a visit", ctaPath: "/contact", appearance: { align: "center" } },
  { id: "s-map", type: "map_link", heading: "Find us", provider: "google", embed: true, latitude: 40.015, longitude: -105.27, address: { line1: "1 Main Street", line2: "", locality: "Cedar Bend", region: "CO", postalCode: "80000", approved: true } },
  { id: "s-text", type: "rich_text", heading: "Before you go", body: [
    { type: "paragraph", text: "Some words." },
    { type: "divider" },
    { type: "callout", text: "Trailheads fill by **nine** on weekends." },
    { type: "button", label: "Ask a question", target: "/contact" },
  ] },
];

/** A fresh site of a preset whose home page carries the B3 sections, with every referenced picture in the release. */
function snapshotWith(preset: PresetKey, sections: PageSectionInput[], theme: string): ReleaseSnapshot {
  const def = presets[preset];
  const siteName = "Cedar Bend Guide";
  const pages = def.initialPages({ siteName });
  const items: ReleaseSnapshot["items"] = {};
  const routes: ReleaseSnapshot["routes"] = [];
  for (const p of pages) {
    const payload = p.slug === "home" ? { ...(p.payload as Record<string, unknown>), sections: sections.map((s) => sectionSchema.parse(s)) } : (p.payload as unknown as Record<string, unknown>);
    items[p.slug] = { id: p.slug, kind: "page", slug: p.slug, title: p.title, revisionId: `r-${p.slug}`, revisionVersion: 1, payload };
    routes.push({ path: p.slug === "home" ? "/" : `/${p.slug}`, kind: "page", itemId: p.slug });
  }
  const config = siteConfigSchema.parse(def.config({ siteName }));
  config.design = { ...config.design, theme: theme as typeof config.design.theme };
  for (const [mod, on] of Object.entries(config.modules)) {
    if (!on || mod === "inquiries") continue;
    const base = { places: "/places", events: "/events", articles: "/articles", stores: "/locations", services: "/services" }[mod];
    if (base) routes.push({ path: base, kind: "index", module: mod as keyof typeof config.modules });
  }
  routes.push({ path: "/search", kind: "search" });
  return normalizeSnapshot({
    schemaVersion: 5,
    site: { id: "11111111-1111-4111-8111-111111111111", key: "cedar-bend", name: siteName, preset, timeZone: "America/Denver", mode: "demo", contact: { email: "hello@cedarbend.example", phone: "", address: "" } },
    configRevisionId: "22222222-2222-4222-8222-222222222222",
    config,
    items,
    routes,
    redirects: [],
    media: { [A]: media(A, "Creek path"), [B]: media(B, "Market stalls"), [C]: media(C, "Chamber mark"), [D]: media(D, "Ridge at dusk") },
  } satisfies ReleaseSnapshot)!;
}

function renderHome(snapshot: ReleaseSnapshot, mode: "demo" | "live" = "demo"): string {
  const basePath = mode === "demo" ? `/demo/${snapshot.site.key}` : "";
  const ctx = makeRenderContext({ snapshot, basePath, mode, path: "/", query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: now, now });
  return renderToStaticMarkup(getTheme(snapshot).render(ctx, resolveRoute(snapshot, "/")));
}

const section = (input: Record<string, unknown>): PageSection => sectionSchema.parse({ id: "s", ...input });

describe("the B3 vocabulary is offered by every composition", () => {
  it("declares the new section types and hero treatments in every theme's capabilities", () => {
    for (const caps of Object.values(themeCapabilities)) {
      for (const type of ["team", "logo_strip", "image_text", "image_band"] as const) expect(caps.sectionTypes, `${caps.key} ${type}`).toContain(type);
      for (const v of ["offset", "collage", "statement"]) expect(caps.variants.image_hero, `${caps.key} image_hero ${v}`).toContain(v);
      expect(caps.variants.gallery).toContain("default");
    }
  });

  it("knows when the new sections have something to show, and the editor says so", () => {
    const scope = { snapshot: snapshotWith("community_guide", [], "default"), now };
    expect(sectionHasContent(scope, section({ type: "team" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "team", items: [{ name: "Ada" }] }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "image_text" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "logo_strip", items: [{ assetId: "33333333-3333-4333-8333-333333333333" }] }))).toBe(false); // not in the release
    expect(sectionHasContent(scope, section({ type: "logo_strip", items: [{ assetId: A }] }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "image_band" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "image_band", imageAssetId: D }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "image_band", heading: "Hi" }))).toBe(true);
    expect(slotHint(section({ type: "team" }))).toMatch(/Publication needs at least one/);
    expect(slotHint(section({ type: "image_band" }))).toMatch(/choose a picture or write a heading/);
    expect(slotHint(section({ type: "image_band", heading: "Hi" }))).toBeNull();
  });
});

describe("the B3 sections render in every composition without a script", () => {
  for (const preset of Object.keys(presets) as PresetKey[]) {
    for (const theme of themesForPreset(preset)) {
      it(`${preset} under ${theme.key}`, () => {
        const html = renderHome(snapshotWith(preset, richSections, theme.key));
        expect(html).toContain(`${theme.key}-theme`);
        expect(html).not.toContain("<script");
        // Hero collage: the main picture and both extras.
        expect(html).toContain("md:grid-cols-[3fr_2fr]");
        expect(html).toContain('alt="Creek path"');
        expect(html).toContain('alt="Market stalls"');
        // Image and text rows alternate: the second row's picture moves to the right.
        expect(html).toContain("Written by neighbours");
        expect(html).toContain("md:order-2");
        expect(html).toContain("Meet them");
        // People, with a portrait where there is one and a link where there is one.
        expect(html).toContain("Ada Quill");
        expect(html).toContain("Bo Ferris");
        expect(html).toMatch(/<a [^>]*href="\/demo\/cedar-bend\/about"[^>]*>Ada Quill<\/a>/);
        // Logos: an external link never leaks the referrer.
        expect(html).toMatch(/<a [^>]*href="https:\/\/chamber.example"[^>]*rel="noreferrer"/);
        expect(html).toContain("Cedar Bend Chamber");
        // A portrait beside the quotation that has one; the other keeps the plain attribution.
        expect(html).toContain("Mara Lind");
        expect(html).toMatch(/rounded-full[^>]*h-11 w-11/);
        expect(html).toContain("Tom Reyes");
        // Lightbox: hidden dialogs reached by :target, with close and next/previous links.
        expect(html).toContain('id="lb-s-gal-0"');
        expect(html).toContain('href="#lb-s-gal-1"');
        expect(html).toContain('href="#g-s-gal"');
        expect(html).toContain('role="dialog"');
        expect((html.match(/class="lw-lightbox"/g) ?? []).length).toBe(3);
        // Photo band: the accent wash over the picture, the accent band's own variables, the button inverted.
        expect(html).toContain("lw-wash-accent-strong");
        expect(html).toContain("--section-bg:var(--brand-accent)");
        expect(html).toContain("Come for the weekend");
        expect(html).toContain("Plan a visit");
        // Click-to-load map: the address and a disabled button on a demonstration site; no frame before consent.
        expect(html).toContain("Show map");
        expect(html).toContain("The map is disabled on demonstration sites.");
        expect(html).not.toContain("<iframe");
        // Rich text: rule, callout and button.
        expect(html).toContain("<hr");
        expect(html).toContain('class="lw-callout"');
        expect(html).toMatch(/<a href="\/demo\/cedar-bend\/contact" class="lw-prose-button"/);
        expect(html).toContain("<strong>nine</strong>");
      });
    }
  }

  it("offers the map to a live visitor with an approved address, and withholds it otherwise", () => {
    const live = snapshotWith("community_guide", [richSections[7]!], "default");
    live.site = { ...live.site, mode: "live" };
    const html = renderHome(live, "live");
    expect(html).toContain("nothing is loaded from Google Maps before that");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("<iframe");
    const unapproved = snapshotWith("community_guide", [{ ...(richSections[7] as Extract<PageSectionInput, { type: "map_link" }>), address: { line1: "1 Main Street", locality: "Cedar Bend", approved: false } }], "default");
    unapproved.site = { ...unapproved.site, mode: "live" };
    expect(renderHome(unapproved, "live")).toContain("The map appears once the owner approves this address.");
    expect(mapEmbedUrl("google", 40.015, -105.27)).toBe("https://www.google.com/maps?q=40.015000,-105.270000&z=15&output=embed");
    expect(mapEmbedUrl("openstreetmap", 40.015, -105.27)).toContain("openstreetmap.org/export/embed.html?bbox=-105.282000,40.008000,-105.258000,40.022000&layer=mapnik&marker=40.015000,-105.270000");
  });

  it("renders the offset and statement hero treatments, and stands the words alone without a picture", () => {
    for (const variant of ["offset", "statement", "collage"] as const) {
      for (const theme of ["default", "magazine"]) {
        const withPicture = renderHome(snapshotWith("community_guide", [{ id: "s-h", type: "image_hero", variant, heading: "Hello there", imageAssetId: A, ctaLabel: "", ctaPath: "" }], theme));
        expect(withPicture, `${theme} ${variant}`).toContain('alt="Creek path"');
        expect(withPicture, `${theme} ${variant}`).toContain("Hello there");
        const bare = renderHome(snapshotWith("community_guide", [{ id: "s-h", type: "image_hero", variant, heading: "Hello there", imageAssetId: null, ctaLabel: "", ctaPath: "" }], theme));
        expect(bare, `${theme} ${variant} bare`).toContain("Hello there");
        expect(bare, `${theme} ${variant} bare`).not.toContain("<img");
      }
    }
  });
});

describe("publication checks the new sections", () => {
  const validate = (sections: PageSectionInput[]) => {
    const s = snapshotWith("community_guide", sections, "default");
    return validateManifest({ manifest: s, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
  };

  it("passes the complete home page", () => {
    const r = validate(richSections);
    expect(r.blockers).toEqual([]);
    // Every home section shows; the untouched starter About page is the only one with a slot left out.
    expect(r.warnings.filter((w) => w.itemId === "home").map((w) => w.code)).not.toContain("section_left_out");
  });

  it("blocks empty lists, rows and logos without a picture, broken item links and an impossible map", () => {
    const r = validate([
      { id: "t", type: "team" },
      { id: "i", type: "image_text", items: [{ assetId: A, heading: "Row", ctaLabel: "Go", ctaPath: "/nowhere" }] },
      { id: "l", type: "logo_strip", items: [{ assetId: A, path: "/also-nowhere" }] },
      { id: "m1", type: "map_link", provider: "apple", embed: true, latitude: 1, longitude: 1, address: { line1: "1 Main", locality: "Town", approved: true } },
      { id: "m2", type: "map_link", provider: "google", embed: true, address: { line1: "1 Main", locality: "Town", approved: true } },
    ]);
    const codes = r.blockers.map((b) => b.code);
    expect(codes).toContain("empty_section");
    expect(r.blockers.filter((b) => b.code === "broken_link").map((b) => b.field)).toEqual(["sections.1.items.0.ctaPath", "sections.2.items.0.path"]);
    expect(codes).toContain("map_embed_unsupported");
    expect(codes).toContain("map_embed_incomplete");
    // A stored payload whose row lost its picture is caught by the row check too.
    const stored = snapshotWith("community_guide", [{ id: "i", type: "image_text", items: [{ assetId: A, heading: "Row" }] }], "default");
    ((stored.items.home!.payload.sections as Array<{ items: Array<{ assetId: string }> }>)[0]!.items[0]!.assetId as string | undefined) = undefined as never;
    expect(validateManifest({ manifest: stored, notes: [], mediaRows: new Map(), missingMedia: [] }, { now }).blockers.some((b) => b.code === "empty_section" && b.message.includes("row 1"))).toBe(true);
  });

  it("warns about a one-picture collage, a band without a picture and a light wash", () => {
    const r = validate([
      { id: "h", type: "image_hero", variant: "collage", heading: "Hi", imageAssetId: A },
      { id: "b1", type: "image_band", heading: "Band" },
      { id: "b2", type: "image_band", heading: "Band", imageAssetId: D, strength: "light" },
    ]);
    expect(r.blockers).toEqual([]);
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain("hero_collage_short");
    expect(codes).toContain("band_no_image");
    expect(codes).toContain("band_wash_light");
  });

  it("carries every picture the new sections refer to into the manifest", () => {
    const payload = { ...(presets.community_guide.initialPages({ siteName: "T" })[0]!.payload as Record<string, unknown>), sections: richSections.map((s) => sectionSchema.parse(s)) };
    const parsed = kindRegistry.page.schema.parse(payload) as Record<string, unknown>;
    const refs = collectAssetRefs("page", parsed);
    const byField = new Map(refs.map((r) => [r.field, r.assetId]));
    expect(byField.get("sections.0.imageAssetId")).toBe(A);
    expect(byField.get("sections.0.extraImageAssetIds.1")).toBe(C);
    expect(byField.get("sections.1.items.1.assetId")).toBe(B);
    expect(byField.get("sections.2.items.0.assetId")).toBe(A);
    expect(byField.get("sections.3.items.1.assetId")).toBe(D);
    expect(byField.get("sections.4.items.0.assetId")).toBe(B);
    expect(byField.get("sections.5.items.2.assetId")).toBe(C);
    expect(byField.get("sections.6.imageAssetId")).toBe(D);
    expect(new Set(refs.map((r) => r.assetId))).toEqual(new Set([A, B, C, D]));
  });
});
