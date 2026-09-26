import { describe, expect, it } from "vitest";
import { resolveRoute, normalizePublicPath, normalizeHost } from "@/server/publishing/public-site";
import { validateManifest } from "@/server/publishing/validate";
import { summarizeChanges } from "@/server/publishing/diff";
import { searchSnapshot } from "@/server/publishing/search";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";
import { presets } from "@/modules/presets";
import { siteConfigSchema } from "@/modules/site-config";

const config = siteConfigSchema.parse(presets.community_guide.config({ siteName: "Test Guide" }));

function snapshot(overrides: Partial<ReleaseSnapshot> = {}): ReleaseSnapshot {
  const home = presets.community_guide.initialPages({ siteName: "Test Guide" })[0]!;
  return {
    schemaVersion: 1,
    site: { id: "11111111-1111-4111-8111-111111111111", key: "test", name: "Test Guide", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: { email: "", phone: "", address: "" } },
    configRevisionId: "22222222-2222-4222-8222-222222222222",
    config,
    items: {
      home: { id: "home", kind: "page", slug: "home", title: "Home", revisionId: "r1", revisionVersion: 1, payload: home.payload as unknown as Record<string, unknown> },
      about: { id: "about", kind: "page", slug: "about", title: "About", revisionId: "r2", revisionVersion: 1, payload: { ...(presets.community_guide.initialPages({ siteName: "Test Guide" })[1]!.payload as unknown as Record<string, unknown>) } },
      contact: { id: "contact", kind: "page", slug: "contact", title: "Contact", revisionId: "r3", revisionVersion: 1, payload: { ...(presets.community_guide.initialPages({ siteName: "Test Guide" })[2]!.payload as unknown as Record<string, unknown>) } },
      p1: { id: "p1", kind: "place", slug: "creek-cafe", title: "Creek Café", revisionId: "r4", revisionVersion: 1, payload: { schemaVersion: 1, title: "Creek Café", slug: "creek-cafe", summary: "Coffee and pastries by the creek, open early.", body: [], featuredImageAssetId: null, metaTitle: "", metaDescription: "", indexable: true, sourceUrl: "", lastVerifiedOn: "2026-09-01", attribution: "", category: "Eat & Drink", address: { line1: "", line2: "", locality: "Pine Hollow", region: "CO", postalCode: "", approved: false }, areaDescription: "", website: "", phone: "", hours: null, nextAction: { label: "", path: "" } } },
    },
    routes: [
      { path: "/", kind: "page", itemId: "home" },
      { path: "/about", kind: "page", itemId: "about" },
      { path: "/contact", kind: "page", itemId: "contact" },
      { path: "/places", kind: "index", module: "places" },
      { path: "/events", kind: "index", module: "events" },
      { path: "/articles", kind: "index", module: "articles" },
      { path: "/search", kind: "search" },
      { path: "/places/creek-cafe", kind: "place", itemId: "p1" },
    ],
    redirects: [{ from: "/places/old-cafe", to: "/places/creek-cafe" }],
    media: {},
    ...overrides,
  };
}

describe("public route resolution", () => {
  it("resolves pages, details, indexes, redirects and 404s from the snapshot only", () => {
    const s = snapshot();
    expect(resolveRoute(s, "/").type).toBe("page");
    expect(resolveRoute(s, "/places/creek-cafe")).toMatchObject({ type: "detail", kind: "place" });
    expect(resolveRoute(s, "/places")).toMatchObject({ type: "index", kind: "place" });
    expect(resolveRoute(s, "/places/old-cafe")).toEqual({ type: "redirect", to: "/places/creek-cafe" });
    expect(resolveRoute(s, "/nope").type).toBe("not_found");
  });
  it("normalizes paths and hosts", () => {
    expect(normalizePublicPath(["places", "creek-cafe"])).toBe("/places/creek-cafe");
    expect(normalizePublicPath(undefined)).toBe("/");
    expect(normalizeHost("Example.COM:443")).toBe("example.com");
    expect(normalizeHost("bad host")).toBeNull();
    expect(normalizeHost("../etc")).toBeNull();
  });
});

