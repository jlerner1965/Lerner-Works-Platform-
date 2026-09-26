import { afterAll, describe, expect, it } from "vitest";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { seedInfo, withUser, endPool, adminClient, approveAll, publish } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { parseCsv, autoMap, dryRun, applyImport } from "@/server/import/csv";
import { templateCsv } from "@/server/import/csv-spec";
import { exportSitePackage, dryRunPackage, applyPackage } from "@/server/import/package";
import { createSiteFromPreset } from "@/server/data/sites";
import { createHash } from "node:crypto";

const { users, sites, organizations } = seedInfo();
const owner = users.owner;

afterAll(async () => {
  await endPool();
});

const storesCsv = `external_id,title,slug,summary,address_line1,locality,region,postal_code,phone,time_zone,status,hours_mon,hours_tue,hours_wed,hours_thu,hours_fri,hours_sat,hours_sun,services
CSV-1,Range Athletics Loveland,loveland,Compact store near the lake with a full bike counter and weekend fittings.,100 Lake Drive,Loveland,CO,80537,(970) 555-0101,America/Denver,open,09:00-18:00,09:00-18:00,09:00-18:00,09:00-18:00,09:00-20:00,08:00-18:00,closed,bike-service;shoe-fitting
CSV-2,Range Athletics Greeley,greeley,Small storefront focused on team outfitting for the northern schools.,55 8th Avenue,Greeley,CO,80631,(970) 555-0102,America/Denver,open,10:00-19:00,10:00-19:00,10:00-19:00,10:00-19:00,10:00-19:00,10:00-17:00,closed,team-outfitting
CSV-3,,broken,Missing title and bad hours,1 Nowhere,Nowhere,CO,,,America/Denver,open,9-5,,,,,,,
CSV-1,Duplicate id,dup,Same external id twice in one file.,2 Dup Street,Loveland,CO,80537,,America/Denver,open,,,,,,,,
`;

describe("CSV import (PORT-01, PORT-02)", () => {
  it("reports exact row findings in the dry run and writes nothing", async () => {
    const parsed = parseCsv(storesCsv);
    const mapping = autoMap("store", parsed.headers);
    expect(mapping.external_id).toBe("external_id");
    const before = await withUser(owner, (db) => db`select id from public.content_items where site_id = ${sites.rangeAthletics}`);
    const result = await withUser(owner, async (db) => dryRun(db, (await loadSiteContext(db, sites.rangeAthletics))!.site, "store", parsed, mapping));
    expect(result.counts).toMatchObject({ create: 2, error: 2, total: 4 });
    const bad = result.rows.find((r) => r.row === 4)!;
    expect(bad.action).toBe("error");
    expect(bad.errors.join(" ")).toMatch(/title is required/);
    expect(bad.errors.join(" ")).toMatch(/hours_mon/);
    expect(result.rows.find((r) => r.row === 5)!.errors.join(" ")).toMatch(/appears more than once/);
    const after = await withUser(owner, (db) => db`select id from public.content_items where site_id = ${sites.rangeAthletics}`);
    expect(after.length).toBe(before.length);
  });

  it("applies valid rows as drafts and does not duplicate on a repeated import", async () => {
    const parsed = parseCsv(storesCsv);
    const mapping = autoMap("store", parsed.headers);
    const first = await withUser(owner, async (db) => {
      const site = (await loadSiteContext(db, sites.rangeAthletics))!.site;
      const dry = await dryRun(db, site, "store", parsed, mapping);
      return applyImport(db, site, "store", owner, dry);
    });
    expect(first).toMatchObject({ created: 2, updated: 0 });
    const second = await withUser(owner, async (db) => {
      const site = (await loadSiteContext(db, sites.rangeAthletics))!.site;
      const dry = await dryRun(db, site, "store", parsed, mapping);
      expect(dry.counts).toMatchObject({ create: 0, update: 0, skip: 2, error: 2 });
      return applyImport(db, site, "store", owner, dry);
    });
    expect(second).toMatchObject({ created: 0, updated: 0 });
    const rows = await withUser(owner, (db) => db<{ externalId: string; slug: string; state: string | null }[]>`
      select i.external_id, r.slug, (select rv.state::text from public.reviews rv where rv.revision_id = r.id order by rv.created_at desc limit 1) as state
      from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${sites.rangeAthletics} and i.external_id like 'CSV-%' order by 1`);
    expect(rows.map((r) => r.externalId)).toEqual(["CSV-1", "CSV-2"]);
    expect(rows.every((r) => r.state === null)).toBe(true); // drafts, unreviewed
    // An update in the file becomes a new revision, still without duplicates.
    const changed = storesCsv.replace("Compact store near the lake", "Compact store by the lake");
    const third = await withUser(owner, async (db) => {
      const site = (await loadSiteContext(db, sites.rangeAthletics))!.site;
      const p = parseCsv(changed);
      const dry = await dryRun(db, site, "store", p, autoMap("store", p.headers));
      expect(dry.counts).toMatchObject({ create: 0, update: 1, skip: 1 });
      return applyImport(db, site, "store", owner, dry);
    });
    expect(third).toMatchObject({ updated: 1 });
    expect(parseCsv(templateCsv("event")).rows.length).toBe(1);
  });

  it("rejects oversized inputs", () => {
    const big = "external_id,title\n" + Array.from({ length: 501 }, (_, i) => `X-${i},Title ${i}`).join("\n");
    expect(() => parseCsv(big)).toThrow(/501 rows/);
  });
});

