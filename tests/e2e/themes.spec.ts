import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { seed, emails, signIn } from "./fixtures";

/** Design programme D2 in the browser: theme switch and design preview (DES-10), delegation (DES-11). */
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

const designCard = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Design", exact: true }) });

async function saveTheme(page: Page, siteId: string, themeLabel: string): Promise<void> {
  await page.goto(`/app/sites/${siteId}/look`);
  // By role and accessible name: the wrapping label's text also contains the option texts, so a label-text match cannot be exact.
  await designCard(page).getByRole("combobox", { name: "Theme", exact: true }).selectOption({ label: themeLabel });
  await designCard(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();
}

async function publishNow(page: Page, siteId: string): Promise<void> {
  await page.goto(`/app/sites/${siteId}/publishing`);
  await page.getByRole("button", { name: "Build a candidate" }).click();
  await expect(page).toHaveURL(/\/publishing\/candidates\//);
  await expect(page.getByText(/Ready to activate/)).toBeVisible();
  await page.getByRole("button", { name: "Activate this candidate" }).click();
  await expect(page.getByText(/Release activated/).first()).toBeVisible();
}

/** The design preview frame and the 404 page carry no dashboard chrome, so sign out from the dashboard root. */
async function signOut(page: Page): Promise<void> {
  await page.goto("/app");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

test("an owner switches the guide to the magazine composition, previews it before publishing, publishes, and switches back (DES-10)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await saveTheme(page, sites.pineHollow, "Magazine (feature-led)");
  await expect(page.getByText(/Theme changed to Magazine/)).toBeVisible();

  // The design preview shows the draft composition; the public site is unchanged.
  await page.goto(`/app/sites/${sites.pineHollow}/previews/design`);
  await expect(page.getByText("Design preview", { exact: true })).toBeVisible();
  await expect(page.getByText(/Magazine \(feature-led\) · over release/)).toBeVisible();
  await page.goto(`/app/sites/${sites.pineHollow}/previews/design/render`);
  await expect(page.locator(".magazine-theme")).toHaveCount(1);
  await expect(page.getByText("not the published site")).toBeVisible();
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/demo/pine-hollow");
  await expect(pub.locator(".guide-theme")).toHaveCount(1);
  await expect(pub.locator(".magazine-theme")).toHaveCount(0);

  // Publish: the magazine composition is live with its masthead navigation.
  await publishNow(page, sites.pineHollow);
  await pub.reload();
  await expect(pub.locator(".magazine-theme")).toHaveCount(1);
  await expect(pub.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Directory" })).toBeVisible();
  await pub.goto("/demo/pine-hollow/articles/how-pine-hollow-keeps-its-trailheads-open");
  await expect(pub.getByText("More from the guide")).toBeVisible();

  // Back to the preset default.
  await saveTheme(page, sites.pineHollow, "Preset default (Community guide (editorial))");
  await publishNow(page, sites.pineHollow);
  await pub.goto("/demo/pine-hollow");
  await expect(pub.locator(".guide-theme")).toHaveCount(1);
  await visitor.close();
});

test("the retail pilot under the storefront composition keeps the store finder, tiles and live status (DES-10)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await saveTheme(page, sites.rangeAthletics, "Storefront (bold)");
  await publishNow(page, sites.rangeAthletics);
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub = await visitor.newPage();
  await pub.goto("/demo/range-athletics");
  await expect(pub.locator(".storefront-theme")).toHaveCount(1);
  await expect(pub.getByRole("banner").getByRole("link", { name: "Find a store" })).toBeVisible();
  await expect(pub.getByRole("link", { name: "Store details" }).first()).toBeVisible();
  await expect(pub.getByText(/Open now|Closed/).first()).toBeVisible();
  await pub.goto("/demo/range-athletics/locations/fort-collins");
  await expect(pub.getByText("Temporarily closed").first()).toBeVisible();
  await expect(pub.getByRole("heading", { name: "Getting here" })).toBeVisible();
  await visitor.close();
  await saveTheme(page, sites.rangeAthletics, "Preset default (Location business (retail))");
  await publishNow(page, sites.rangeAthletics);
});

test("the guide under the almanac composition: navigation rail, script-free lightbox and click-to-load map (B3)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await saveTheme(page, sites.pineHollow, "Almanac (reference)");
  await expect(page.getByText(/Theme changed to Almanac/)).toBeVisible();
  await publishNow(page, sites.pineHollow);
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub = await visitor.newPage();
  await pub.goto("/demo/pine-hollow");
  await expect(pub.locator(".almanac-theme")).toHaveCount(1);
  await expect(pub.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Directory/ })).toBeVisible();
  // The gallery lightbox is drawn by :target alone: the thumbnail links open a dialog, Next moves on, Close returns to the gallery.
  await pub.goto("/demo/pine-hollow/about");
  const first = pub.locator("#lb-s-gallery-0");
  await expect(first).toBeHidden();
  await pub.getByRole("link", { name: /^Open picture 1 of 6/ }).click();
  await expect(first).toBeVisible();
  await expect(first.getByRole("dialog")).toHaveCount(0); // the dialog is the element itself
  await first.getByRole("link", { name: "Next", exact: true }).click();
  await expect(pub.locator("#lb-s-gallery-1")).toBeVisible();
  await expect(first).toBeHidden();
  await pub.locator("#lb-s-gallery-1").getByRole("link", { name: "Close", exact: true }).click();
  await expect(pub.locator("#lb-s-gallery-1")).toBeHidden();
  // The map is offered on a plain panel; on a demonstration site the button stays disabled and no frame is loaded.
  await pub.goto("/demo/pine-hollow/contact");
  await expect(pub.getByRole("button", { name: "Show map" })).toBeDisabled();
  await expect(pub.getByText("The map is disabled on demonstration sites.")).toBeVisible();
  await expect(pub.locator("iframe")).toHaveCount(0);
  await visitor.close();
  await saveTheme(page, sites.pineHollow, "Preset default (Community guide (editorial))");
  await publishNow(page, sites.pineHollow);
});