describe("manifest validation", () => {
  const now = new Date("2026-09-26T00:00:00Z");
  it("passes a consistent manifest with only warnings", () => {
    const r = validateManifest({ manifest: snapshot(), notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    expect(r.blockers).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("missing_site_description");
  });
  it("blocks duplicate routes, missing navigation targets and broken links", () => {
    const s = snapshot();
    s.routes.push({ path: "/about", kind: "page", itemId: "contact" });
    s.config = { ...s.config, navigation: { items: [{ label: "Ghost", path: "/ghost" }, { label: "Partner", path: "https://partner.example/hub" }], showSearch: true, cta: { label: "", path: "" } } };
    (s.items.home!.payload.sections as Array<Record<string, unknown>>)[0]!.ctaPath = "/missing";
    const r = validateManifest({ manifest: s, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    const codes = r.blockers.map((b) => b.code);
    expect(codes).toContain("duplicate_route");
    expect(codes).toContain("missing_nav_target");
    expect(codes).toContain("broken_link");
    // External https links are allowed in navigation and are not checked against routes.
    expect(r.blockers.filter((b) => b.code === "missing_nav_target").map((b) => b.message)).toEqual([expect.stringContaining("/ghost")]);
    expect(r.blockers.every((b) => b.href.startsWith("/app/sites/"))).toBe(true);
  });
  it("blocks pages that depend on a disabled module and reports the dependent page", () => {
    const s = snapshot();
    s.config = { ...s.config, modules: { ...s.config.modules, events: false } };
    s.routes = s.routes.filter((r) => r.path !== "/events");
    s.config.navigation.items = s.config.navigation.items.filter((n) => n.path !== "/events");
    const r = validateManifest({ manifest: s, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    const dep = r.blockers.find((b) => b.code === "module_disabled_dependency");
    expect(dep?.itemId).toBe("home");
  });
  it("blocks missing image alternatives, unlicensed assets and failing brand contrast", () => {
    const s = snapshot({ media: { m1: { id: "m1", hash: "h", width: 1200, height: 800, alt: "", decorative: false, title: "Photo", attribution: "", license: "", variants: {} } } });
    s.config = { ...s.config, branding: { ...s.config.branding, colors: { primary: "#ffffff", accent: "#eeeeee", background: "#ffffff", text: "#dddddd" } } };
    const r = validateManifest({ manifest: s, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    const codes = r.blockers.map((b) => b.code);
    expect(codes).toContain("missing_alt");
    expect(codes).toContain("unlicensed_asset");
    const contrast = r.blockers.filter((b) => b.code === "contrast");
    expect(contrast.length).toBeGreaterThanOrEqual(3);
    expect(contrast.map((b) => b.message)).toEqual(expect.arrayContaining([expect.stringContaining("Body text on the background"), expect.stringContaining("Links and accent text on the background")]));
    expect(contrast.every((b) => b.field === "branding.colors" && b.href.endsWith("/settings"))).toBe(true);
  });
  it("blocks an accent colour whose buttons cannot carry readable text, and names the pairing", () => {
    const s = snapshot();
    // #8a8a8a: white reads at 3.3:1 and near-black at 5.8:1, so buttons get dark text and pass;
    // but as link text on the cream background it fails.
    s.config = { ...s.config, branding: { ...s.config.branding, colors: { ...s.config.branding.colors, accent: "#8a8a8a" } } };
    const r = validateManifest({ manifest: s, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    const contrast = r.blockers.filter((b) => b.code === "contrast").map((b) => b.message);
    expect(contrast.some((m) => m.includes("Links and accent text on the background"))).toBe(true);
    expect(contrast.some((m) => m.includes("Text on accent buttons"))).toBe(false);
  });
  it("warns about stale verification dates without blocking", () => {
    const s = snapshot();
    s.items.p1!.payload.lastVerifiedOn = "2024-01-01";
    const r = validateManifest({ manifest: s, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    expect(r.warnings.some((w) => w.code === "stale_verification" && w.itemId === "p1")).toBe(true);
    expect(r.blockers).toEqual([]);
  });
});

describe("change summary", () => {
  it("describes added, changed and removed items and slug redirects in words", () => {
    const base = snapshot();
    const next = snapshot();
    next.items.p1 = { ...next.items.p1!, revisionId: "r5", revisionVersion: 2, slug: "creek-cafe-2", payload: { ...next.items.p1!.payload, slug: "creek-cafe-2", summary: "New summary text that is long enough." } };
    next.routes = next.routes.map((r) => (r.itemId === "p1" ? { ...r, path: "/places/creek-cafe-2" } : r));
    next.redirects = [{ from: "/places/creek-cafe", to: "/places/creek-cafe-2" }];
    delete next.items.about;
    next.routes = next.routes.filter((r) => r.itemId !== "about");
    const s = summarizeChanges(base, next);
    expect(s.changed[0]).toMatchObject({ title: "Creek Café", fields: ["Slug", "Summary"] });
    expect(s.removed.map((r) => r.title)).toEqual(["About"]);
    expect(s.newRedirects).toEqual([{ from: "/places/creek-cafe", to: "/places/creek-cafe-2" }]);
    expect(s.removedRoutes).toEqual(["/about", "/places/creek-cafe"]);
  });
});

describe("search", () => {
  it("matches titles and categories from the published snapshot only", () => {
    const s = snapshot();
    const results = searchSnapshot(s, { query: "cafe", now: new Date() });
    expect(results.map((r) => r.path)).toEqual(["/places/creek-cafe"]);
    expect(searchSnapshot(s, { query: "eat", now: new Date() })[0]?.title).toBe("Creek Café");
    expect(searchSnapshot(s, { query: "nonexistentword", now: new Date() })).toEqual([]);
    expect(searchSnapshot(s, { query: "cafe", kind: "event", now: new Date() })).toEqual([]);
  });
});
