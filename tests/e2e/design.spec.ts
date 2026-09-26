import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { seed, emails, signIn } from "./fixtures";

/** Design programme D1 in the browser: DES-06 (theme vocabulary), DES-07 (focal point), DES-08 (click-to-load video). */
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

async function openPageEditor(page: Page, siteId: string, title: string): Promise<void> {
  await page.goto(`/app/sites/${siteId}/content?kind=page&q=${encodeURIComponent(title)}`);
  await page.getByRole("link", { name: title, exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
}

test("the editor offers only the styles the site's theme renders (DES-06)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await openPageEditor(page, sites.rangeAthletics, "Home");
  const retailHeroStyle = page.getByLabel("Style").first();
  const retailOptions = await retailHeroStyle.locator("option").allTextContents();
  expect(retailOptions).toContain("Full-width image with text over it");
  expect(retailOptions.join(" | ")).not.toContain("beside");
  await openPageEditor(page, sites.pineHollow, "Home");
  const guideOptions = await page.getByLabel("Style").first().locator("option").allTextContents();
  expect(guideOptions.join(" | ")).toContain("beside");
  // The section type list is the theme's as well: the guide has no location collection.
  const guideTypes = await page.locator("#add-section option").allTextContents();
  expect(guideTypes).toContain("Video (click to play)");
  expect(guideTypes).toContain("Questions and answers");
  expect(guideTypes.join(" | ")).not.toMatch(/Location/);
});

test("owners set site-wide design options; the change is audited and only owners see the card (DES-06)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}/settings`);
  const designCard = () => page.locator("section").filter({ has: page.getByRole("heading", { name: "Design", exact: true }) });
  await expect(designCard().getByLabel("Corner radius")).toHaveValue("none");
  await designCard().getByLabel("Corner radius").selectOption("medium");
  await designCard().getByLabel("Spacing").selectOption("spacious");
  await designCard().getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();
  await page.reload();
  await expect(designCard().getByLabel("Corner radius")).toHaveValue("medium");
  await expect(designCard().getByLabel("Spacing")).toHaveValue("spacious");
  await page.goto(`/app/sites/${sites.pineHollow}/audit`);
  await expect(page.getByText("design.updated").first()).toBeVisible();
  // Put the fixture values back so later tests and screenshots see the composed pilot.
  await page.goto(`/app/sites/${sites.pineHollow}/settings`);
  await designCard().getByLabel("Corner radius").selectOption("none");
  await designCard().getByLabel("Spacing").selectOption("regular");
  await designCard().getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Design saved as configuration revision/)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, emails.editorA);
  await page.goto(`/app/sites/${sites.pineHollow}/settings`);
  await expect(page.getByRole("heading", { name: "Design", exact: true })).toHaveCount(0);
});

test("a published focal point positions every crop of the hero at 390, 768 and 1440 (DES-07)", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo/range-athletics");
    const hero = page.locator("img[style*='object-position']").first();
    await expect(hero).toBeVisible();
    const position = await hero.evaluate((el) => getComputedStyle(el).objectPosition);
    expect(position, `at ${width}px`).toBe("50% 38%");
    const fit = await hero.evaluate((el) => getComputedStyle(el).objectFit);
    expect(fit, `at ${width}px`).toBe("cover");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `overflow at ${width}px`).toBe(false);
  }
});

test("a video section loads nothing from the provider until the visitor activates it with the keyboard (DES-08)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await openPageEditor(page, sites.pineHollow, "About the guide");
  await page.locator("#add-section").selectOption("video");
  const videoSection = page.locator("ol > li", { hasText: "Video (click to play)" }).last();
  await videoSection.getByLabel("Video id").fill("dQw4w9WgXcQ");
  await videoSection.getByLabel("Video title").fill("Trail day recap");
  const poster = videoSection.getByLabel("Poster image");
  const posterOptions = await poster.locator("option").allTextContents();
  expect(posterOptions.length).toBeGreaterThan(1);
  await poster.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/Saved version \d+/)).toBeVisible();
  await page.getByRole("button", { name: /^Approve/ }).click();
  await expect(page.getByText("Revision approved.")).toBeVisible();
  await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  await page.getByRole("button", { name: "Build candidate" }).click();
  await expect(page).toHaveURL(/\/publishing\/candidates\//);
  await expect(page.getByText(/Ready to activate/)).toBeVisible();
  const previewUrl = page.url().replace("/publishing/candidates/", "/previews/") + "/render/about";

  // Load the frozen preview with every third-party host watched.
  const thirdParty: string[] = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async (route) => {
    thirdParty.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title>" });
  });
  await page.goto(previewUrl);
  const play = page.getByRole("button", { name: "Play video: Trail day recap" });
  await expect(play).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(thirdParty).toEqual([]);

  // Keyboard: move focus to the play control and press Enter.
  for (let i = 0; i < 60; i++) {
    if (await play.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  expect(await play.evaluate((el) => el === document.activeElement)).toBe(true);
  await page.keyboard.press("Enter");
  const frame = page.locator("iframe");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  await expect(frame).toHaveAttribute("title", "Trail day recap");
  await expect.poll(() => thirdParty.length).toBeGreaterThan(0);
  expect(thirdParty.every((u) => u.startsWith("https://www.youtube-nocookie.com/"))).toBe(true);

  // The public site is untouched until activation; remove the section again so the pilot stays as composed.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/demo/pine-hollow/about");
  await expect(pub.getByRole("button", { name: /Play video/ })).toHaveCount(0);
  await visitor.close();
  await openPageEditor(page, sites.pineHollow, "About the guide");
  const removeButtons = page.getByRole("button", { name: /^Remove section \d+$/ });
  await expect(removeButtons.last()).toBeVisible();
  await removeButtons.last().click();
  await expect(page.getByLabel("Video id")).toHaveCount(0);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/Saved version \d+/)).toBeVisible();
  await page.getByRole("button", { name: /^Approve/ }).click();
  await expect(page.getByText("Revision approved.")).toBeVisible();
});
