import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { emails, signIn } from "./fixtures";
import { Recorder, type TaskCount } from "./recorder";

/**
 * Site-building programme B4, the proof: two realistic client sites built end to end through
 * the dashboard exactly as a person would, with real photography. Each build is counted per
 * task (screens, fields, actions) and timed; the published sites are captured at 390, 768 and
 * 1440 under the composition chosen for the build and under the preset's other two. The
 * counts, times and captures land in docs/evidence/proof/ and are the material of the
 * acceptance row for the programme's bar; the person's own timing is the owner's, on
 * production, with the same packages (`pnpm proof:package`).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(900_000);
// A control that cannot be found fails the step in half a minute rather than at the build's own limit.
test.use({ actionTimeout: 30_000 });

const evidence = "docs/evidence/proof";
/** The captures are committed evidence only when asked for (PROOF_EVIDENCE=1); a routine run keeps them out of the repository. */
const captureRoot = process.env.PROOF_EVIDENCE ? evidence : ".data/proof-captures";
const packages = ".data/proof";
const widths = [390, 768, 1440];
/** The preset's other compositions are captured at the phone and desktop widths only. */
const otherWidths = [390, 1440];

test.beforeAll(() => {
  fs.mkdirSync(evidence, { recursive: true });
  fs.mkdirSync(packages, { recursive: true });
  for (const key of ["cedar-bend", "bookcliff"]) execFileSync("pnpm", ["exec", "tsx", "scripts/proof-package.ts", "--site", key, "--out", path.join(packages, `${key}.zip`)], { stdio: "inherit" });
});

interface Capture { page: string; width: number; file: string; status: number }

/** Captures the listed public pages at each width, refusing horizontal overflow and console errors, as the screenshot pass does. */
async function capture(browser: Browser, base: string, pages: Array<{ name: string; path: string }>, outDir: string, at: number[] = widths): Promise<Capture[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const rows: Capture[] = [];
  for (const p of pages) {
    for (const width of at) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      const response = await page.goto(`${base}${p.path}`);
      const status = response?.status() ?? 0;
      expect(status, `${p.path} at ${width}`).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      // Walk down the page so lazily loaded pictures below the fold are fetched before the capture, as the screenshot pass does.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `${p.path} overflows at ${width}px`).toBe(false);
      expect(errors, `${p.path} console errors at ${width}px`).toEqual([]);
      // JPEG: the pages are photographs, and a full-page PNG of one would be several megabytes.
      const file = path.join(outDir, `${p.name}-${width}.jpg`);
      await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 82 });
      rows.push({ page: p.name, width, file: path.relative(captureRoot, file), status });
      await context.close();
    }
  }
  return rows;
}

const designCard = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Design", exact: true }) });

