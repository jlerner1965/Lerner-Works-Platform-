import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { emails, seed, signIn } from "./fixtures";

/**
 * Site-building programme B5-2 in the browser (SB-11): a link to another website is added from
 * the Links list with its address, filled in, published, and shown on the public site as a
 * card that opens the other site and as a page of its own. Screenshots land in
 * docs/evidence/dashboard/.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);
const shots = "docs/evidence/dashboard";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

test("a link to another website is added, published and opens the other site from the public listing (SB-11)", async ({ page, browser }) => {
  const { sites } = seed();
  const siteId = sites.pineHollow;
  await signIn(page, emails.owner);

  // Links are a kind of the site: one click from the sidebar, added with a title and an address.
  await page.goto(`/app/sites/${siteId}`);
  await page.getByRole("link", { name: "Links", exact: true }).first().click();
  const quickAdd = page.locator("form", { hasText: "Add a link" });
  await expect(quickAdd).toBeVisible();
  const marker = `Valley weather ${Date.now().toString(36)}`;
  await quickAdd.getByLabel("Title").fill(marker);
  await quickAdd.getByLabel("Web address").fill("https://weather.pine-hollow.example/forecast");
  await shot(page, "b5-link-quick-add");
  await quickAdd.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByLabel("Change note (optional)")).toBeVisible();
  await expect(page.getByLabel("Web address")).toHaveValue("https://weather.pine-hollow.example/forecast");
  await page.getByLabel("Category").fill("Town services");
  await page.getByLabel("Summary").fill("The forecast the trail crews read before they leave the lot.");
  await page.getByLabel("Button label").fill("Open the forecast");
  const slug = await page.getByLabel("Slug").inputValue();
  await shot(page, "b5-link-editor");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved version \d+/)).toBeVisible();
  await page.getByRole("link", { name: "Publish…" }).click();
  await expect(page.getByRole("heading", { name: "Publish", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published as release v\d+/)).toBeVisible();

  // The public listing shows the card opening the other website; the link's own page has the button.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/demo/pine-hollow/links");
  await expect(pub.getByRole("heading", { name: "Links", exact: true })).toBeVisible();
  const card = pub.getByRole("link", { name: new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", "https://weather.pine-hollow.example/forecast");
  await expect(card).toHaveAttribute("rel", "noreferrer");
  await expect(pub.getByText("weather.pine-hollow.example").first()).toBeVisible();
  await pub.screenshot({ path: `${shots}/b5-public-links.png`, fullPage: true });
  await pub.goto(`/demo/pine-hollow/links/${slug}`);
  await expect(pub.getByRole("heading", { level: 1, name: marker })).toBeVisible();
  const button = pub.getByRole("link", { name: /Open the forecast/ });
  await expect(button).toHaveAttribute("href", "https://weather.pine-hollow.example/forecast");
  await expect(button).toHaveAttribute("rel", "noreferrer");
  await expect(pub.getByText("The forecast the trail crews read before they leave the lot.")).toBeVisible();
  // Search finds it with the other site's host as its meta line.
  await pub.goto("/demo/pine-hollow/search?q=forecast");
  await expect(pub.getByRole("link", { name: marker })).toBeVisible();
  await expect(pub.getByText(/Town services · weather\.pine-hollow\.example/)).toBeVisible();
  await visitor.close();
});
