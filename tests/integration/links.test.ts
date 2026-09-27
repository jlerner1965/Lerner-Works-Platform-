import { afterAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { seedInfo, withUser, endPool, approveAll, publish, demoSnapshot } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { createSiteFromPreset, getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { createContentItem, getItem, saveRevision } from "@/server/data/content";
import { buildCandidate } from "@/server/publishing/candidates";
import { parseCsv, autoMap, dryRun, applyImport } from "@/server/import/csv";
import { getTheme } from "@/themes";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { searchSnapshot } from "@/server/publishing/search";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";

/**
 * Site-building programme B5-2 (SB-11): links to other websites as content. Created like any
 * item, published into routes of their own and a listing that exists only while a link is
 * published, rendered as cards that open the other site, and imported from a sheet.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;

afterAll(async () => {
  await endPool();
});

const clock = new Date("2026-09-27T12:00:00Z");
function render(snapshot: ReleaseSnapshot, siteKey: string, path: string): string {
  const basePath = `/demo/${siteKey}`;
  const ctx = makeRenderContext({ snapshot, basePath, mode: "demo", path, query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: clock, now: clock });
  return renderToStaticMarkup(getTheme(snapshot).render(ctx, resolveRoute(snapshot, path)));
}
const csv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n") + "\r\n";

describe("links to other websites (SB-11)", () => {
  it("publishes links into their own routes and a listing that appears with the first link, renders them as outside anchors, and drops them with the module", async () => {
    const siteKey = `links-${Date.now().toString(36)}`;
    const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: siteKey, name: "Link tests", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
    const site = (await withUser(owner, (db) => loadSiteContext(db, siteId)))!.site;

    // A fresh site has the module on but no links: no listing route (D-021 applied to the listing).
    await approveAll(owner, siteId);
    await publish(owner, siteId, "starter");
    const first = (await demoSnapshot(siteKey))!.snapshot as unknown as ReleaseSnapshot;
    expect(first.config.modules.links).toBe(true);
    expect(first.routes.some((r) => r.path === "/links")).toBe(false);

    const townHall = await withUser(owner, (db) => createContentItem(db, { siteId, organizationId: site.organizationId, kind: "link", authorId: owner, payload: { title: "Town hall", slug: "town-hall", summary: "Permits, minutes and the snow route in force this winter.", url: "https://www.pine-hollow.example/town-hall", category: "Town services", lastVerifiedOn: "2026-09-20" } }));
    await withUser(owner, (db) => createContentItem(db, { siteId, organizationId: site.organizationId, kind: "link", authorId: owner, payload: { title: "Trails association", slug: "trails-association", summary: "Trail conditions and volunteer days.", url: "https://trails.pine-hollow.example", category: "Partners", ctaLabel: "Open the trail conditions" } }));
    // The home page lists the links in a collection section.
    const home = await withUser(owner, async (db) => {
      const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and r.slug = 'home'`;
      return (await getItem(db, row!.id))!;
    });
    const sections = [...(home.revision.payload.sections as Array<Record<string, unknown>>), { id: "s-links", type: "content_collection", kind: "link", mode: "latest", limit: 6, heading: "Useful links" }];
    await withUser(owner, (db) => saveRevision(db, { itemId: home.item.id, baseRevisionId: home.revision.id, payload: { ...home.revision.payload, sections }, authorId: owner }));
    await approveAll(owner, siteId);
    await publish(owner, siteId, "links");
    const snapshot = (await demoSnapshot(siteKey))!.snapshot as unknown as ReleaseSnapshot;
    expect(snapshot.routes.filter((r) => r.path.startsWith("/links")).map((r) => r.path).sort()).toEqual(["/links", "/links/town-hall", "/links/trails-association"]);
    expect(resolveRoute(snapshot, "/links")).toEqual({ type: "index", module: "links", kind: "link" });

    const indexHtml = render(snapshot, siteKey, "/links");
    expect(indexHtml).toContain('href="https://www.pine-hollow.example/town-hall" rel="noreferrer"');
    expect(indexHtml).toContain('href="https://trails.pine-hollow.example" rel="noreferrer"');
    expect(indexHtml).toContain("Town services");
    expect(indexHtml).toContain('href="/demo/' + siteKey + '/links/town-hall"');
    const detailHtml = render(snapshot, siteKey, "/links/trails-association");
    expect(detailHtml).toContain("Open the trail conditions");
    expect(detailHtml).toContain('href="https://trails.pine-hollow.example" rel="noreferrer"');
    const homeHtml = render(snapshot, siteKey, "/");
    expect(homeHtml).toContain("Useful links");
    expect(homeHtml).toContain('href="https://www.pine-hollow.example/town-hall" rel="noreferrer"');
    expect(homeHtml).not.toContain("http://");
    expect(searchSnapshot(snapshot, { query: "permits", now: clock })[0]).toMatchObject({ path: "/links/town-hall", kind: "link", meta: "Town services · pine-hollow.example" });

    // A navigation entry to the listing is an ordinary route check, and the module switch removes every link route.
    const current = (await withUser(owner, (db) => getCurrentSiteConfig(db, siteId)))!;
    const off = structuredClone(current.config);
    off.modules.links = false;
    off.navigation.items.push({ label: "Links", path: "/links" });
    await withUser(owner, (db) => saveSiteConfig(db, { siteId, organizationId: site.organizationId, baseRevisionId: current.id, config: off, authorId: owner, changeNote: "links off" }));
    const blocked = await buildCandidate(owner, site);
    expect(blocked.candidate.state).toBe("blocked");
    expect(blocked.candidate.validation.blockers.map((b) => b.code)).toContain("missing_nav_target");
    expect(blocked.candidate.manifest.routes.some((r) => r.path.startsWith("/links"))).toBe(false);
    // With the section still on the home page, publication says the module it depends on is off.
    expect(blocked.candidate.validation.blockers.map((b) => b.code)).toContain("module_disabled_dependency");
    void townHall;
  });

  it("imports links from links.csv with the address required and the same external-id matching as every other kind", async () => {
    const siteKey = `links-csv-${Date.now().toString(36)}`;
    const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.rangeAthletics, key: siteKey, name: "Link import", preset: "location_business", timeZone: "America/Denver", mode: "demo", contact: {} });
    const sheet = parseCsv(csv([
      ["external_id", "title", "url", "category", "cta_label", "summary", "last_verified_on"],
      ["L-1", "Ridgeline Footwear", "https://ridgeline.example", "Brands we fit", "See the range", "The trail shoes most of our fittings end with.", "2026-09-01"],
      ["L-2", "Boulder Cycle Works", "https://cycleworks.example/service", "Partners", "", "Frame repairs we send out.", ""],
      ["L-3", "No address", "", "", "", "A link without an address is listed and skipped.", ""],
      ["L-4", "Insecure", "http://plain.example", "", "", "Only https addresses are accepted.", ""],
    ]));
    const result = await withUser(owner, async (db) => {
      const site = (await loadSiteContext(db, siteId))!.site;
      const dry = await dryRun(db, site, "link", sheet, autoMap("link", sheet.headers));
      expect(dry.counts).toMatchObject({ create: 2, error: 2, total: 4 });
      expect(dry.rows.find((r) => r.externalId === "L-3")?.errors).toEqual(["url: use the full https:// address of the other website"]);
      expect(dry.rows.find((r) => r.externalId === "L-4")?.errors).toEqual(["url: use the full https:// address of the other website"]);
      return applyImport(db, site, "link", owner, dry, { approve: true });
    });
    expect(result).toMatchObject({ created: 2, updated: 0, approved: true });
    const rows = await withUser(owner, (db) => db<{ externalId: string; payload: Record<string, unknown> }[]>`select i.external_id, r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and i.kind = 'link' order by 1`);
    expect(rows.map((r) => [r.externalId, r.payload.url, r.payload.category, r.payload.ctaLabel])).toEqual([["L-1", "https://ridgeline.example", "Brands we fit", "See the range"], ["L-2", "https://cycleworks.example/service", "Partners", ""]]);
    await publish(owner, siteId, "imported links");
    const snapshot = (await demoSnapshot(siteKey))!.snapshot as unknown as ReleaseSnapshot;
    expect(snapshot.routes.filter((r) => r.kind === "link").length).toBe(2);
    expect(render(snapshot, siteKey, "/links")).toContain('href="https://ridgeline.example" rel="noreferrer"');
  });
});
