import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { strToU8, unzipSync, zipSync } from "fflate";
import { emails, seed, signIn } from "./fixtures";

/**
 * Site-building programme B2 in the browser: SB-04 (a fresh site reaches its first release
 * from an onboarding package, with no empty section on the published home page) and SB-05
 * (twenty images in one upload, each with alternative text before use). Screenshots land in
 * docs/evidence/dashboard/; the SB-04 timing in docs/evidence/walkthrough/onboarding.json.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
const shots = "docs/evidence/dashboard";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
  fs.mkdirSync("docs/evidence/walkthrough", { recursive: true });
});

const csv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n") + "\r\n";

async function image(colour: string, format: "png" | "jpeg" = "png"): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp");
  const s = sharp({ create: { width: 1200, height: 800, channels: 3, background: colour } });
  return new Uint8Array(await (format === "png" ? s.png() : s.jpeg()).toBuffer());
}

/** A filled-in package for a community guide: five places, two events, one article, three images, the settings sheet. */
async function filledPackage(): Promise<Uint8Array> {
  return zipSync({
    "places.csv": strToU8(csv([
      ["external_id", "title", "category", "summary", "address_line1", "locality", "body", "image", "image_alt"],
      ["P-1", "Cedar Bend Bakery", "Eat & Drink", "Sourdough, rye and morning pastries baked before dawn; the counter opens at seven.", "12 Main Street", "Cedar Bend", "The oven is lit at four.\n\nBread is on the counter by seven.", "bakery.jpg", "The bakery's front window at dawn"],
      ["P-2", "Riverstone Books", "Shops", "New and used books with a regional shelf and a reading corner for children.", "40 Main Street", "Cedar Bend", "", "", ""],
      ["P-3", "North Fork Outfitters", "Outdoors", "Rentals and repairs for the trails and the river: bikes, packs, paddles and maps.", "3 Mill Road", "Cedar Bend", "", "", ""],
      ["P-4", "Millrace Brewing", "Eat & Drink", "Small-batch ales in the old mill building, with a patio over the millrace.", "1 Mill Road", "Cedar Bend", "", "", ""],
      ["P-5", "Juniper Yoga Studio", "Wellness", "Morning and evening classes for every level; mats provided, first visit free.", "8 Aspen Lane", "Cedar Bend", "", "", ""],
    ])),
    "events.csv": strToU8(csv([
      ["external_id", "title", "starts_at", "ends_at", "venue_text", "summary"],
      ["E-1", "Harvest market", "2027-10-02 09:00", "2027-10-02 14:00", "Main Street", "Stalls from the valley's growers, music at noon."],
      ["E-2", "Trail work morning", "2027-10-09 08:00", "2027-10-09 12:00", "Larkspur trailhead", "Tools and coffee provided; wear boots."],
    ])),
    "articles.csv": strToU8(csv([
      ["external_id", "title", "author_name", "published_on", "summary", "body", "image"],
      ["A-1", "Trail day recap", "Maya Ortiz", "2026-09-01", "Forty volunteers, three miles of trail, one long lunch.", "## Why we went\n\nThe Larkspur loop had washed out in May.\n\n- Forty volunteers\n- Three miles of trail", "trail.png"],
    ])),
    "images.csv": strToU8(csv([
      ["file", "alt_text", "title", "license", "attribution", "source_url", "decorative"],
      ["trail.png", "Volunteers rebuilding a washed-out section of trail", "Trail day", "Owned by the client", "Maya Ortiz", "", "no"],
      ["bakery.jpg", "", "Bakery storefront", "Owned by the client", "", "", "no"],
      ["logo.png", "Cedar Bend Guide", "Logo", "Owned by the client", "", "", "no"],
    ])),
    "site.csv": strToU8(csv([
      ["key", "value"],
      ["tagline", "Shops, trails and the people who keep the town going"],
      ["description", "A guide to Cedar Bend's shops, trails and events, kept by the people who live here."],
      ["contact_email", "hello@cedarbend.example"],
      ["contact_phone", "(303) 555-0100"],
      ["primary_color", "#1f4e3d"],
      ["accent_color", "#8a3b12"],
      ["typography", "classic-serif"],
      ["logo", "logo.png"],
      ["hero_image", "trail.png"],
      ["home_subheading", "Everything worth knowing about Cedar Bend, in one place."],
      ["home_intro", "Cedar Bend sits where the river leaves the canyon.\n\nThis guide is kept by the people who live here."],
      ["about_text", "## Who keeps this guide\n\nA handful of neighbours who like the place."],
    ])),
    "images/trail.png": await image("#2f5d3a"),
    "images/bakery.jpg": await image("#a4502b", "jpeg"),
    "images/logo.png": await image("#25302a"),
  }, { level: 6 });
}

