import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getTheme } from "@/themes";
import { sectionCapabilityIssues, themeCapabilities } from "@/themes/capabilities";
import { resolveCategories } from "@/themes/shared/collections";
import { sectionHasContent, visibleSections } from "@/themes/shared/empty";
import { slotHint } from "@/components/admin/editor/sections-editor";
import { sectionSchema, type PageSection } from "@/modules/page";
import { presets, type PresetKey } from "@/modules/presets";
import { kindRegistry } from "@/modules/registry";
import { siteConfigSchema, type SiteConfig } from "@/modules/site-config";
import { normalizeSnapshot, type ReleaseSnapshot, type SnapshotItem } from "@/server/publishing/snapshot";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { validateManifest } from "@/server/publishing/validate";

/**
 * Site-building programme B2-1 (decision D-021): a section with nothing to show is left out of
 * the public page instead of printing a placeholder notice; the starter pages are a real
 * structure whose slots fill themselves; the category list fills itself from the places.
 */
const now = new Date("2026-09-26T12:00:00Z");
const section = (input: Record<string, unknown>): PageSection => sectionSchema.parse({ id: "s", ...input });
const categoryList = (input: Record<string, unknown> = {}) => section({ type: "category_list", ...input }) as Extract<PageSection, { type: "category_list" }>;

function place(id: string, category: string, extra: Partial<SnapshotItem> = {}): SnapshotItem {
  const payload = kindRegistry.place.schema.parse({ schemaVersion: 1, title: `Place ${id}`, slug: `place-${id}`, summary: "A place with a summary long enough to count.", category, address: { line1: "", line2: "", locality: "", region: "", postalCode: "", approved: false } }) as Record<string, unknown>;
  return { id, kind: "place", slug: `place-${id}`, title: `Place ${id}`, revisionId: `r-${id}`, revisionVersion: 1, payload, ...extra };
}

/** A fresh site of a preset as its first release would be: starter pages, no content, plus whatever items are given (all routed). */
function freshSnapshot(preset: PresetKey, items: SnapshotItem[] = [], config?: Partial<SiteConfig>): ReleaseSnapshot {
  const def = presets[preset];
  const siteName = "Cedar Bend Guide";
  const pages = def.initialPages({ siteName });
  const snapshotItems: Record<string, SnapshotItem> = {};
  const routes: ReleaseSnapshot["routes"] = [];
  for (const p of pages) {
    snapshotItems[p.slug] = { id: p.slug, kind: "page", slug: p.slug, title: p.title, revisionId: `r-${p.slug}`, revisionVersion: 1, payload: p.payload as unknown as Record<string, unknown> };
    routes.push({ path: p.slug === "home" ? "/" : `/${p.slug}`, kind: "page", itemId: p.slug });
  }
  for (const it of items) {
    snapshotItems[it.id] = it;
    routes.push({ path: `${kindRegistry[it.kind].routeBase}/${it.slug}`, kind: it.kind, itemId: it.id });
  }
  const parsedConfig = siteConfigSchema.parse({ ...def.config({ siteName }), ...config });
  for (const [mod, on] of Object.entries(parsedConfig.modules)) {
    if (!on || mod === "inquiries") continue;
    const base = { places: "/places", events: "/events", articles: "/articles", stores: "/locations", services: "/services" }[mod];
    if (base) routes.push({ path: base, kind: "index", module: mod as keyof SiteConfig["modules"] });
  }
  routes.push({ path: "/search", kind: "search" });
  const raw: ReleaseSnapshot = {
    schemaVersion: 1,
    site: { id: "11111111-1111-4111-8111-111111111111", key: "cedar-bend", name: siteName, preset, timeZone: "America/Denver", mode: "demo", contact: { email: "hello@cedarbend.example", phone: "", address: "" } },
    configRevisionId: "22222222-2222-4222-8222-222222222222",
    config: parsedConfig,
    items: snapshotItems,
    routes,
    redirects: [],
    media: {},
  };
  return normalizeSnapshot(raw)!;
}

function renderHome(snapshot: ReleaseSnapshot): string {
  const basePath = `/demo/${snapshot.site.key}`;
  const ctx = makeRenderContext({ snapshot, basePath, mode: "demo", path: "/", query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: now, now });
  return renderToStaticMarkup(getTheme(snapshot).render(ctx, resolveRoute(snapshot, "/")));
}

const emptyNotice = /\b(No [a-z ]+ (have been|has been|are|is) [a-z ]+yet|has no text yet|Nothing (listed|has been published)[a-z ]*yet|No hero image selected yet|No featured store selected)\b/;

