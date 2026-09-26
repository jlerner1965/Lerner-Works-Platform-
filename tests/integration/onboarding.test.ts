import { afterAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import sharp from "sharp";
import { seedInfo, withUser, endPool } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { createSiteFromPreset, getCurrentSiteConfig } from "@/server/data/sites";
import { dryRunOnboarding, applyOnboarding } from "@/server/import/onboarding";
import { parseCsv, autoMap, dryRun } from "@/server/import/csv";

/** Site-building programme B2-2 (SB-04): an onboarding package takes a fresh site to publishable content, images and settings in one import. */
const { users, organizations } = seedInfo();
const owner = users.owner;

afterAll(async () => {
  await endPool();
});

const png = (colour: string) => sharp({ create: { width: 800, height: 600, channels: 3, background: colour } }).png().toBuffer();
const csv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n") + "\r\n";

async function guidePackage(): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {
    "README.md": strToU8("filled in"),
    "places.csv": strToU8(csv([
      ["external_id", "title", "category", "summary", "address_line1", "locality", "body", "image", "image_alt"],
      ["P-1", "Cedar Bend Bakery", "Bakery", "Sourdough, rye and morning pastries baked before dawn.", "12 Main Street", "Cedar Bend", "The oven is lit at four.\n\nBread is on the counter by seven.", "bakery.jpg", "The bakery's front window at dawn"],
      ["P-2", "Riverstone Books", "Bookshop", "New and used books with a regional shelf.", "40 Main Street", "Cedar Bend", "", "", ""],
      ["P-3", "North Fork Outfitters", "Outdoor gear", "Rentals and repairs for the trails and the river.", "3 Mill Road", "Cedar Bend", "", "", ""],
      ["P-4", "", "Bakery", "A row without a title is listed and skipped.", "", "", "", "", ""],
    ])),
    "events.csv": strToU8(csv([
      ["external_id", "title", "starts_at", "ends_at", "venue_text", "summary"],
      ["E-1", "Harvest market", "2027-10-02 09:00", "2027-10-02 14:00", "Main Street", "Stalls from the valley's growers, music at noon."],
    ])),
    "articles.csv": strToU8(csv([
      ["external_id", "title", "author_name", "published_on", "summary", "body", "image"],
      ["A-1", "Trail day recap", "Maya Ortiz", "2026-09-01", "Forty volunteers, three miles of trail, one long lunch.", "## Why we went\n\nThe Larkspur loop had washed out in May.\n\n- Forty volunteers\n- Three miles", "trail.png"],
    ])),
    "images.csv": strToU8(csv([
      ["file", "alt_text", "title", "license", "attribution", "source_url", "decorative"],
      ["trail.png", "Volunteers rebuilding a washed-out section of trail", "Trail day", "Owned by the client", "Maya Ortiz", "", "no"],
      ["bakery.jpg", "", "Bakery storefront", "Owned by the client", "", "", "no"],
      ["logo.png", "Cedar Bend Guide", "Logo", "Owned by the client", "", "", "no"],
    ])),
    "site.csv": strToU8(csv([
      ["key", "value", "notes"],
      ["tagline", "Shops, trails and the people who keep the town going", "ignored"],
      ["description", "A guide to Cedar Bend's shops, trails and events.", ""],
      ["contact_email", "hello@cedarbend.example", ""],
      ["contact_phone", "(303) 555-0100", ""],
      ["primary_color", "#1F4E3D", ""],
      ["accent_color", "#8a3b12", ""],
      ["typography", "classic-serif", ""],
      ["logo", "logo.png", ""],
      ["hero_image", "trail.png", ""],
      ["home_subheading", "Everything worth knowing about Cedar Bend, in one place.", ""],
      ["home_intro", "Cedar Bend sits where the river leaves the canyon.\n\nThis guide is kept by the people who live here.", ""],
      ["about_text", "## Who keeps this guide\n\nA handful of neighbours.", ""],
      ["nonsense", "x", "unknown keys are ignored with a warning"],
    ])),
    "images/trail.png": new Uint8Array(await png("#2f5d3a")),
    "images/bakery.jpg": new Uint8Array(await sharp({ create: { width: 800, height: 600, channels: 3, background: "#a4502b" } }).jpeg().toBuffer()),
    "images/logo.png": new Uint8Array(await png("#25302a")),
  };
  return zipSync(files, { level: 6 });
}