/** A field's label exactly, with or without the editor's required marker (" *"). */
const labelled = (name: string): RegExp => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`);

async function saveTheme(page: Page, siteId: string, themeLabel: string): Promise<void> {
  await page.goto(`/app/sites/${siteId}/look`);
  await designCard(page).getByRole("combobox", { name: "Theme", exact: true }).selectOption({ label: themeLabel });
  await designCard(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();
}

async function publishNow(page: Page, siteId: string): Promise<string> {
  await page.goto(`/app/sites/${siteId}/publishing`);
  await page.getByRole("button", { name: "Publish now" }).click();
  const note = page.getByText(/Published as release v\d+\b/);
  await expect(note).toBeVisible();
  return (await note.textContent()) ?? "";
}

/** Opens the editor of a starter page from the Pages list, as a person does. */
async function openPage(rec: Recorder, page: Page, nav: Locator, title: string): Promise<void> {
  await rec.follow(nav.getByRole("link", { name: "Pages", exact: true }));
  await rec.follow(page.getByRole("link", { name: title, exact: true }).first());
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
}

/** Adds a section of the given type at the end of the page and returns its editor. */
async function addSection(rec: Recorder, page: Page, type: string, label: string): Promise<Locator> {
  await rec.choose(page.locator("#add-section"), type);
  const section = page.locator("ol > li", { hasText: label }).last();
  await expect(section).toBeVisible();
  return section;
}

/** Presses the section list's "Move section N down" until the section at `from` (1-based) sits at `to`. */
async function moveSectionDown(rec: Recorder, page: Page, from: number, to: number): Promise<void> {
  for (let i = from; i < to; i++) await rec.press(page.getByRole("button", { name: `Move section ${i} down`, exact: true }));
}

async function saveEditor(rec: Recorder, page: Page): Promise<void> {
  await rec.press(page.getByRole("button", { name: "Save", exact: true }));
  await expect(page.getByText(/Saved version \d+.*It is approved/)).toBeVisible();
}

async function importPackage(rec: Recorder, page: Page, nav: Locator, key: string, expectRows: RegExp): Promise<void> {
  await rec.follow(nav.getByRole("link", { name: "Import & export", exact: true }));
  const form = page.locator("form", { has: page.locator('input[name="type"][value="onboarding"]') });
  await rec.attach(form.locator('input[type="file"]'), { name: `${key}.zip`, mimeType: "application/zip", buffer: fs.readFileSync(path.join(packages, `${key}.zip`)) });
  await rec.press(form.getByRole("button", { name: "Upload and run dry run" }));
  rec.arrive();
  await expect(page.getByText(expectRows)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("The package is well-formed. Nothing has been written.")).toBeVisible();
  await rec.press(page.getByRole("button", { name: /^Import \d+ row\(s\), \d+ image\(s\) and \d+ setting\(s\)$/ }));
  await expect(page.getByText(/Import applied/)).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText(/approved and go out with the next publish/)).toBeVisible();
}

interface SiteResult { key: string; name: string; siteId: string; composition: string; tasks: TaskCount[]; totals: Omit<TaskCount, "task">; captures: Record<string, Capture[]>; releases: string[] }
const results: SiteResult[] = [];

test("Cedar Bend Guide: a community guide built end to end through the dashboard, counted and timed (B4)", async ({ page, browser }) => {
  const rec = new Recorder(page);
  const key = `cedar-bend-${Date.now().toString(36)}`;
  await signIn(page, emails.owner);
  const nav = page.getByRole("navigation", { name: "Dashboard" });

  rec.start("Create the site");
  await rec.open("/app/sites/new");
  await rec.fill(page.getByLabel("Site name"), "Cedar Bend Guide");
  await page.getByLabel("Internal key").fill(key); // set by hand only so repeated runs never collide; not counted
  await rec.fill(page.getByLabel("Contact email"), "hello@cedarbend.example");
  await rec.press(page.getByRole("button", { name: "Create site" }));
  rec.arrive();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  const siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;

  rec.start("Import the package (brand, contact details, 19 places, 7 events, 6 articles, 50 pictures, the home and About text)");
  await importPackage(rec, page, nav, "cedar-bend", /Dry run: 32 row\(s\) to import, 50 image\(s\), 17 setting\(s\)/);

  rec.start("Choose the composition");
  await rec.follow(nav.getByRole("link", { name: "Look", exact: true }));
  await rec.choose(designCard(page).getByRole("combobox", { name: "Theme", exact: true }), { label: "Magazine (feature-led)" });
  await rec.press(designCard(page).getByRole("button", { name: "Save", exact: true }));
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();

  rec.start("Compose the home page (collage hero, two picture rows, a photo band, two quotations, the editors, the members)");
  await openPage(rec, page, nav, "Home");
  const hero = page.locator("ol > li", { hasText: "Image hero" }).first();
  await rec.choose(hero.getByLabel(labelled("Style")), "collage");
  for (const [i, title] of ["Downtown under the peaks", "The valley from the mesa", "Alta Lake at noon"].entries()) {
    await rec.press(hero.getByRole("button", { name: "Add picture" }));
    await rec.choose(hero.getByLabel(`Picture ${i + 2}`, { exact: true }), { label: title });
  }
  const rows = await addSection(rec, page, "image_text", "Image and text rows");
  await rec.fill(rows.getByLabel("Heading (optional)"), "How the guide works");
  const rowData = [
    { picture: "A block of Main Street", heading: "Checked in person", text: "Every listing carries the date someone from the guide last stood in the doorway, and the source of what it says. Nothing is copied from a directory or inferred from a category.", button: "", link: "" },
    { picture: "The lower meadows", heading: "Honest about the unknowns", text: "If the bakery has not confirmed its winter Mondays, the listing shows no hours rather than a guess, and asks you to call ahead. A cancelled event stays visible so nobody drives out for it.", button: "Send a correction", link: "/contact" },
  ];
  for (const [i, r] of rowData.entries()) {
    await rec.press(rows.getByRole("button", { name: "Add row" }));
    const row = rows.locator("ul > li").nth(i);
    await rec.choose(row.getByLabel("Picture", { exact: true }), { label: r.picture });
    await rec.fill(row.getByLabel(labelled("Heading")), r.heading);
    await rec.fill(row.getByLabel(labelled("Text")), r.text);
    if (r.button) {
      await rec.fill(row.getByLabel("Button label (optional)", { exact: true }), r.button);
      await rec.fill(row.getByLabel("Button link", { exact: true }), r.link);
    }
  }
  const band = await addSection(rec, page, "image_band", "Photo band");
  await rec.fill(band.getByLabel(labelled("Heading")), "Elk are back in the lower meadows");
  await rec.fill(band.getByLabel("Text (optional)"), "The herd moves through the meadows below town from late September. Where to look, and how not to be the person who gets too close.");
  await rec.choose(band.getByLabel("Picture", { exact: true }), { label: "Elk in the lower meadows" });
  await rec.choose(band.getByLabel("Colour wash"), "dark");
  await rec.fill(band.getByLabel("Button label (optional)", { exact: true }), "Where to watch");
  await rec.fill(band.getByLabel("Button link", { exact: true }), "/articles/elk-are-back-in-the-lower-meadows");
  const quotes = await addSection(rec, page, "quotes", "Quotes");
  await rec.fill(quotes.getByLabel(labelled("Heading")), "From people who live here");
  const quoteData = [
    { text: "The guide is the only place that tells you the Mercantile closes at noon on Wednesdays. Everything else online is a guess.", who: "Mateo Ortiz", role: "Runs the coffee cart (fictional)", portrait: "Mateo Ortiz" },
    { text: "When the trail day got rained out, the listing said so within the hour. That is why people trust it.", who: "Dana Whitlock", role: "Owns the bookshop (fictional)", portrait: "Dana Whitlock" },
  ];
  for (const [i, q] of quoteData.entries()) {
    await rec.press(quotes.getByRole("button", { name: "Add quotation" }));
    const item = quotes.locator("ul > li").nth(i);
    await rec.fill(item.getByLabel("Quotation"), q.text);
    await rec.fill(item.getByLabel("Who said it"), q.who);
    await rec.fill(item.getByLabel("Their role or place (optional)"), q.role);
    await rec.choose(item.getByLabel("Portrait (optional)"), { label: q.portrait });
  }
  const team = await addSection(rec, page, "team", "People");
  await rec.fill(team.getByLabel(labelled("Heading")), "The editors");
  await rec.fill(team.getByLabel("Introduction (optional)"), "Three residents keep the guide honest, on their own time. All three are fictional.");
  const people = [
    { name: "Nora Vance", role: "Editor", words: "Walks every trail listing twice a year and keeps the verification dates." },
    { name: "Eli Marsh", role: "Photographs and maps", words: "Draws the trail maps sold at the Mercantile." },
    { name: "Priya Kaur", role: "Events desk", words: "Talks to every organizer before a listing goes up." },
  ];
  for (const [i, person] of people.entries()) {
    await rec.press(team.getByRole("button", { name: "Add person" }));
    const item = team.locator("ul > li").nth(i);
    await rec.fill(item.getByLabel(labelled("Name")), person.name);
    await rec.fill(item.getByLabel("Role (optional)"), person.role);
    await rec.choose(item.getByLabel("Portrait (optional)"), { label: person.name });
    await rec.fill(item.getByLabel("A few words (optional)"), person.words);
  }
  const logos = await addSection(rec, page, "logo_strip", "Logo strip");
  await rec.fill(logos.getByLabel("Heading (optional)"), "Members of");
  const marks = [
    { title: "Cedar Bend Trails Council mark", link: "https://cedarbendtrails.example" },
    { title: "Valley Growers mark", link: "" },
    { title: "Cedar Bend Chamber mark", link: "" },
    { title: "Town of Cedar Bend mark", link: "" },
  ];
  for (const [i, mark] of marks.entries()) {
    await rec.press(logos.getByRole("button", { name: "Add logo" }));
    const item = logos.locator("ul > li").nth(i);
    await rec.choose(item.getByLabel("Logo", { exact: true }), { label: mark.title });
    if (mark.link) await rec.fill(item.getByLabel("Link (optional)"), mark.link);
  }
  // The starter's contact callout (section 7 of 7) stays the last section of the twelve.
  await moveSectionDown(rec, page, 7, 12);
  await saveEditor(rec, page);

  rec.start("Compose the About page (offset hero, gallery with the lightbox)");
  await openPage(rec, page, nav, "About");
  const aboutHero = await addSection(rec, page, "image_hero", "Image hero");
  await rec.choose(aboutHero.getByLabel(labelled("Style")), "offset");
  await rec.fill(aboutHero.getByLabel(labelled("Heading")), "About the guide");
  await rec.fill(aboutHero.getByLabel("Subheading"), "Who writes it, how listings are checked, and what this demonstration is and is not.");
  await rec.choose(aboutHero.getByLabel("Hero image"), { label: "Downtown under the peaks" });
  await rec.press(page.getByRole("button", { name: "Move section 2 up", exact: true }));
  const gallery = await addSection(rec, page, "gallery", "Gallery");
  await rec.fill(gallery.getByLabel(labelled("Heading")), "The valley through the year");
  await rec.check(gallery.getByLabel("Open each picture at full size when it is clicked"));
  const pictures: Array<[string, string]> = [
    ["Trout Lake in October", "Trout Lake, the first week of October"],
    ["Alta Lake at noon", "Alta Lake on a still day"],
    ["Dusk over the valley", "Dusk from the reservoir road"],
    ["The valley in colour", "The valley at the end of September"],
    ["Aspens along the high road", "The aspens on the high road"],
    ["The peaks from Sunset Ridge", "The peaks from Sunset Ridge"],
  ];
  for (const [i, [title, caption]] of pictures.entries()) {
    await rec.press(gallery.getByRole("button", { name: "Add image" }));
    const item = gallery.locator("ul > li").nth(i);
    await rec.choose(item.getByLabel("Image", { exact: true }), { label: title });
    await rec.fill(item.getByLabel("Caption (optional)"), caption);
  }
  await saveEditor(rec, page);

  rec.start("Add an event from the list");
  await rec.follow(nav.getByRole("link", { name: "Events", exact: true }));
  const quick = page.locator("form", { has: page.getByText("Add an event") });
  await rec.fill(quick.getByLabel("Title"), "Library talk: the flood of 1911");
  await rec.press(quick.getByRole("button", { name: "Add event" }));
  rec.arrive();
  await rec.fill(page.getByLabel("Starts (local date and time)"), "2026-11-05T19:00");
  await rec.fill(page.getByLabel("Ends (local date and time)"), "2026-11-05T20:30");
  await rec.fill(page.getByLabel("Venue text (if not a listed place)"), "Cedar Bend Public Library, 320 Sixth Avenue");
  await rec.fill(page.getByLabel("Organizer", { exact: true }), "Cedar Bend Public Library");
  await rec.fill(page.getByRole("textbox", { name: "Summary", exact: true }), "The county archivist on the night Bear Creek took the lower bridge, with photographs from the library's collection.");
  await saveEditor(rec, page);

  rec.start("Publish");
  await rec.follow(nav.getByRole("link", { name: "Publish", exact: true }));
  await expect(page.getByText("First release")).toBeVisible();
  await rec.press(page.getByRole("button", { name: "Publish now" }));
  await expect(page.getByText(/Published as release v1\b/)).toBeVisible();
  rec.finish();

  // The result, as a visitor sees it: the magazine composition, every section with content, no placeholder notice, the lightbox drawn without a script.
  const base = `/demo/${key}`;
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub = await visitor.newPage();
  expect((await pub.goto(base))?.status()).toBe(200);
  await expect(pub.locator(".magazine-theme")).toHaveCount(1);
  const body = pub.locator("body");
  for (const text of ["How the guide works", "Elk are back in the lower meadows", "From people who live here", "The editors", "Nora Vance", "From the directory", "Harvest Market on the Plaza", "Where the aspens turn first", "Know a place we should list?"]) await expect(body).toContainText(text);
  expect(await pub.evaluate(() => Array.from(document.querySelectorAll("main *")).filter((el) => el.children.length === 0 && /\byet\.$/.test(el.textContent?.trim() ?? "")).length)).toBe(0);
  await pub.goto(`${base}/about`);
  await expect(pub.getByRole("heading", { name: "About the guide" }).first()).toBeVisible();
  await expect(pub.locator(".lw-lightbox")).toHaveCount(6);
  await pub.getByRole("link", { name: /^Open picture 1 of 6/ }).click();
  await expect(pub.locator(".lw-lightbox:target")).toHaveCount(1);
  await pub.goto(`${base}/places`);
  for (const title of ["Kettle Coffee Cart", "Hollis Mercantile", "Reservoir Path"]) await expect(body).toContainText(title);
  await pub.goto(`${base}/events`);
  await expect(body).toContainText("Library talk: the flood of 1911");
  await pub.goto(`${base}/events/star-party-at-the-reservoir`);
  await expect(body).toContainText(/postponed/i);
  await visitor.close();

  const guidePages = [
    { name: "home", path: "" },
    { name: "about", path: "/about" },
    { name: "directory", path: "/places" },
    { name: "place", path: "/places/kettle-coffee-cart" },
    { name: "events", path: "/events" },
    { name: "event", path: "/events/harvest-market-on-the-plaza" },
    { name: "article", path: "/articles/where-the-aspens-turn-first" },
    { name: "contact", path: "/contact" },
  ];
  const captures: Record<string, Capture[]> = {};
  const releases = ["v1 magazine"];
  captures.magazine = await capture(browser, base, guidePages, path.join(captureRoot, "cedar-bend", "magazine"));
  // The same site under the preset's other two compositions, for the owner's judgement: switch, publish, capture.
  for (const [label, folder] of [["Almanac (reference)", "almanac"], ["Preset default (Community guide (editorial))", "guide"]] as const) {
    await saveTheme(page, siteId, label);
    releases.push(`${(await publishNow(page, siteId)).match(/v\d+/)?.[0] ?? "?"} ${folder}`);
    captures[folder] = await capture(browser, base, guidePages.filter((p) => ["home", "about", "directory", "place", "article"].includes(p.name)), path.join(captureRoot, "cedar-bend", folder), otherWidths);
  }
  results.push({ key: "cedar-bend", name: "Cedar Bend Guide", siteId, composition: "magazine", tasks: rec.tasks, totals: rec.totals(), captures, releases });
  expect(rec.totals().screens).toBeGreaterThan(0);
});

test("Bookcliff Farm Markets: a location business built end to end through the dashboard, counted and timed (B4)", async ({ page, browser }) => {
  const rec = new Recorder(page);
  const key = `bookcliff-${Date.now().toString(36)}`;
  await signIn(page, emails.owner);
  const nav = page.getByRole("navigation", { name: "Dashboard" });

  rec.start("Create the site");
  await rec.open("/app/sites/new");
  await rec.fill(page.getByLabel("Site name"), "Bookcliff Farm Markets");
  await page.getByLabel("Internal key").fill(key);
  await rec.check(page.locator('input[type="radio"][value="location_business"]'));
  await rec.fill(page.getByLabel("Contact email"), "hello@bookclifffarms.example");
  await rec.press(page.getByRole("button", { name: "Create site" }));
  rec.arrive();
  await expect(page.getByText("Site created from the Location business preset")).toBeVisible();
  const siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;

  rec.start("Import the package (brand, contact details, 5 services, 3 markets, 30 pictures, the home and About text)");
  await importPackage(rec, page, nav, "bookcliff", /Dry run: 8 row\(s\) to import, 30 image\(s\), 17 setting\(s\)/);

  rec.start("Choose the composition");
  await rec.follow(nav.getByRole("link", { name: "Look", exact: true }));
  await rec.choose(designCard(page).getByRole("combobox", { name: "Theme", exact: true }), { label: "Storefront (bold)" });
  await rec.press(designCard(page).getByRole("button", { name: "Save", exact: true }));
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();

  rec.start("Compose the home page (two picture rows, a photo band, two quotations, the people, the members)");
  await openPage(rec, page, nav, "Home");
  // The package's opening picture already turned the starter's text hero into a picture hero.
  await expect(page.locator("ol > li", { hasText: "Image hero" })).toHaveCount(1);
  const rows = await addSection(rec, page, "image_text", "Image and text rows");
  await rec.fill(rows.getByLabel("Heading (optional)"), "Why people shop here");
  const rowData = [
    { picture: "Young peach trees", heading: "Picked this week", text: "Everything on the tables was picked within the week, most of it within the day, from our own orchard below the Book Cliffs and from growers within twenty miles.", button: "", link: "" },
    { picture: "Inside the market", heading: "Labelled with the grower's name", text: "What we do not grow ourselves comes from the valley, and the label says whose it is. Ask at the counter and we will tell you the field.", button: "Find a market", link: "/locations" },
  ];
  for (const [i, r] of rowData.entries()) {
    await rec.press(rows.getByRole("button", { name: "Add row" }));
    const row = rows.locator("ul > li").nth(i);
    await rec.choose(row.getByLabel("Picture", { exact: true }), { label: r.picture });
    await rec.fill(row.getByLabel(labelled("Heading")), r.heading);
    await rec.fill(row.getByLabel(labelled("Text")), r.text);
    if (r.button) {
      await rec.fill(row.getByLabel("Button label (optional)", { exact: true }), r.button);
      await rec.fill(row.getByLabel("Button link", { exact: true }), r.link);
    }
  }
  const band = await addSection(rec, page, "image_band", "Photo band");
  await rec.fill(band.getByLabel(labelled("Heading")), "Autumn weekends start on 26 September");
  await rec.fill(band.getByLabel("Text (optional)"), "Pumpkin patch, hayrides and the cider press at the Palisade farm, Saturdays and Sundays until Halloween.");
  await rec.choose(band.getByLabel("Picture", { exact: true }), { label: "The pumpkin patch" });
  await rec.choose(band.getByLabel("Colour wash"), "primary");
  await rec.fill(band.getByLabel("Button label (optional)", { exact: true }), "What's on at the farm");
  await rec.fill(band.getByLabel("Button link", { exact: true }), "/services/autumn-weekends");
  const quotes = await addSection(rec, page, "quotes", "Quotes");
  await rec.fill(quotes.getByLabel(labelled("Heading")), "What the valley says");
  const quoteData = [
    { text: "The Wednesday delivery is the reason our menu changes every week. Whatever is on the truck is what we cook.", who: "Lena Ruiz", role: "Owns a restaurant in Grand Junction (fictional)", portrait: "Lena Ruiz" },
    { text: "We have had the large box since May. The children eat things they would never have picked off a shelf.", who: "Tom Averill", role: "Harvest box subscriber, Fruita (fictional)", portrait: "Tom Averill" },
  ];
  for (const [i, q] of quoteData.entries()) {
    await rec.press(quotes.getByRole("button", { name: "Add quotation" }));
    const item = quotes.locator("ul > li").nth(i);
    await rec.fill(item.getByLabel("Quotation"), q.text);
    await rec.fill(item.getByLabel("Who said it"), q.who);
    await rec.fill(item.getByLabel("Their role or place (optional)"), q.role);
    await rec.choose(item.getByLabel("Portrait (optional)"), { label: q.portrait });
  }
  const team = await addSection(rec, page, "team", "People");
  await rec.fill(team.getByLabel(labelled("Heading")), "The people");
  await rec.fill(team.getByLabel("Introduction (optional)"), "One family and the people who run the markets with them. All three are fictional.");
  const people = [
    { name: "Marisol Vega", role: "Markets manager", words: "Runs the three markets and answers the phone at Palisade." },
    { name: "Grant Hollis", role: "Orchardist", words: "Third generation on Orchard Road; prunes every tree himself." },
    { name: "Ana Petrov", role: "Harvest boxes", words: "Packs the boxes on Tuesday and Friday mornings and writes the note inside." },
  ];
  for (const [i, person] of people.entries()) {
    await rec.press(team.getByRole("button", { name: "Add person" }));
    const item = team.locator("ul > li").nth(i);
    await rec.fill(item.getByLabel(labelled("Name")), person.name);
    await rec.fill(item.getByLabel("Role (optional)"), person.role);
    await rec.choose(item.getByLabel("Portrait (optional)"), { label: person.name });
    await rec.fill(item.getByLabel("A few words (optional)"), person.words);
  }
  const logos = await addSection(rec, page, "logo_strip", "Logo strip");
  await rec.fill(logos.getByLabel("Heading (optional)"), "Members of");
  for (const [i, title] of ["Grand Valley Growers Cooperative mark", "Orchard Trail Partners mark", "River District Chamber mark"].entries()) {
    await rec.press(logos.getByRole("button", { name: "Add logo" }));
    await rec.choose(logos.locator("ul > li").nth(i).getByLabel("Logo", { exact: true }), { label: title });
  }
  // The starter's contact callout (section 5 of 5) stays the last section of the ten.
  await moveSectionDown(rec, page, 5, 10);
  await saveEditor(rec, page);

  rec.start("Publish");
  await rec.follow(nav.getByRole("link", { name: "Publish", exact: true }));
  await expect(page.getByText("First release")).toBeVisible();
  await rec.press(page.getByRole("button", { name: "Publish now" }));
  await expect(page.getByText(/Published as release v1\b/)).toBeVisible();
  rec.finish();

  const base = `/demo/${key}`;
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub = await visitor.newPage();
  expect((await pub.goto(base))?.status()).toBe(200);
  await expect(pub.locator(".storefront-theme")).toHaveCount(1);
  const body = pub.locator("body");
  for (const text of ["Why people shop here", "Autumn weekends start on 26 September", "What the valley says", "The people", "Palisade Market", "Orchard Mesa Market", "Fruita Stand", "Harvest boxes"]) await expect(body).toContainText(text);
  expect(await pub.evaluate(() => Array.from(document.querySelectorAll("main *")).filter((el) => el.children.length === 0 && /\byet\.$/.test(el.textContent?.trim() ?? "")).length)).toBe(0);
  await expect(pub.locator('img[alt="Rows of orchard trees on the valley floor below a pale, flat-topped mesa under a blue sky"]').first()).toBeVisible();
  await pub.goto(`${base}/locations/fruita`);
  await expect(body).toContainText("Thursday");
  await visitor.close();

  const retailPages = [
    { name: "home", path: "" },
    { name: "about", path: "/about" },
    { name: "locations", path: "/locations" },
    { name: "store", path: "/locations/palisade" },
    { name: "services", path: "/services" },
    { name: "service", path: "/services/harvest-boxes" },
    { name: "contact", path: "/contact" },
  ];
  const captures: Record<string, Capture[]> = {};
  const releases = ["v1 storefront"];
  captures.storefront = await capture(browser, base, retailPages, path.join(captureRoot, "bookcliff", "storefront"));
  for (const [label, folder] of [["Practice (calm)", "practice"], ["Preset default (Location business (retail))", "locations"]] as const) {
    await saveTheme(page, siteId, label);
    releases.push(`${(await publishNow(page, siteId)).match(/v\d+/)?.[0] ?? "?"} ${folder}`);
    captures[folder] = await capture(browser, base, retailPages.filter((p) => ["home", "about", "locations", "store", "service"].includes(p.name)), path.join(captureRoot, "bookcliff", folder), otherWidths);
  }
  results.push({ key: "bookcliff", name: "Bookcliff Farm Markets", siteId, composition: "storefront", tasks: rec.tasks, totals: rec.totals(), captures, releases });
  expect(rec.totals().screens).toBeGreaterThan(0);
});

test.afterAll(() => {
  if (!results.length) return;
  const out = {
    measure: "B4 proof: two client sites built end to end through the dashboard from their onboarding packages, counted per task and timed (scripted), then captured under every composition of the preset",
    recordedAt: new Date().toISOString(),
    note: "Screens, fields and actions are what a person does; the time is the script's, which types instantly and never reads. A person's own timing uses the same packages (pnpm proof:package) on production.",
    capturesIn: captureRoot,
    sites: results,
  };
  fs.writeFileSync(path.join(evidence, "latest.json"), `${JSON.stringify(out, null, 2)}\n`);
});