test("a fresh site reaches its first release from the onboarding package, with no empty section on the home page (SB-04)", async ({ page, browser }) => {
  await signIn(page, emails.owner);
  const key = `onboard-${Date.now().toString(36)}`;
  const started = Date.now();
  const steps: Array<{ step: string; ms: number }> = [];
  const mark = (step: string) => steps.push({ step, ms: Date.now() - started });

  // Create the site.
  await page.goto("/app/sites/new");
  await page.getByLabel("Site name").fill("Cedar Bend Guide");
  await page.getByLabel("Internal key").fill(key);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  const siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;
  mark("site created");

  // The template is what the client fills in: one sheet per kind, the settings sheet, the images sheet.
  const template = await page.request.get(`/app/sites/${siteId}/import/onboarding-template`);
  expect(template.status()).toBe(200);
  const entries = unzipSync(new Uint8Array(await template.body()));
  expect(Object.keys(entries).sort()).toEqual(["README.md", "articles.csv", "events.csv", "images.csv", "images/README.txt", "places.csv", "site.csv"]);
  mark("template downloaded");

  // Upload the filled-in package: the dry run lists everything and writes nothing.
  await page.goto(`/app/sites/${siteId}/import`);
  const form = page.locator("form", { has: page.locator('input[name="type"][value="onboarding"]') });
  await form.locator('input[type="file"]').setInputFiles({ name: "onboarding-cedar-bend.zip", mimeType: "application/zip", buffer: Buffer.from(await filledPackage()) });
  await form.getByRole("button", { name: "Upload and run dry run" }).click();
  await expect(page.getByText(/Dry run: 8 row\(s\) to import, 3 image\(s\), 12 setting\(s\)/)).toBeVisible();
  await expect(page.getByText("The package is well-formed. Nothing has been written.")).toBeVisible();
  await expect(page.getByText(/places\.csv: 5 to create/)).toBeVisible();
  await shot(page, "b2-onboarding-dry-run");
  mark("dry run shown");
  await page.getByRole("button", { name: /Import 8 row\(s\), 3 image\(s\) and 12 setting\(s\)/ }).click();
  await expect(page.getByText(/Import applied: 8 created/)).toBeVisible();
  await expect(page.getByText(/approved and go out with the next publish/)).toBeVisible();
  mark("package imported");

  // Publish in one step.
  await page.goto(`/app/sites/${siteId}/publishing`);
  await expect(page.getByText("First release")).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published as release v1\b/)).toBeVisible();
  mark("published");

  // The public site: brand, hero picture, categories, places, events, article, intro, About; not one placeholder notice.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  const home = await pub.goto(`/demo/${key}`);
  expect(home?.status()).toBe(200);
  const body = pub.locator("body");
  await expect(body).toContainText("Shops, trails and the people who keep the town going");
  await expect(body).toContainText("Everything worth knowing about Cedar Bend");
  await expect(body).toContainText("Cedar Bend sits where the river leaves the canyon");
  await expect(body).toContainText("Browse by category");
  await expect(pub.getByRole("link", { name: /Eat & Drink/ }).first()).toBeVisible();
  await expect(body).toContainText("Cedar Bend Bakery");
  await expect(body).toContainText("Harvest market");
  await expect(body).toContainText("Trail day recap");
  await expect(pub.locator('img[alt="Volunteers rebuilding a washed-out section of trail"]').first()).toBeVisible();
  await expect(pub.locator('img[alt="Cedar Bend Guide"]').first()).toBeVisible();
  const emptyNotices = await pub.evaluate(() => Array.from(document.querySelectorAll("main *")).filter((el) => el.children.length === 0 && /\byet\.$/.test(el.textContent?.trim() ?? "")).length);
  expect(emptyNotices).toBe(0);
  await shot(pub, "b2-public-home");
  await pub.goto(`/demo/${key}/about`);
  await expect(pub.locator("body")).toContainText("Who keeps this guide");
  await pub.goto(`/demo/${key}/places?category=Eat%20%26%20Drink`);
  await expect(pub.locator("body")).toContainText("Millrace Brewing");
  await expect(pub.locator("body")).not.toContainText("Riverstone Books");
  await visitor.close();
  mark("public site checked");

  fs.writeFileSync("docs/evidence/walkthrough/onboarding.json", `${JSON.stringify({ measure: "SB-04: create a site, download the template, upload the filled package, confirm the dry run, publish", recordedAt: new Date().toISOString(), siteId, totalMs: Date.now() - started, steps, publishedHome: { emptyNotices } }, null, 2)}\n`);
});

test("twenty images go up in one upload and each gets its alternative text before use (SB-05)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}/media`);
  const files = [];
  for (let i = 1; i <= 20; i++) {
    const hue = (i * 17) % 360;
    files.push({ name: `bulk-${String(i).padStart(2, "0")}.png`, mimeType: "image/png", buffer: Buffer.from(await image(`hsl(${hue}, 60%, 45%)`)) });
  }
  const started = Date.now();
  await page.getByLabel("Image files").setInputFiles(files);
  await page.getByLabel("License / rights (all files)").fill("Owned by the client");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("heading", { name: /Alternative text for 20 uploaded images/ })).toBeVisible({ timeout: 120_000 });
  await shot(page, "b2-alt-text-pass");
  for (let i = 1; i <= 20; i++) {
    const n = String(i).padStart(2, "0");
    await page.getByLabel(`bulk-${n}`, { exact: true }).fill(`Test pattern ${n}, a solid colour`);
  }
  await page.getByRole("button", { name: /Save alternative text for 20 images/ }).click();
  await expect(page.getByText(/Saved alternative text for 20 images/)).toBeVisible();
  const ms = Date.now() - started;
  // Every uploaded image now carries alternative text and the shared license; nothing in the library still needs alternative text.
  await expect(page.getByRole("link", { name: /need alternative text/ })).toHaveCount(0);
  for (const n of ["01", "20"]) {
    const card = page.locator("li", { has: page.getByRole("link", { name: new RegExp(`bulk-${n}`) }) });
    await expect(card.getByText("alt text", { exact: true })).toBeVisible();
    await expect(card.getByText("licensed", { exact: true })).toBeVisible();
  }
  fs.writeFileSync("docs/evidence/walkthrough/bulk-upload.json", `${JSON.stringify({ measure: "SB-05: twenty images in one upload, alternative text for each on one screen", recordedAt: new Date().toISOString(), images: 20, ms }, null, 2)}\n`);
});
