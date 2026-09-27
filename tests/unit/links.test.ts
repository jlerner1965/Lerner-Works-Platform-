import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { linkPayloadSchema, linkHost } from "@/modules/link";
import { kindRegistry, contentKinds, moduleIndexRoutes, routeFor } from "@/modules/registry";
import { presets } from "@/modules/presets";
import { siteConfigSchema } from "@/modules/site-config";
import { sectionSchema, pagePayloadSchema } from "@/modules/page";
import { resolveRoute } from "@/server/publishing/public-site";
import { searchSnapshot } from "@/server/publishing/search";
import { makeRenderContext, routeMetadata } from "@/server/publishing/render";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";
import { parseCsv, autoMap, rowToPayload } from "@/server/import/csv";
import { csvSpecs, templateCsv } from "@/server/import/csv-spec";
import { LinkCards, LinkIndex, OutsideLinkDetail, outsideLinkProps } from "@/themes/shared/links";
import { guideStyle } from "@/themes/guide/index";
import { getTheme } from "@/themes";
import { themesForPreset } from "@/themes/capabilities";

/**
 * Site-building programme B5-2: a link to another website as content. The schema, the
 * registry, the routes, the search index and the shared renderers, without a database.
 */
const config = siteConfigSchema.parse(presets.community_guide.config({ siteName: "Test Guide" }));

function link(id: string, title: string, url: string, category = ""): { id: string; payload: Record<string, unknown> } {
  return { id, payload: linkPayloadSchema.parse({ title, slug: id, summary: `Why we point to ${title}.`, url, category, lastVerifiedOn: "2026-09-20" }) as Record<string, unknown> };
}

function snapshot(links: Array<{ id: string; payload: Record<string, unknown> }>, withIndex = true): ReleaseSnapshot {
  const pages = presets.community_guide.initialPages({ siteName: "Test Guide" });
  const home = { ...(pages[0]!.payload as unknown as Record<string, unknown>), sections: [...((pages[0]!.payload as unknown as { sections: unknown[] }).sections), { id: "links", type: "content_collection", kind: "link", mode: "latest", limit: 6, heading: "Useful links", variant: "default", appearance: { background: "default", align: "start", width: "default" }, itemIds: [] }] };
  const items: ReleaseSnapshot["items"] = {
    // Section payloads are parsed as the manifest builder parses them: a version-6 snapshot carries every default.
    home: { id: "home", kind: "page", slug: "home", title: "Home", revisionId: "r1", revisionVersion: 1, payload: pagePayloadSchema.parse(home) as unknown as Record<string, unknown> },
    about: { id: "about", kind: "page", slug: "about", title: "About", revisionId: "r2", revisionVersion: 1, payload: pagePayloadSchema.parse(pages[1]!.payload) as unknown as Record<string, unknown> },
    contact: { id: "contact", kind: "page", slug: "contact", title: "Contact", revisionId: "r3", revisionVersion: 1, payload: pagePayloadSchema.parse(pages[2]!.payload) as unknown as Record<string, unknown> },
  };
  const routes: ReleaseSnapshot["routes"] = [
    { path: "/", kind: "page", itemId: "home" },
    { path: "/about", kind: "page", itemId: "about" },
    { path: "/contact", kind: "page", itemId: "contact" },
    { path: "/places", kind: "index", module: "places" },
    { path: "/events", kind: "index", module: "events" },
    { path: "/articles", kind: "index", module: "articles" },
    { path: "/search", kind: "search" },
  ];
  if (withIndex) routes.push({ path: "/links", kind: "index", module: "links" });
  for (const l of links) {
    items[l.id] = { id: l.id, kind: "link", slug: l.id, title: String(l.payload.title), revisionId: `r-${l.id}`, revisionVersion: 1, payload: l.payload };
    routes.push({ path: `/links/${l.id}`, kind: "link", itemId: l.id });
  }
  return {
    schemaVersion: 6,
    site: { id: "11111111-1111-4111-8111-111111111111", key: "test", name: "Test Guide", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: { email: "", phone: "", address: "" } },
    configRevisionId: "22222222-2222-4222-8222-222222222222",
    config,
    items,
    routes,
    redirects: [],
    media: {},
  };
}

const clock = new Date("2026-09-27T12:00:00Z");
const ctxFor = (s: ReleaseSnapshot, path: string, query: Record<string, string> = {}) => makeRenderContext({ snapshot: s, basePath: "/demo/test", mode: "demo", path, query, inquiryEndpoint: null, releaseVersion: 1, publishedAt: clock, now: clock });