test("the retail pilot under the practice composition keeps the phone number, location cards and the hours table (B3)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await saveTheme(page, sites.rangeAthletics, "Practice (calm)");
  await publishNow(page, sites.rangeAthletics);
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub = await visitor.newPage();
  await pub.goto("/demo/range-athletics");
  await expect(pub.locator(".practice-theme")).toHaveCount(1);
  await expect(pub.getByRole("banner").getByRole("link", { name: "(720) 555-0190" })).toBeVisible();
  await expect(pub.getByRole("banner").getByRole("link", { name: "Contact us" })).toBeVisible();
  await expect(pub.getByRole("link", { name: "Location details" }).first()).toBeVisible();
  await expect(pub.getByText(/Open now|Closed/).first()).toBeVisible();
  await pub.goto("/demo/range-athletics/locations/fort-collins");
  await expect(pub.getByText("Temporarily closed").first()).toBeVisible();
  await expect(pub.getByRole("table", { name: "Regular weekly hours" })).toBeVisible();
  await expect(pub.getByRole("heading", { name: "Services at this location" })).toBeVisible();
  await visitor.close();
  await saveTheme(page, sites.rangeAthletics, "Preset default (Location business (retail))");
  await publishNow(page, sites.rangeAthletics);
});

test("design is owner-only until the owner delegates it to a site's publishers (DES-11)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.publisherB);
  await page.goto(`/app/sites/${sites.rangeAthletics}/look`);
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveCount(0); // no design controls
  const denied = await page.goto(`/app/sites/${sites.rangeAthletics}/previews/design`);
  expect(denied?.status()).toBe(404);
  await signOut(page);

  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.rangeAthletics}/look`);
  await designCard(page).getByLabel(/Let this site's publishers change its design/).check();
  await designCard(page).getByRole("button", { name: "Save delegation" }).click();
  await expect(page.getByText(/Design delegated/)).toBeVisible();
  await page.goto(`/app/sites/${sites.rangeAthletics}/audit`);
  await expect(page.getByText("design.delegation_changed").first()).toBeVisible();
  await signOut(page);

  await signIn(page, emails.publisherB);
  await page.goto(`/app/sites/${sites.rangeAthletics}/look`);
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeVisible(); // design controls now offered
  await expect(page.getByText("Delegation", { exact: true })).toHaveCount(0); // the switch itself stays with the owner
  await designCard(page).getByLabel("Corner radius").selectOption("medium");
  await designCard(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();
  const allowed = await page.goto(`/app/sites/${sites.rangeAthletics}/previews/design`);
  expect(allowed?.status()).toBe(200);
  await signOut(page);

  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.rangeAthletics}/look`);
  await designCard(page).getByLabel(/Let this site's publishers change its design/).uncheck();
  await designCard(page).getByRole("button", { name: "Save delegation" }).click();
  await expect(page.getByText(/only organization owners/)).toBeVisible();
  await designCard(page).getByLabel("Corner radius").selectOption("small");
  await designCard(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();
  await signOut(page);
  await signIn(page, emails.publisherB);
  await page.goto(`/app/sites/${sites.rangeAthletics}/look`);
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveCount(0); // no design controls
});