describe("portable site package (PORT-03)", () => {
  it("exports pilot A and imports it into a fresh site C with matching counts, references, text and asset hashes", async () => {
    await approveAll(owner, sites.pineHollow);
    await publish(owner, sites.pineHollow, "before export").catch(() => undefined);
    const zip = await withUser(owner, async (db) => exportSitePackage(db, (await loadSiteContext(db, sites.pineHollow))!.site));
    const entries = unzipSync(zip);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]!)) as { counts: { items: number; media: number }; files: Array<{ path: string; sha256: string }> };
    expect(manifest.counts.items).toBeGreaterThanOrEqual(27);
    expect(manifest.counts.media).toBeGreaterThanOrEqual(19);
    expect(Object.keys(entries).some((p) => /password|token|secret|inquir|member/i.test(p))).toBe(false);
    for (const f of manifest.files) expect(createHash("sha256").update(entries[f.path]!).digest("hex")).toBe(f.sha256);
    expect(strFromU8(entries["README.md"]!)).toContain("Not included");

    const { siteId: siteC } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: `pine-hollow-copy-${Date.now().toString(36)}`, name: "Pine Hollow Copy", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
    // Starter pages (home/about/contact) that the package also contains are replaced, not duplicated.
    const exportedPageSlugs = Object.keys(entries).filter((p) => p.startsWith("content/page/")).map((p) => String((JSON.parse(strFromU8(entries[p]!)) as { payload: { slug: string } }).payload.slug));
    const expectedAdopted = exportedPageSlugs.filter((s) => ["home", "about", "contact"].includes(s)).length;
    const applied = await withUser(owner, async (db) => {
      const site = (await loadSiteContext(db, siteC))!.site;
      const dry = await dryRunPackage(db, site, zip);
      expect(dry.errors).toEqual([]);
      expect(dry.summary.adoptablePages).toBe(expectedAdopted);
      return applyPackage(db, site, owner, dry);
    });
    expect(applied.items).toBe(manifest.counts.items);
    expect(applied.media).toBe(manifest.counts.media);
    expect(applied.adoptedPages).toBe(expectedAdopted);

    const admin = adminClient();
    try {
      const [a] = await admin<{ items: number; media: number }[]>`select (select count(*)::int from public.content_items where site_id = ${sites.pineHollow}) as items, (select count(*)::int from public.media_assets where site_id = ${sites.pineHollow} and status = 'ready') as media`;
      const [c] = await admin<{ items: number; media: number }[]>`select (select count(*)::int from public.content_items where site_id = ${siteC}) as items, (select count(*)::int from public.media_assets where site_id = ${siteC} and status = 'ready') as media`;
      expect(c!.items).toBe(a!.items + (3 - expectedAdopted));
      expect(c!.media).toBe(a!.media);
      // Text matches and relationships resolve inside site C (an event's venue points at a site-C place).
      const [event] = await admin<{ payload: Record<string, unknown> }[]>`select r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteC} and i.kind = 'event' and r.slug = 'larkspur-loop-volunteer-trail-day'`;
      const venueId = event!.payload.venueItemId as string;
      const [venue] = await admin<{ siteId: string; kind: string }[]>`select site_id, kind::text from public.content_items where id = ${venueId}`;
      expect(venue).toMatchObject({ siteId: siteC, kind: "place" });
      const [text] = await admin<{ summary: string }[]>`select r.payload->>'summary' as summary from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteC} and r.slug = 'creekside-coffee-roasters'`;
      expect(text!.summary).toContain("Small-batch roaster");
      // Featured image reference resolves to a site-C asset whose derivative bytes hash equals the exported file.
      const [place] = await admin<{ img: string }[]>`select r.payload->>'featuredImageAssetId' as img from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteC} and r.slug = 'creekside-coffee-roasters'`;
      const [asset] = await admin<{ siteId: string; sha256: string }[]>`select site_id, sha256 from public.media_assets where id = ${place!.img}`;
      expect(asset!.siteId).toBe(siteC);
      const exported = Object.keys(entries).find((p) => p.startsWith("media/") && p.endsWith("meta.json") && strFromU8(entries[p]!).includes("Creekside Coffee Roasters storefront"))!;
      const meta = JSON.parse(strFromU8(entries[exported]!)) as { sha256: string };
      expect(asset!.sha256).toBe(meta.sha256);
      // Site C has no domains, members or inquiries from the package.
      const [extra] = await admin<{ domains: number; inquiries: number }[]>`select (select count(*)::int from public.domains where site_id = ${siteC}) as domains, (select count(*)::int from public.inquiries where site_id = ${siteC}) as inquiries`;
      expect(extra).toEqual({ domains: 0, inquiries: 0 });
      // Imported content is unreviewed draft: the only reviews in site C are the approvals on save of its three
      // starter pages (B1), and none sits on the revision the import wrote for an adopted page.
      const [reviews] = await admin<{ total: number; onCurrent: number }[]>`select (select count(*)::int from public.reviews where site_id = ${siteC}) as total, (select count(*)::int from public.reviews rv join public.content_items i on i.current_revision_id = rv.revision_id where rv.site_id = ${siteC}) as on_current`;
      expect(reviews).toEqual({ total: 3, onCurrent: 3 - expectedAdopted });
    } finally {
      await admin.end();
    }
    // Tampered package is refused.
    const tampered = new Uint8Array(zip);
    const bad = await withUser(owner, async (db) => dryRunPackage(db, (await loadSiteContext(db, siteC))!.site, unzipTamper(tampered)));
    expect(bad.errors.length).toBeGreaterThan(0);
  });
});

function unzipTamper(zip: Uint8Array): Uint8Array {
  // Re-zip with one content file altered so its checksum no longer matches the manifest.
  const entries = unzipSync(zip);
  const first = Object.keys(entries).find((p) => p.startsWith("content/"))!;
  const doc = JSON.parse(strFromU8(entries[first]!)) as { payload: { title: string } };
  doc.payload.title = "Tampered";
  entries[first] = new TextEncoder().encode(JSON.stringify(doc));
  return zipSync(entries);
}
