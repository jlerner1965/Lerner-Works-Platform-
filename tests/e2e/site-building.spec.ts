import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { seed, emails, signIn } from "./fixtures";

/** Site-building programme B1 in the browser: one-step publishing (SB-01), the review policy (SB-02), navigation by task (SB-03). Screenshots land in docs/evidence/dashboard/. */
test.describe.configure({ mode: "serial" });
const shots = "docs/evidence/dashboard";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

async function openHomeEditor(page: Page, siteId: string): Promise<void> {
  await page.goto(`/app/sites/${siteId}/content?kind=page&q=Home`);
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  await expect(page.getByLabel("Subheading").first()).toBeVisible();
}

test("an owner saves a page and publishes it in one step; the public site shows the change (SB-01)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  const marker = `Published in one step ${Date.now()}`;
  await openHomeEditor(page, sites.pineHollow);
  await page.getByLabel("Subheading").first().fill(marker);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved version \d+.*It is approved/)).toBeVisible();

  // The editor's shortcut leads to the Publish page, which lists the change and publishes it.
  await page.getByRole("link", { name: "Publish…" }).click();
  await expect(page.getByRole("heading", { name: "Publish", exact: true })).toBeVisible();
  await expect(page.getByText("Changed (1)")).toBeVisible();
  await shot(page, "b1-publish-page");
  await page.getByLabel(/Note for the release history/).fill("Home subheading");
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published as release v\d+/)).toBeVisible();
  await shot(page, "b1-publish-done");

  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/demo/pine-hollow");
  await expect(pub.locator("body")).toContainText(marker);
  await visitor.close();

  // Nothing is left to publish, and the note is in the history.
  await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  await expect(page.getByText("Nothing to publish").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();
  await expect(page.getByRole("cell", { name: "Home subheading" })).toBeVisible();
});

test("with review required, an owner's own save waits for an explicit approval (SB-02)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}/settings`);
  await page.getByLabel(/Require an explicit approval/).check();
  await page.getByRole("button", { name: "Save review policy" }).click();
  await expect(page.getByText(/Review required/)).toBeVisible();
  await shot(page, "b1-settings");

  const marker = `Needs a decision ${Date.now()}`;
  await openHomeEditor(page, sites.pineHollow);
  await page.getByLabel("Subheading").first().fill(marker);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/unchanged until an approved version/)).toBeVisible();
  await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  // The seed also carries two unapproved fixture items, so the list counts them as well; the Home draft is what matters here.
  await expect(page.getByText(/Waiting for approval, not included/)).toBeVisible();
  await expect(page.locator("li", { hasText: "Home" }).filter({ hasText: "the newer draft is not approved" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();
  await shot(page, "b1-publish-waiting");

  // An explicit approval (audited as the owner's own work) makes it publishable.
  await openHomeEditor(page, sites.pineHollow);
  await page.getByRole("button", { name: /^Approve/ }).click();
  await expect(page.getByText("Revision approved.")).toBeVisible();
  await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  await expect(page.getByText("Changed (1)")).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published as release v\d+/)).toBeVisible();

  // Back to the default policy.
  await page.goto(`/app/sites/${sites.pineHollow}/settings`);
  await page.getByLabel(/Require an explicit approval/).uncheck();
  await page.getByRole("button", { name: "Save review policy" }).click();
  await expect(page.getByText(/Review not required/)).toBeVisible();
});

test("every daily task is one click away in the sidebar, and the overview is built around them (SB-03)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}`);
  const nav = page.getByRole("navigation", { name: "Dashboard" });
  for (const label of ["Overview", "Pages", "Places", "Events", "Articles", "Media", "Reviews", "Look", "Publish", "Inbox", "Settings", "Team", "Import & export", "Activity log"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  for (const heading of ["Content", "Look", "Publish", "Setup checklist"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await shot(page, "b1-overview");
  await nav.getByRole("link", { name: "Look", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Look", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brand", exact: true })).toBeVisible();
  await shot(page, "b1-look");
  await nav.getByRole("link", { name: "Places", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Places", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Places", exact: true })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Publish", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Inbox", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page).toHaveURL(/\/access$/);

  // Editors see only what they can use.
  await page.goto("/app");
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, emails.editorA);
  await page.goto(`/app/sites/${sites.pineHollow}`);
  for (const label of ["Look", "Publish", "Inbox", "Settings", "Team", "Activity log"]) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  for (const label of ["Pages", "Places", "Media", "Reviews", "Import & export"]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
});
