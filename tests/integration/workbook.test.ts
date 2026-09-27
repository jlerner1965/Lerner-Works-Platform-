import { afterAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import sharp from "sharp";
import { seedInfo, withUser, endPool } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { createSiteFromPreset, getCurrentSiteConfig } from "@/server/data/sites";
import { dryRunOnboarding, applyOnboarding, buildOnboardingTemplate } from "@/server/import/onboarding";
import { readWorkbook, writeWorkbook } from "@/server/import/xlsx";
import { renderSimplePdf } from "@/server/demo/documents";

/**
 * Site-building programme B5-3 (SB-12): the onboarding workbook. One Excel file, uploaded on
 * its own or inside the package with the images and documents folders, goes through the same
 * dry run and import as the CSV sheets it stands for.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;

afterAll(async () => {
  await endPool();
});

async function site(prefix: string) {
  const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: `${prefix}-${Date.now().toString(36)}`, name: "Workbook tests", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
  return (await withUser(owner, (db) => loadSiteContext(db, siteId)))!.site;
}

describe("the onboarding workbook (SB-12)", () => {
  it("imports a workbook uploaded on its own, with Excel's dates and numbers read as the sheets expect", async () => {
    const target = await site("wb-alone");
    const workbook = writeWorkbook([
      { name: "Read me", rows: [["Filled in by the client."]] },
      { name: "Places", rows: [
        ["external_id", "title", "category", "summary", "address_line1", "locality", "postal_code", "last_verified_on", "hours_mon", "body"],
        ["P-1", "Cedar Bend Bakery", "Eat & Drink", "Sourdough, rye and morning pastries baked before dawn.", "12 Main Street", "Cedar Bend", "80999", "2026-09-18", "07:00-14:00", "The oven is lit at four.\n\nBread is on the counter by seven."],
        ["P-2", "Riverstone Books", "Shops", "New and used books with a regional shelf.", "40 Main Street", "Cedar Bend", "80999", "", "", ""],
      ] },
      { name: "Events", rows: [["external_id", "title", "starts_at", "ends_at", "venue_text", "summary"], ["E-1", "Harvest market", "2027-10-02 09:00", "2027-10-02 14:00", "Main Street", "Stalls from the valley's growers, music at noon."]] },
      { name: "Links", rows: [["external_id", "title", "url", "category", "summary"], ["L-1", "Town of Cedar Bend", "https://www.cedar-bend.example", "Town services", "Permits, minutes and the snow route."]] },
      { name: "Site", rows: [["key", "value", "notes"], ["tagline", "Shops, trails and the people who keep the town going", ""], ["home_subheading", "Everything worth knowing about Cedar Bend.", ""]] },
    ]);
    // The upload route wraps a bare workbook exactly like this.
    const dry = await withUser(owner, (db) => dryRunOnboarding(db, target, zipSync({ "content.xlsx": workbook }), { canApplySettings: true }));
    expect(dry.errors).toEqual([]);
    expect(dry.workbook?.sheets.map((s) => [s.name, s.file, s.rows])).toEqual([["Read me", null, 1], ["Places", "places.csv", 2], ["Events", "events.csv", 1], ["Links", "links.csv", 1], ["Site", "site.csv", 2]]);
    expect(dry.summary).toMatchObject({ items: 4, images: 0, documents: 0, settings: 2, rowErrors: 0 });
    expect(dry.kinds.map((k) => k.kind)).toEqual(["place", "event", "link"]);
    const applied = await withUser(owner, (db) => applyOnboarding(db, target, owner, dry, { approve: true, applySettings: true }));
    expect(applied).toMatchObject({ created: 4, images: 0, documents: 0, pages: ["home"] });
    const rows = await withUser(owner, (db) => db<{ externalId: string; kind: string; payload: Record<string, unknown> }[]>`select i.external_id, i.kind::text, r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${target.id} and i.external_id is not null order by 1`);
    expect(rows.map((r) => [r.externalId, r.kind])).toEqual([["E-1", "event"], ["L-1", "link"], ["P-1", "place"], ["P-2", "place"]]);
    const bakery = rows.find((r) => r.externalId === "P-1")!.payload;
    expect(bakery.lastVerifiedOn).toBe("2026-09-18");
    expect((bakery.address as { postalCode: string }).postalCode).toBe("80999");
    expect((bakery.hours as { mon: unknown[] }).mon).toEqual([{ open: "07:00", close: "14:00", closesNextDay: false }]);
    expect(rows.find((r) => r.externalId === "L-1")!.payload.url).toBe("https://www.cedar-bend.example");
    const config = (await withUser(owner, (db) => getCurrentSiteConfig(db, target.id)))!;
    expect(config.config.branding.tagline).toBe("Shops, trails and the people who keep the town going");
  });

  it("reads the workbook inside a package with its images and documents folders, and refuses a sheet given both ways", async () => {
    const target = await site("wb-pkg");
    const png = new Uint8Array(await sharp({ create: { width: 800, height: 600, channels: 3, background: "#2f5d3a" } }).png().toBuffer());
    const workbook = writeWorkbook([
      { name: "Articles", rows: [["external_id", "title", "author_name", "published_on", "summary", "image", "attachments"], ["A-1", "Plan your visit", "Cedar Bend Guide", "2026-09-01", "Everything to print before you come.", "trail.png", "guide.pdf"]] },
      { name: "Images", rows: [["file", "alt_text", "title", "license", "attribution", "source_url", "decorative"], ["trail.png", "Volunteers on the trail", "Trail day", "Owned by the client", "", "", "no"]] },
      { name: "Documents", rows: [["file", "title", "license", "attribution", "source_url"], ["guide.pdf", "Visitor guide", "Owned by the client", "", ""]] },
    ]);
    const files = { "content.xlsx": workbook, "images/trail.png": png, "documents/guide.pdf": renderSimplePdf({ title: "Visitor guide", lines: ["Where to park."] }) };
    const dry = await withUser(owner, (db) => dryRunOnboarding(db, target, zipSync(files), { canApplySettings: true }));
    expect(dry.errors).toEqual([]);
    expect(dry.summary).toMatchObject({ items: 1, images: 1, documents: 1 });
    expect(dry.images[0]).toMatchObject({ file: "trail.png", alt: "Volunteers on the trail", license: "Owned by the client" });
    expect(dry.documents[0]).toMatchObject({ file: "guide.pdf", title: "Visitor guide" });
    const applied = await withUser(owner, (db) => applyOnboarding(db, target, owner, dry, { approve: true, applySettings: true }));
    expect(applied).toMatchObject({ created: 1, images: 1, documents: 1 });
    const article = await withUser(owner, (db) => db<{ payload: Record<string, unknown> }[]>`select r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${target.id} and i.external_id = 'A-1'`);
    expect(article[0]!.payload.featuredImageAssetId).toMatch(/^[0-9a-f-]{36}$/);
    expect((article[0]!.payload.attachments as unknown[]).length).toBe(1);
    // The same sheet as a CSV file and in the workbook is refused; two workbooks are refused; a workbook the preset cannot use is refused.
    const both = await withUser(owner, (db) => dryRunOnboarding(db, target, zipSync({ ...files, "articles.csv": strToU8("external_id,title\r\nA-9,Loose\r\n") }), { canApplySettings: true }));
    expect(both.errors).toEqual(["content.xlsx and articles.csv both carry the same sheet; keep one of them."]);
    const two = await withUser(owner, (db) => dryRunOnboarding(db, target, zipSync({ "content.xlsx": workbook, "more.xlsx": workbook }), { canApplySettings: true }));
    expect(two.errors[0]).toContain("2 workbooks");
    const wrong = await withUser(owner, (db) => dryRunOnboarding(db, target, zipSync({ "content.xlsx": writeWorkbook([{ name: "Stores", rows: [["external_id", "title"], ["S-1", "Shop"]] }]) }), { canApplySettings: true }));
    expect(wrong.errors).toEqual([expect.stringContaining("content.xlsx: Sheet \"Stores\" holds stores, which are not a content kind of the Community guide preset.")]);
  });

  it("dry-runs the downloaded template as it is, with its example rows and no errors", async () => {
    const target = await site("wb-template");
    const template = buildOnboardingTemplate("community_guide", "Cedar Bend Guide");
    const dry = await withUser(owner, (db) => dryRunOnboarding(db, target, template, { canApplySettings: true }));
    // The example rows import (one per kind); the Images and Documents examples name files the folders do not hold and are warned about, not refused.
    expect(dry.errors).toEqual([]);
    expect(dry.summary.items).toBe(4);
    expect(dry.warnings).toEqual(expect.arrayContaining([expect.stringContaining('"storefront.jpg", which is not in the images folder'), expect.stringContaining('"menu.pdf", which is not in the documents folder')]));
    expect(readWorkbook(template.length ? (await import("fflate")).unzipSync(template)["content.xlsx"]! : template).map((s) => s.name)).toContain("Places");
  });
});
