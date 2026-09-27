import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { strToU8, unzipSync, zipSync, strFromU8 } from "fflate";
import { emails, seed, signIn } from "./fixtures";

/**
 * Uploaded sites in the browser (site-building programme B7, UP-01 to UP-04): the owner
 * creates an uploaded site, uploads the sample ZIP, publishes it, opens it on its preview
 * hostname (clean addresses, the stylesheet applied, the site's own 404 page), sends the
 * contact form and finds the message in the inbox, uploads a second version and restores the
 * first. Screenshots land in docs/evidence/dashboard/.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
const shots = "docs/evidence/dashboard";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const PORT = process.env.E2E_PORT ?? "3100";

test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

test("an uploaded site goes from a ZIP to a preview with a working form, a second version and a restore (UP-01..04)", async ({ page }) => {
  await signIn(page, emails.owner);

  // An uploaded site: no preset to choose, no starter pages.
  const key = `harbor-${Date.now().toString(36)}`;
  await page.goto("/app/sites/new");
  await page.getByRole("radio", { name: /^Uploaded/ }).check();
  await expect(page.getByText("Preset", { exact: true })).toHaveCount(0);
  await page.getByLabel("Site name").fill("Harbor Lane Studio");
  await page.getByLabel("Internal key").fill(key);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created. Upload the site's ZIP to publish it")).toBeVisible();
  const siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;
  await expect(page.getByRole("link", { name: "Upload", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Places", exact: true })).toHaveCount(0);
  expect((await page.request.get(`/app/sites/${siteId}/content`)).status()).toBe(404);

  // The sample ZIP, uploaded as it is, checked, published.
  const sample = await page.request.get(`/app/sites/${siteId}/upload/sample`);
  expect(sample.status()).toBe(200);
  const zipBytes = await sample.body();
  await page.getByRole("link", { name: "Upload the site" }).click();
  await expect(page.getByRole("heading", { name: "Upload", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "harbor-lane-studio.zip", mimeType: "application/zip", buffer: zipBytes });
  await page.getByRole("button", { name: "Upload and check" }).click();
  await expect(page.getByRole("heading", { name: "Upload checked" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /^9 files, .* unpacked \(/ })).toBeVisible();
  await expect(page.getByText("index.html at the top: yes")).toBeVisible();
  await shot(page, "b7-upload-checked");
  await page.getByLabel(/Note for the release history/).fill("First version of the studio site");
  await page.getByRole("button", { name: "Publish as release v1" }).click();
  await expect(page.getByText("Published release v1.")).toBeVisible();
  await shot(page, "b7-published");

  // The preview hostname: the site as uploaded, clean addresses, its stylesheet, its 404 page.
  const preview = `http://${key}.preview.localhost:${PORT}`;
  const home = await page.goto(`${preview}/`);
  expect(home?.status()).toBe(200);
  await expect(page).toHaveTitle(/Harbor Lane Studio/);
  await expect(page.getByRole("heading", { level: 1, name: "Furniture made to be handed down." })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(251, 248, 242)");
  await shot(page, "b7-preview");
  const about = await page.goto(`${preview}/about`);
  expect(about?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "About the studio" })).toBeVisible();
  const lost = await page.goto(`${preview}/no-such-page`);
  expect(lost?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "That page is not here" })).toBeVisible();
  expect(home?.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  // The contact form posts to the site's own address and the message lands in the inbox.
  await page.goto(`${preview}/contact`);
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("What are you thinking of?").fill("A walnut table for eight, delivered before the holidays.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/\/thanks\?sent=LW-[0-9A-F]{8}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Thank you" })).toBeVisible();
  await page.goto(`/app/sites/${siteId}/inquiries`);
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("A walnut table for eight")).toBeVisible();

  // A second version is the next release; the first can be restored.
  const files = unzipSync(zipBytes);
  files["index.html"] = strToU8(strFromU8(files["index.html"]!).replace("Furniture made to be handed down.", "Second version of the studio site."));
  await page.goto(`/app/sites/${siteId}/upload`);
  await page.locator('input[type="file"]').setInputFiles({ name: "harbor-v2.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(files)) });
  await page.getByRole("button", { name: "Upload and check" }).click();
  await page.getByRole("button", { name: "Publish as release v2" }).click();
  await expect(page.getByText("Published release v2.")).toBeVisible();
  await page.goto(`${preview}/`);
  await expect(page.getByRole("heading", { level: 1, name: "Second version of the studio site." })).toBeVisible();
  await page.goto(`/app/sites/${siteId}/upload`);
  await expect(page.getByText("Release v2")).toBeVisible();
  await page.getByLabel("Reason for restoring v1").fill("The first headline was better");
  await page.getByRole("button", { name: "Restore v1 as a new release" }).click();
  await expect(page.getByText("Release restored as a new release.")).toBeVisible();
  await shot(page, "b7-releases");
  await page.goto(`${preview}/`);
  await expect(page.getByRole("heading", { level: 1, name: "Furniture made to be handed down." })).toBeVisible();
});
