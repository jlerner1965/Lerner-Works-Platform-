import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { emails, seed, signIn } from "./fixtures";

/**
 * Removing a site and an organization in the browser (site-building programme B6, OPS-04 and
 * OPS-05): a site created for the purpose is removed from its Settings after its key is typed;
 * an organization created for the purpose is removed from the organizations page after its
 * name is typed, its site going with it. Screenshots land in docs/evidence/dashboard/.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);
const shots = "docs/evidence/dashboard";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

test("an owner removes a site from its Settings and an organization from the organizations page (OPS-04, OPS-05)", async ({ page }) => {
  await signIn(page, emails.owner);

  // A site created for the purpose in the seeded organization.
  const key = `remove-me-${Date.now().toString(36)}`;
  await page.goto("/app/sites/new");
  await page.getByLabel("Site name").fill("Site to remove");
  await page.getByLabel("Internal key").fill(key);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  const siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;

  // Settings → Remove this site: the button waits for the typed key.
  await page.goto(`/app/sites/${siteId}/settings`);
  await expect(page.getByRole("heading", { name: "Remove this site" })).toBeVisible();
  const remove = page.getByRole("button", { name: "Delete this site" });
  await expect(remove).toBeDisabled();
  await page.getByLabel(/Type the site key/).fill("not-the-key");
  await expect(remove).toBeDisabled();
  await page.getByLabel(/Type the site key/).fill(key);
  await expect(remove).toBeEnabled();
  await shot(page, "b6-remove-site");
  await remove.click();
  await expect(page).toHaveURL(/\/app\?removed=site/);
  await expect(page.getByText('Site "Site to remove" was deleted.')).toBeVisible();
  await expect(page.getByRole("link", { name: "Site to remove" })).toHaveCount(0);
  await expect(page.getByText(`Removed: Site to remove (${key}`)).toBeVisible();
  expect((await page.request.get(`/demo/${key}`)).status()).toBe(404);
  expect((await page.request.get(`/app/sites/${siteId}`)).status()).toBe(404);

  // An organization created for the purpose with one site, removed from the organizations page.
  const orgName = `Removal Test ${Date.now().toString(36)}`;
  await page.goto("/app/sites/new");
  await page.locator("#organizationId").selectOption("new");
  await page.getByLabel("New organization name").fill(orgName);
  await page.getByLabel("Site name").fill("Only site");
  await page.getByLabel("Internal key").fill(`only-site-${Date.now().toString(36)}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  await page.goto("/app");
  await page.getByRole("link", { name: `Remove organization ${orgName}` }).click();
  await expect(page.getByRole("heading", { name: "Remove this organization" })).toBeVisible();
  // The site is listed among what goes (the site switcher also holds its name, as a hidden option).
  await expect(page.getByRole("listitem").filter({ hasText: "Only site" })).toBeVisible();
  const removeOrg = page.getByRole("button", { name: "Delete this organization and its 1 site" });
  await expect(removeOrg).toBeDisabled();
  await page.getByLabel(/Type the organization name/).fill(orgName);
  await expect(removeOrg).toBeEnabled();
  await shot(page, "b6-remove-organization");
  await removeOrg.click();
  await expect(page).toHaveURL(/\/app\?removed=organization/);
  await expect(page.getByText(`Organization "${orgName}" was deleted with its sites.`)).toBeVisible();
  await expect(page.getByText(orgName, { exact: true })).toHaveCount(0);
});
