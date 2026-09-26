import { test, expect, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import { emails, signIn } from "./fixtures";

/**
 * Site-building programme SB-06: the same walk-through after every phase, measured.
 *
 * Creates a site from the community guide preset, brands it, adds five places and publishes,
 * through the dashboard exactly as a person would (sidebar, forms, buttons), and counts per
 * task the screens opened, the fields filled and the buttons or links pressed, with the
 * scripted run's wall time. The counts are the comparable measure between phases (a script
 * types faster than a person; a person's own timing is the B4 evidence). It also records how
 * many empty-state notices the published home page still shows, which B2 has to bring to
 * zero. The result is written to docs/evidence/walkthrough/latest.json and copied per phase
 * into the SB-06 row of docs/ACCEPTANCE.md.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

interface TaskCount { task: string; screens: number; fields: number; actions: number; ms: number }

class Recorder {
  readonly tasks: TaskCount[] = [];
  private current: TaskCount | null = null;
  private startedAt = 0;
  constructor(private readonly page: Page) {}
  start(task: string): void {
    this.finish();
    this.current = { task, screens: 0, fields: 0, actions: 0, ms: 0 };
    this.startedAt = Date.now();
  }
  finish(): void {
    if (!this.current) return;
    this.current.ms = Date.now() - this.startedAt;
    this.tasks.push(this.current);
    this.current = null;
  }
  private get task(): TaskCount {
    if (!this.current) throw new Error("no task started");
    return this.current;
  }
  /** A screen reached by typing or choosing an address (the dashboard home, a link opened by hand). */
  async open(url: string): Promise<void> {
    this.task.screens += 1;
    await this.page.goto(url);
  }
  /** A link that opens another screen. */
  async follow(link: Locator): Promise<void> {
    this.task.screens += 1;
    this.task.actions += 1;
    await link.click();
  }
  /** A screen the person lands on after an action (the overview after creating a site, the editor after creating a draft). */
  arrive(): void {
    this.task.screens += 1;
  }
  async fill(field: Locator, value: string): Promise<void> {
    this.task.fields += 1;
    await field.fill(value);
  }
  async press(button: Locator): Promise<void> {
    this.task.actions += 1;
    await button.click();
  }
  totals(): Omit<TaskCount, "task"> {
    return this.tasks.reduce((sum, t) => ({ screens: sum.screens + t.screens, fields: sum.fields + t.fields, actions: sum.actions + t.actions, ms: sum.ms + t.ms }), { screens: 0, fields: 0, actions: 0, ms: 0 });
  }
}

const places = [
  { title: "Cedar Bend Bakery", category: "Bakery", summary: "Sourdough, rye and morning pastries baked before dawn; the counter opens at seven.", line1: "12 Main Street" },
  { title: "Riverstone Books", category: "Bookshop", summary: "New and used books with a regional shelf and a reading corner for children.", line1: "40 Main Street" },
  { title: "North Fork Outfitters", category: "Outdoor gear", summary: "Rentals and repairs for the trails and the river: bikes, packs, paddles and maps.", line1: "3 Mill Road" },
  { title: "Millrace Brewing", category: "Brewery", summary: "Small-batch ales in the old mill building, with a patio over the millrace.", line1: "1 Mill Road" },
  { title: "Juniper Yoga Studio", category: "Fitness", summary: "Morning and evening classes for every level; mats provided, first visit free.", line1: "8 Aspen Lane" },
];