describe("a section with nothing to show is left out (D-021)", () => {
  const scope = { snapshot: freshSnapshot("community_guide"), now };
  it("knows what each section type needs before it shows", () => {
    expect(sectionHasContent(scope, section({ type: "text_hero", heading: "Hi" }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "image_hero", heading: "Hi" }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "contact_callout", heading: "Hi" }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "cta_banner", heading: "Go", ctaLabel: "Go", ctaPath: "/contact" }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "inquiry_form" }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "rich_text", heading: "About" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "rich_text", body: [{ type: "paragraph", text: "Words." }] }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "feature_list" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "feature_list", items: [{ title: "One" }] }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "faq" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "quotes" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "facts" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "gallery", items: [{ assetId: "33333333-3333-4333-8333-333333333333" }] }))).toBe(false); // no such media in the release
    expect(sectionHasContent(scope, section({ type: "content_collection", kind: "place" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "content_collection", kind: "event", mode: "upcoming" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "location_collection" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "category_list" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "video" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "video", videoId: "dQw4w9WgXcQ", title: "T" }))).toBe(true);
    expect(sectionHasContent(scope, section({ type: "map_link" }))).toBe(false);
    expect(sectionHasContent(scope, section({ type: "map_link", address: { line1: "1 Main", locality: "Town" } }))).toBe(true);
  });

  it("shows automatic collections as soon as the release has matching published items", () => {
    const withPlace = { snapshot: freshSnapshot("community_guide", [place("a", "Eat & Drink")]), now };
    expect(sectionHasContent(withPlace, section({ type: "content_collection", kind: "place" }))).toBe(true);
    expect(sectionHasContent(withPlace, section({ type: "category_list" }))).toBe(true);
    // A selected collection needs a choice; a chosen item that is not published does not count.
    expect(sectionHasContent(withPlace, section({ type: "content_collection", kind: "place", mode: "selected", itemIds: ["44444444-4444-4444-8444-444444444444"] }))).toBe(false);
  });

  it("keeps a fresh home page to the sections that have something, in order", () => {
    const fresh = freshSnapshot("community_guide");
    const home = (fresh.items.home!.payload as { sections: PageSection[] }).sections;
    expect(visibleSections({ snapshot: fresh, now }, home).map((s) => s.type)).toEqual(["image_hero", "contact_callout"]);
    const populated = freshSnapshot("community_guide", [place("a", "Eat & Drink"), place("b", "Trails")]);
    const homeP = (populated.items.home!.payload as { sections: PageSection[] }).sections;
    expect(visibleSections({ snapshot: populated, now }, homeP).map((s) => s.type)).toEqual(["image_hero", "category_list", "content_collection", "contact_callout"]);
  });
});