describe("the link kind", () => {
  it("is a content kind of both presets with its own module, listing route and https-only address", () => {
    expect(contentKinds).toContain("link");
    expect(kindRegistry.link).toMatchObject({ label: "Link", plural: "Links", routeBase: "/links", module: "links", presets: ["community_guide", "location_business"] });
    expect(routeFor("link", "town-hall")).toBe("/links/town-hall");
    expect(moduleIndexRoutes.find((r) => r.module === "links")).toEqual({ module: "links", path: "/links", label: "Links" });
    expect(presets.community_guide.kinds).toContain("link");
    expect(presets.location_business.kinds).toContain("link");
    // The module is on for every configuration, including ones written before B5.
    expect(config.modules.links).toBe(true);
    expect(siteConfigSchema.parse({ ...config, modules: { places: true, events: true, articles: true, stores: false, services: false, inquiries: true } }).modules.links).toBe(true);
    expect(config.indexes.links).toEqual({ title: "", intro: "" });
    const parsed = linkPayloadSchema.parse({ title: "Town hall", slug: "town-hall", url: "https://www.pine-hollow.example/town-hall" });
    expect(parsed).toMatchObject({ category: "", ctaLabel: "", attachments: [], summary: "" });
    expect(linkPayloadSchema.safeParse({ title: "Bad", slug: "bad", url: "http://insecure.example" }).success).toBe(false);
    expect(linkPayloadSchema.safeParse({ title: "Bad", slug: "bad", url: "javascript:alert(1)" }).success).toBe(false);
    expect(linkPayloadSchema.safeParse({ title: "Bad", slug: "bad", url: "" }).success).toBe(false);
    expect(linkHost("https://www.pine-hollow.example/town-hall?x=1")).toBe("pine-hollow.example");
    expect(linkHost("not a url")).toBe("not a url");
    expect(sectionSchema.safeParse({ type: "content_collection", id: "c", kind: "link" }).success).toBe(true);
  });

  it("resolves the listing and the detail routes, names the listing, and indexes links for search with the host as meta", () => {
    const s = snapshot([link("town-hall", "Town hall", "https://www.pine-hollow.example/town-hall", "Town services"), link("trails", "Trails association", "https://trails.pine-hollow.example", "Partners")]);
    expect(resolveRoute(s, "/links")).toEqual({ type: "index", module: "links", kind: "link" });
    expect(resolveRoute(s, "/links/town-hall")).toMatchObject({ type: "detail", kind: "link" });
    expect(routeMetadata(s, resolveRoute(s, "/links")).title).toBe("Links · Test Guide");
    const results = searchSnapshot(s, { query: "trails", now: clock });
    expect(results[0]).toMatchObject({ path: "/links/trails", kind: "link", kindLabel: "Link", meta: "Partners · trails.pine-hollow.example" });
  });

  it("imports links from a sheet with the address required", () => {
    expect(csvSpecs.link.map((c) => c.key)).toEqual(["external_id", "title", "slug", "summary", "url", "category", "cta_label", "source_url", "last_verified_on", "body", "image", "image_alt", "attachments"]);
    const parsed = parseCsv(templateCsv("link"));
    const mapping = autoMap("link", parsed.headers);
    const row = rowToPayload("link", parsed.rows[0]!, mapping, { timeZone: "America/Denver" }, new Map());
    expect(row.errors).toEqual([]);
    expect(row.payload).toMatchObject({ url: "https://www.example.org/trail-maps", category: "Town services", ctaLabel: "Open the trail maps" });
    expect(linkPayloadSchema.safeParse(row.payload).success).toBe(true);
    const bad = rowToPayload("link", { ...parsed.rows[0]!, url: "ftp://files.example" }, mapping, { timeZone: "America/Denver" }, new Map());
    expect(bad.errors).toEqual(["url: use the full https:// address of the other website"]);
  });
});

