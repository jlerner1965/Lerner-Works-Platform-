import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { seed, emails, signIn } from "./fixtures";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  // Load the fictional fixtures (idempotent) so the public sites have content.
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

test("directory filters, search with no results, reset and browser back (UX-03)", async ({ page }) => {
  await page.goto("/demo/pine-hollow/places");
  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible();
  await page.getByRole("link", { name: "Outdoors" }).click();
  await expect(page).toHaveURL(/category=Outdoors/);
  await expect(page.getByRole("heading", { name: "Larkspur Loop Trailhead" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creekside Coffee Roasters" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Larkspur Loop Trailhead" })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/category=/);
  await expect(page.getByRole("heading", { name: "Creekside Coffee Roasters" })).toBeVisible();

  await page.goto("/demo/pine-hollow/search?q=zzzznothing");
  await expect(page.getByText(/No results for/)).toBeVisible();
  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page.goto("/demo/pine-hollow/search?q=coffee");
  await expect(page.getByRole("link", { name: "Creekside Coffee Roasters", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saddleback Outfitters" })).toHaveCount(0); // unapproved draft never public
});

test("events show cancellation, time zone and past/upcoming state; stores show hours truthfully (TIME-01, TIME-02)", async ({ page }) => {
  await page.goto("/demo/pine-hollow/events");
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText(/MDT|MST/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Summer Concert on the Green" })).toHaveCount(0);
  await page.goto("/demo/pine-hollow/events?show=past");
  await expect(page.getByRole("link", { name: "Summer Concert on the Green" })).toBeVisible();
  await page.goto("/demo/pine-hollow/events/star-party-at-timber-falls");
  await expect(page.getByText(/8:30 PM – Oct \d+ 12:30 AM|8:30 PM – \w+ \d+ 12:30 AM/)).toBeVisible();

  await page.goto("/demo/range-athletics/locations/fort-collins");
  await expect(page.getByText("Temporarily closed").first()).toBeVisible();
  await expect(page.getByText("Open now")).toHaveCount(0);
  await page.goto("/demo/pine-hollow/places/hollow-bakery-provisions");
  await expect(page.getByText("Hours not published")).toBeVisible();
  await page.goto("/demo/range-athletics/locations/longmont");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Directions unavailable")).toBeVisible();
});

test("public inquiry form validates inline, preserves input and returns a receipt (LEAD-01)", async ({ page }) => {
  await page.goto("/demo/range-athletics/contact");
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByText("Please fix the following:")).toBeVisible();
  await page.getByLabel(/^Name/).fill("Test Visitor");
  await page.getByLabel(/^Email/).fill("visitor@example.test");
  await page.getByLabel(/^Message/).fill("Do you have wide trail shoes?");
  await page.getByLabel(/About which location/).selectOption({ label: "Range Athletics Boulder" });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByText(/Receipt reference/)).toBeVisible();
  const receipt = (await page.getByText(/LW-[0-9A-F]{8}/).innerText()).match(/LW-[0-9A-F]{8}/)![0];
  const { sites } = seed();
  await signIn(page, emails.publisherB);
  await page.goto(`/app/sites/${sites.rangeAthletics}/inquiries`);
  await expect(page.getByText(receipt)).toBeVisible();
});

test("media upload rejects an SVG and accepts a PNG, whose alternative text is asked for right after (MEDIA-01)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}/media`);
  await page.getByLabel("Image files").setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "SVG is not accepted" })).toBeVisible();
  const { default: sharp } = await import("sharp");
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#2f5d3a" } }).png().toBuffer();
  await page.getByLabel("Image files").setInputFiles({ name: "e2e-test-image.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("License / rights (all files)").fill("CC0");
  await page.getByRole("button", { name: "Upload" }).click();
  // The alt-text pass lists the upload under its title (the file name) and saves the text (B2-3).
  await expect(page.getByRole("heading", { name: /Alternative text for 1 uploaded image/ })).toBeVisible();
  await page.getByLabel("e2e-test-image", { exact: true }).fill("A solid green rectangle");
  await page.getByRole("button", { name: /Save alternative text for 1 image/ }).click();
  await expect(page.getByText(/Saved alternative text for 1 image/)).toBeVisible();
  const card = page.locator("li", { has: page.getByRole("link", { name: /e2e-test-image/ }) });
  await expect(card.getByText("alt text", { exact: true })).toBeVisible();
  await expect(card.getByText("licensed", { exact: true })).toBeVisible();
});