test("create a site, brand it, add five places and publish, counted per task (SB-06)", async ({ page, browser }) => {
  const rec = new Recorder(page);
  const key = `walkthrough-${Date.now().toString(36)}`;
  await signIn(page, emails.owner);
  const nav = page.getByRole("navigation", { name: "Dashboard" });

  rec.start("Create the site");
  await rec.open("/app/sites/new");
  await rec.fill(page.getByLabel("Site name"), "Cedar Bend Guide");
  // The registry key is derived from the name; it is set by hand here only so repeated runs never collide, and not counted.
  await page.getByLabel("Internal key").fill(key);
  await rec.fill(page.getByLabel("Contact email"), "hello@cedarbend.example");
  await rec.press(page.getByRole("button", { name: "Create site" }));
  rec.arrive();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  const siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;

  rec.start("Brand the site");
  await rec.follow(nav.getByRole("link", { name: "Look", exact: true }));
  await expect(page.getByRole("heading", { name: "Look", exact: true })).toBeVisible();
  const brand = page.locator("section").filter({ has: page.getByRole("heading", { name: "Brand", exact: true }) });
  await rec.fill(brand.getByLabel("Tagline"), "Shops, trails and the people who keep the town going");
  await rec.fill(brand.getByLabel("primary color"), "#1f4e3d");
  await rec.fill(brand.getByLabel("accent color"), "#8a3b12");
  await rec.press(brand.getByRole("button", { name: "Save", exact: true }));
  await expect(page.getByText(/saved as configuration revision/)).toBeVisible();
  await expect(brand.getByText(/all \d+ pairings pass/)).toBeVisible();

  rec.start("Add five places");
  for (const place of places) {
    // Quick add on the list (B2): the title and category create the draft and open the editor; one screen fewer than the New item page.
    await rec.follow(nav.getByRole("link", { name: "Places", exact: true }));
    await expect(page.getByRole("heading", { name: "Places", exact: true })).toBeVisible();
    const quick = page.locator("form", { has: page.getByText("Add a place") });
    await rec.fill(quick.getByLabel("Title"), place.title);
    await rec.fill(quick.getByLabel("Category"), place.category);
    await rec.press(quick.getByRole("button", { name: "Add place" }));
    rec.arrive();
    const field = (name: string) => page.getByRole("textbox", { name, exact: true });
    // The Category field offers the site's existing categories (a datalist), so its role is a combobox once suggestions exist.
    await expect(page.getByLabel("Category")).toHaveValue(place.category);
    await rec.fill(field("Summary"), place.summary);
    await rec.fill(field("Address line 1"), place.line1);
    await rec.fill(field("City / locality"), "Cedar Bend");
    await rec.press(page.getByRole("button", { name: "Save", exact: true }));
    await expect(page.getByText(/Saved version \d+.*It is approved/)).toBeVisible();
  }

  rec.start("Publish");
  await rec.follow(nav.getByRole("link", { name: "Publish", exact: true }));
  await expect(page.getByRole("heading", { name: "Publish", exact: true })).toBeVisible();
  await expect(page.getByText("First release")).toBeVisible();
  await expect(page.getByText(/Added \(\d+\)/)).toBeVisible();
  await rec.press(page.getByRole("button", { name: "Publish now" }));
  await expect(page.getByText(/Published as release v1\b/)).toBeVisible();
  rec.finish();

  // The result, as a visitor sees it: the five places and their categories are public, and the
  // home page carries no empty-state notice (B2: a section with nothing to show is left out).
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  const home = await pub.goto(`/demo/${key}`);
  expect(home?.status()).toBe(200);
  await expect(pub.getByRole("link", { name: "Cedar Bend Guide" }).first()).toBeVisible();
  await expect(pub.locator("body")).toContainText("Browse by category");
  await expect(pub.locator("body")).toContainText("Cedar Bend Bakery");
  const emptyNotices = await pub.evaluate(() => Array.from(document.querySelectorAll("main *")).filter((el) => el.children.length === 0 && /\byet\.$/.test(el.textContent?.trim() ?? "")).length);
  expect(emptyNotices).toBe(0);
  fs.mkdirSync("docs/evidence/walkthrough", { recursive: true });
  await pub.screenshot({ path: "docs/evidence/walkthrough/published-home.png", fullPage: true });
  await pub.goto(`/demo/${key}/places`);
  for (const place of places) await expect(pub.getByRole("link", { name: place.title })).toBeVisible();
  await visitor.close();

  const totals = rec.totals();
  const result = { measure: "SB-06 walk-through: create a site from the community guide preset, brand it, add five places, publish", recordedAt: new Date().toISOString(), siteId, tasks: rec.tasks, totals, publishedHome: { emptyNotices } };
  fs.writeFileSync("docs/evidence/walkthrough/latest.json", `${JSON.stringify(result, null, 2)}\n`);
  expect(totals.screens).toBeGreaterThan(0);
});