describe("onboarding package for a community guide", () => {
  it("dry-runs every sheet, image and setting without writing, then applies all of it in one import, approved for the owner", async () => {
    const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: `onb-${Date.now().toString(36)}`, name: "Cedar Bend Guide", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
    const bytes = await guidePackage();
    const dry = await withUser(owner, async (db) => dryRunOnboarding(db, (await loadSiteContext(db, siteId))!.site, bytes, { canApplySettings: true }));
    expect(dry.errors).toEqual([]);
    expect(dry.summary).toMatchObject({ items: 5, images: 3, settings: 12, rowErrors: 1 });
    expect(dry.kinds.map((k) => k.kind)).toEqual(["place", "event", "article"]);
    expect(dry.kinds[0]!.rows.find((r) => r.externalId === "P-4")?.errors).toContain("title is required");
    // The bakery's alternative text comes from its row; the logo's from images.csv; unknown settings are warned about.
    expect(dry.images.find((i) => i.file === "bakery.jpg")?.alt).toBe("The bakery's front window at dawn");
    expect(dry.images.find((i) => i.file === "logo.png")).toMatchObject({ alt: "Cedar Bend Guide", license: "Owned by the client" });
    expect(dry.warnings).toEqual(expect.arrayContaining([expect.stringContaining('"nonsense" is not a setting')]));
    expect(dry.warnings.some((w) => w.includes("no alternative text"))).toBe(false);
    const before = await withUser(owner, (db) => db<{ n: number }[]>`select count(*)::int as n from public.content_items where site_id = ${siteId}`);
    expect(before[0]!.n).toBe(3); // starter pages only: the dry run wrote nothing

    const applied = await withUser(owner, async (db) => applyOnboarding(db, (await loadSiteContext(db, siteId))!.site, owner, dry, { approve: true, applySettings: true }));
    expect(applied).toMatchObject({ created: 5, updated: 0, skipped: 0, images: 3, approved: true, pages: ["home", "about"] });
    expect(applied.settings).toEqual(expect.arrayContaining(["tagline", "description", "primary_color", "accent_color", "typography", "logo", "contact_email", "contact_phone", "hero_image", "home_subheading", "home_intro", "about_text"]));

    await withUser(owner, async (db) => {
      const items = await db<{ kind: string; slug: string; payload: Record<string, unknown>; state: string | null }[]>`
        select i.kind::text, r.slug, r.payload, (select rv.state::text from public.reviews rv where rv.revision_id = r.id order by rv.created_at desc limit 1) as state
        from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} order by i.kind, r.slug`;
      expect(items.every((i) => i.state === "approved")).toBe(true);
      const bakery = items.find((i) => i.slug === "cedar-bend-bakery")!;
      expect(bakery.payload.category).toBe("Bakery");
      expect(bakery.payload.body).toEqual([{ type: "paragraph", text: "The oven is lit at four." }, { type: "paragraph", text: "Bread is on the counter by seven." }]);
      const assets = await db<{ id: string; title: string; altText: string | null; license: string | null; width: number }[]>`select id, title, alt_text, license, width from public.media_assets where site_id = ${siteId} order by title`;
      expect(assets.map((a) => a.title)).toEqual(["Bakery storefront", "Logo", "Trail day"]);
      expect(assets.every((a) => a.altText && a.license === "Owned by the client" && a.width === 800)).toBe(true);
      expect(bakery.payload.featuredImageAssetId).toBe(assets.find((a) => a.title === "Bakery storefront")!.id);
      const article = items.find((i) => i.slug === "trail-day-recap")!;
      expect(article.payload.featuredImageAssetId).toBe(assets.find((a) => a.title === "Trail day")!.id);
      expect((article.payload.body as unknown[]).length).toBe(3);
      const event = items.find((i) => i.slug === "harvest-market")!;
      expect(event.payload.timeZone).toBe("America/Denver");
      // Settings: configuration revision, contact details, starter pages.
      const config = (await getCurrentSiteConfig(db, siteId))!.config;
      expect(config.branding).toMatchObject({ tagline: "Shops, trails and the people who keep the town going", typography: "classic-serif", logoAssetId: assets.find((a) => a.title === "Logo")!.id });
      expect(config.branding.colors).toMatchObject({ primary: "#1f4e3d", accent: "#8a3b12" });
      expect(config.metadata.defaultDescription).toBe("A guide to Cedar Bend's shops, trails and events.");
      const [site] = await db<{ contactEmail: string; contactPhone: string }[]>`select contact_email, contact_phone from public.sites where id = ${siteId}`;
      expect(site).toEqual({ contactEmail: "hello@cedarbend.example", contactPhone: "(303) 555-0100" });
      const home = items.find((i) => i.slug === "home")!;
      const sections = home.payload.sections as Array<Record<string, unknown>>;
      expect(sections[0]).toMatchObject({ type: "image_hero", subheading: "Everything worth knowing about Cedar Bend, in one place.", imageAssetId: assets.find((a) => a.title === "Trail day")!.id });
      expect((sections.find((s) => s.type === "rich_text")!.body as unknown[]).length).toBe(2);
      const about = items.find((i) => i.slug === "about")!;
      expect((about.payload.sections as Array<Record<string, unknown>>)[0]!.body).toEqual([{ type: "heading", level: 2, text: "Who keeps this guide" }, { type: "paragraph", text: "A handful of neighbours." }]);
    });

    // A second dry run of the same package sees the rows as updates (the images would be uploaded again) and the settings again.
    const again = await withUser(owner, async (db) => dryRunOnboarding(db, (await loadSiteContext(db, siteId))!.site, bytes, { canApplySettings: true }));
    expect(again.errors).toEqual([]);
    expect(again.kinds[0]!.counts).toMatchObject({ create: 0, update: 1, skip: 2, error: 1 });
  });

  it("refuses what does not belong: foreign sheets, bad colours, files that are not images, and an image column in a plain CSV import", async () => {
    const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: `onb2-${Date.now().toString(36)}`, name: "Refusals", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
    const site = await withUser(owner, async (db) => (await loadSiteContext(db, siteId))!.site);
    const bad = zipSync({
      "stores.csv": strToU8("external_id,title\r\nS,Not a guide kind\r\n"),
      "site.csv": strToU8("key,value\r\nprimary_color,green\r\ntypography,comic\r\nlogo,missing.png\r\n"),
      "images/notes.png": strToU8("this is text, not a picture"),
      "images/bad name!.png": strToU8("x"),
    });
    const dry = await withUser(owner, (db) => dryRunOnboarding(db, site, bad, { canApplySettings: true }));
    expect(dry.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("Unexpected file in package: stores.csv"),
      expect.stringContaining("images/bad name!.png"),
    ]));
    // Path problems stop the run before content is looked at; a package with only content problems reports them all.
    const bad2 = zipSync({
      "site.csv": strToU8("key,value\r\nprimary_color,green\r\ntypography,comic\r\nlogo,missing.png\r\n"),
      "images/notes.png": strToU8("this is text, not a picture"),
    });
    const dry2 = await withUser(owner, (db) => dryRunOnboarding(db, site, bad2, { canApplySettings: true }));
    expect(dry2.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("images/notes.png is not a JPEG, PNG or WebP image"),
      expect.stringContaining("primary_color: use a 6-digit hex colour"),
      expect.stringContaining("typography: use one of"),
      expect.stringContaining('logo: no file named "missing.png"'),
    ]));
    await expect(withUser(owner, (db) => applyOnboarding(db, site, owner, dry2, { approve: true, applySettings: true }))).rejects.toThrow(/validation errors/);
    // Colours that would fail the publication gate's contrast pairings are refused by the dry run (B4), naming the pairing.
    const pale = zipSync({ "site.csv": strToU8("key,value\r\naccent_color,#c98a2e\r\nbackground_color,#fbf7f0\r\n") });
    const dry4 = await withUser(owner, (db) => dryRunOnboarding(db, site, pale, { canApplySettings: true }));
    expect(dry4.errors).toEqual(expect.arrayContaining([expect.stringMatching(/site\.csv: colours: Links and accent text on the background \(#c98a2e on #fbf7f0\) reads at 2\.7\d:1; the minimum is 4\.5:1/)]));
    const dark = zipSync({ "site.csv": strToU8("key,value\r\naccent_color,#8f5312\r\nbackground_color,#fbf7f0\r\n") });
    expect((await withUser(owner, (db) => dryRunOnboarding(db, site, dark, { canApplySettings: true }))).errors).toEqual([]);
    // Without the owner, the settings sheet is announced as skipped.
    const dry3 = await withUser(owner, (db) => dryRunOnboarding(db, site, zipSync({ "site.csv": strToU8("key,value\r\ntagline,Hello\r\n") }), { canApplySettings: false }));
    expect(dry3.errors).toEqual([]);
    expect(dry3.warnings.some((w) => w.includes("needs an organization owner"))).toBe(true);
    // A plain CSV import cannot name an image.
    const parsed = parseCsv("external_id,title,category,image\r\nP-9,Somewhere,Cafe,photo.jpg\r\n");
    const plain = await withUser(owner, (db) => dryRun(db, site, "place", parsed, autoMap("place", parsed.headers)));
    expect(plain.rows[0]!.errors).toEqual([expect.stringContaining("images come with the onboarding package")]);
  });
});

describe("onboarding package for a location business", () => {
  it("imports services before the stores that list them, resolving the references", async () => {
    const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.rangeAthletics, key: `onb3-${Date.now().toString(36)}`, name: "Northfork Outfitters", preset: "location_business", timeZone: "America/Denver", mode: "demo", contact: {} });
    const bytes = zipSync({
      "services.csv": strToU8(csv([["external_id", "title", "summary"], ["SV-1", "Shoe fitting", "Half an hour on the treadmill with a fitter."], ["SV-2", "Bike service", "Tune-ups and repairs, same week."]])),
      "stores.csv": strToU8(csv([["external_id", "title", "address_line1", "locality", "region", "services", "hours_mon"], ["ST-1", "Northfork Longmont", "1 Main Street", "Longmont", "CO", "shoe-fitting;bike-service", "09:00-18:00"], ["ST-2", "Northfork Boulder", "2 Pearl Street", "Boulder", "CO", "shoe-fitting;no-such-service", ""]])),
    });
    const site = await withUser(owner, async (db) => (await loadSiteContext(db, siteId))!.site);
    const dry = await withUser(owner, (db) => dryRunOnboarding(db, site, bytes, { canApplySettings: true }));
    expect(dry.errors).toEqual([]);
    expect(dry.kinds.map((k) => k.kind)).toEqual(["service", "store"]);
    const stores = dry.kinds[1]!;
    expect(stores.rows.find((r) => r.externalId === "ST-1")?.action).toBe("create");
    expect(stores.rows.find((r) => r.externalId === "ST-2")?.errors).toEqual([expect.stringContaining('no service with slug "no-such-service"')]);
    const applied = await withUser(owner, (db) => applyOnboarding(db, site, owner, dry, { approve: false, applySettings: true }));
    expect(applied).toMatchObject({ created: 3, images: 0, approved: false, settings: [], pages: [] });
    await withUser(owner, async (db) => {
      const [store] = await db<{ payload: { serviceItemIds: string[] } }[]>`select r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and i.external_id = 'ST-1'`;
      const services = await db<{ id: string; slug: string }[]>`select i.id, r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and i.kind = 'service' order by r.slug`;
      expect(services.map((s) => s.slug)).toEqual(["bike-service", "shoe-fitting"]);
      expect([...store!.payload.serviceItemIds].sort()).toEqual(services.map((s) => s.id).sort());
      const reviews = await db<{ n: number }[]>`select count(*)::int as n from public.reviews rv join public.content_items i on i.id = rv.item_id where i.site_id = ${siteId} and i.kind <> 'page'`;
      expect(reviews[0]!.n).toBe(0); // imported without approval: drafts
    });
  });
});