describe("links on the public page", () => {
  const links = [link("town-hall", "Town hall", "https://www.pine-hollow.example/town-hall", "Town services"), link("trails", "Trails association", "https://trails.pine-hollow.example", "Partners"), link("weather", "Mountain weather", "https://weather.example/pine-hollow", "Town services")];

  it("renders cards that open the other website without a referrer and point at the link's own page", () => {
    const s = snapshot(links);
    const ctx = ctxFor(s, "/");
    const items = links.map((l) => s.items[l.id]!);
    expect(outsideLinkProps(items[0]!)).toEqual({ href: "https://www.pine-hollow.example/town-hall", rel: "noreferrer" });
    const html = renderToStaticMarkup(createElement(LinkCards, { ctx, items, style: guideStyle, columns: 3 }));
    expect(html).toContain('href="https://www.pine-hollow.example/town-hall" rel="noreferrer"');
    expect(html).toContain("(opens another website)");
    expect(html).toContain("Town services");
    expect(html).toContain("pine-hollow.example");
    expect(html).toContain('href="/demo/test/links/town-hall"');
    expect(html).toContain("About this link");
    expect(html).not.toContain("http://");
    const list = renderToStaticMarkup(createElement(LinkCards, { ctx, items, style: guideStyle, variant: "list" }));
    expect(list).toContain("Trails association");
    expect(renderToStaticMarkup(createElement(LinkCards, { ctx, items: [], style: guideStyle }))).toBe("");
  });

  it("renders the listing with a category filter and each link's own page with the button that opens it", () => {
    const s = snapshot(links);
    const index = renderToStaticMarkup(createElement(LinkIndex, { ctx: ctxFor(s, "/links"), style: guideStyle }));
    expect(index).toContain(">Links</h1>");
    expect(index).toContain("All (3)");
    expect(index).toContain('href="/demo/test/links?category=Partners"');
    expect(index).toContain("Mountain weather");
    const filtered = renderToStaticMarkup(createElement(LinkIndex, { ctx: ctxFor(s, "/links", { category: "Partners" }), style: guideStyle }));
    expect(filtered).toContain("Trails association");
    expect(filtered).not.toContain("Mountain weather");
    const empty = renderToStaticMarkup(createElement(LinkIndex, { ctx: ctxFor(s, "/links", { category: "Nothing" }), style: guideStyle }));
    expect(empty).toContain("Nothing matches this category.");
    const detail = renderToStaticMarkup(createElement(OutsideLinkDetail, { ctx: ctxFor(s, "/links/town-hall"), item: s.items["town-hall"]!, style: guideStyle }));
    expect(detail).toContain(">Town hall</h1>");
    expect(detail).toContain("Visit pine-hollow.example");
    expect(detail).toContain('href="https://www.pine-hollow.example/town-hall" rel="noreferrer"');
    expect(detail).toContain("Town services · pine-hollow.example");
    expect(detail).toContain("September 20, 2026");
    expect(detail).toContain('href="/demo/test/links"');
    const labelled = { ...s.items["town-hall"]!, payload: { ...s.items["town-hall"]!.payload, ctaLabel: "Open the town hall site" } };
    expect(renderToStaticMarkup(createElement(OutsideLinkDetail, { ctx: ctxFor(s, "/links/town-hall"), item: labelled, style: guideStyle }))).toContain("Open the town hall site");
  });

  it("renders links under every composition of both presets, and the search form offers the kind only when links exist", () => {
    const s = snapshot(links);
    for (const theme of themesForPreset("community_guide")) {
      const themed: ReleaseSnapshot = { ...s, config: { ...s.config, design: { ...s.config.design, theme: theme.key } } };
      for (const path of ["/", "/links", "/links/trails", "/search"]) {
        const html = renderToStaticMarkup(getTheme(themed).render(ctxFor(themed, path), resolveRoute(themed, path)));
        expect(html.length, `${theme.key} ${path}`).toBeGreaterThan(500);
        if (path !== "/search") expect(html, `${theme.key} ${path}`).toContain('rel="noreferrer"');
        if (path === "/search") expect(html, `${theme.key} search`).toContain('<option value="link">Links</option>');
      }
    }
    const retail = siteConfigSchema.parse(presets.location_business.config({ siteName: "Test Retail" }));
    const retailSnapshot: ReleaseSnapshot = { ...s, site: { ...s.site, preset: "location_business" }, config: retail, routes: s.routes.filter((r) => !["/places", "/events", "/articles"].includes(r.path)) };
    for (const theme of themesForPreset("location_business")) {
      const themed: ReleaseSnapshot = { ...retailSnapshot, config: { ...retail, design: { ...retail.design, theme: theme.key } } };
      for (const path of ["/links", "/links/trails"]) {
        const html = renderToStaticMarkup(getTheme(themed).render(ctxFor(themed, path), resolveRoute(themed, path)));
        expect(html, `${theme.key} ${path}`).toContain('rel="noreferrer"');
        expect(html, `${theme.key} ${path}`).toContain(`${theme.key}-theme`);
      }
    }
    const none = snapshot([], false);
    expect(renderToStaticMarkup(getTheme(none).render(ctxFor(none, "/search"), resolveRoute(none, "/search")))).not.toContain('value="link"');
  });
});