describe("the category list fills itself from the published places", () => {
  it("counts categories, largest first then alphabetical, within the limit, linking to the filtered directory", () => {
    const snapshot = freshSnapshot("community_guide", [place("a", "Eat & Drink"), place("b", "Trails"), place("c", "Eat & Drink"), place("d", "Arts")]);
    // A record without a category (the schema refuses one today; older data might carry it) adds no entry.
    const blank = place("e", "Arts");
    blank.payload = { ...blank.payload, category: "  " };
    snapshot.items.e = blank;
    snapshot.routes.push({ path: "/places/place-e", kind: "place", itemId: "e" });
    const all = resolveCategories({ snapshot }, categoryList());
    expect(all).toEqual([
      { name: "Eat & Drink", count: 2, path: "/places?category=Eat%20%26%20Drink" },
      { name: "Arts", count: 1, path: "/places?category=Arts" },
      { name: "Trails", count: 1, path: "/places?category=Trails" },
    ]);
    expect(resolveCategories({ snapshot }, categoryList({ limit: 2 })).map((c) => c.name)).toEqual(["Eat & Drink", "Arts"]);
  });

  it("ignores places that are not published in the release", () => {
    const snapshot = freshSnapshot("community_guide", [place("a", "Eat & Drink")]);
    snapshot.items.ghost = place("ghost", "Ghosts");
    expect(resolveCategories({ snapshot }, categoryList()).map((c) => c.name)).toEqual(["Eat & Drink"]);
  });

  it("is offered by the guide compositions only, and needs the Places module", () => {
    expect(themeCapabilities.guide.sectionTypes).toContain("category_list");
    expect(themeCapabilities.magazine.sectionTypes).toContain("category_list");
    expect(themeCapabilities.locations.sectionTypes).not.toContain("category_list");
    expect(themeCapabilities.storefront.sectionTypes).not.toContain("category_list");
    expect(sectionCapabilityIssues("storefront", [{ type: "category_list" }])).toEqual([expect.objectContaining({ path: "sections.0.type" })]);
    expect(sectionCapabilityIssues("magazine", [{ type: "category_list" }])).toEqual([]);
    const snapshot = freshSnapshot("community_guide", [place("a", "Eat & Drink")], { modules: { places: false, events: true, articles: true, stores: false, services: false, inquiries: true } });
    snapshot.routes = snapshot.routes.filter((r) => r.path !== "/places" && !r.path.startsWith("/places/"));
    snapshot.config.navigation.items = snapshot.config.navigation.items.filter((n) => n.path !== "/places");
    const r = validateManifest({ manifest: snapshot, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    expect(r.blockers.some((b) => b.code === "module_disabled_dependency" && b.message.includes("place categories"))).toBe(true);
  });
});

describe("starter pages of both presets", () => {
  for (const preset of Object.keys(presets) as PresetKey[]) {
    it(`${preset}: parse, carry no hand-written empty lists, and publish a fresh site without a single placeholder notice`, () => {
      const pages = presets[preset].initialPages({ siteName: "Cedar Bend Guide" });
      expect(pages.map((p) => p.slug)).toEqual(["home", "about", "contact"]);
      for (const p of pages) {
        const parsed = kindRegistry.page.schema.safeParse(p.payload);
        expect(parsed.success, `${preset} ${p.slug}`).toBe(true);
        const sections = (parsed.data as { sections: PageSection[] }).sections;
        for (const s of sections) {
          if (s.type === "feature_list") expect(s.items.length, `${p.slug} feature list is not empty`).toBeGreaterThan(0);
          if ((s.type === "content_collection" || s.type === "location_collection") && s.mode === "selected") expect(s.itemIds.length, `${p.slug} selected collection has choices`).toBeGreaterThan(0);
        }
      }
      const fresh = freshSnapshot(preset);
      const html = renderHome(fresh);
      expect(html).not.toMatch(emptyNotice);
      expect(html).toContain("Cedar Bend Guide");
      const r = validateManifest({ manifest: fresh, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
      expect(r.blockers).toEqual([]);
      // Publication names every slot that is left out, and the About page that has nothing yet.
      const leftOut = r.warnings.filter((w) => w.code === "section_left_out");
      expect(leftOut.length).toBeGreaterThanOrEqual(3);
      expect(leftOut.every((w) => w.href.includes("/content/") && w.message.includes("left out of the page"))).toBe(true);
      expect(r.warnings.some((w) => w.code === "page_empty" && w.itemTitle === "About")).toBe(true);
      expect(r.warnings.some((w) => w.code === "empty_collection")).toBe(false);
    });
  }

  it("renders the category chips and the directory collection once places exist, on both guide compositions", () => {
    const populated = freshSnapshot("community_guide", [place("a", "Eat & Drink"), place("b", "Trails"), place("c", "Eat & Drink")]);
    for (const theme of ["default", "magazine"] as const) {
      populated.config = { ...populated.config, design: { ...populated.config.design, theme } };
      const html = renderHome(populated);
      expect(html, theme).not.toMatch(emptyNotice);
      expect(html, theme).toContain('href="/demo/cedar-bend/places?category=Eat%20%26%20Drink"');
      expect(html, theme).toContain("Eat &amp; Drink");
      expect(html, theme).toMatch(/\(2\)|2 places/); // chips count on the guide, "2 places" in the magazine grid
      expect(html, theme).toContain("From the directory");
      expect(html, theme).toContain("Place a");
      expect(html, theme).not.toContain("Upcoming events");
      expect(html, theme).not.toContain("Latest articles");
    }
  });

  it("renders the location business starter home without placeholders and keeps the intro slot until written", () => {
    const fresh = freshSnapshot("location_business");
    for (const theme of ["default", "storefront"] as const) {
      fresh.config = { ...fresh.config, design: { ...fresh.config.design, theme } };
      const html = renderHome(fresh);
      expect(html, theme).not.toMatch(emptyNotice);
      expect(html, theme).not.toContain("About Cedar Bend Guide");
      expect(html, theme).toContain("Questions? Ask a store");
    }
  });
});

describe("the editor marks each slot", () => {
  it("says what fills a slot and what is left out until then", () => {
    expect(slotHint(section({ type: "rich_text" }))).toMatch(/left out of the public page until it has text/);
    expect(slotHint(section({ type: "rich_text", body: [{ type: "paragraph", text: "Words." }] }))).toBeNull();
    expect(slotHint(section({ type: "category_list" }))).toMatch(/categories of the published places/);
    expect(slotHint(section({ type: "content_collection", kind: "event", mode: "upcoming" }))).toMatch(/published events that are upcoming/);
    expect(slotHint(section({ type: "content_collection", kind: "place", mode: "selected" }))).toMatch(/No items chosen/);
    expect(slotHint(section({ type: "image_hero", heading: "Hi" }))).toMatch(/No image chosen/);
    expect(slotHint(section({ type: "text_hero", heading: "Hi" }))).toBeNull();
    expect(slotHint(section({ type: "faq" }))).toMatch(/Publication needs at least one/);
  });
});
