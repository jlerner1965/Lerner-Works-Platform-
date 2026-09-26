import { test, expect } from "@playwright/test";
import { seed, emails, signIn } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("keyboard: mobile navigation drawer traps and returns focus; public form error summary receives focus (UX-01)", async ({ browser }) => {
  const { sites } = seed();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}`);
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Dashboard navigation" });
  await expect(dialog).toBeVisible();
  const focusedInside = await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")));
  expect(focusedInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const backOnButton = await page.evaluate(() => document.activeElement?.textContent === "Menu");
  expect(backOnButton).toBe(true);

  // Public inquiry form: submitting with errors moves focus to the error summary.
  await page.goto("/demo/range-athletics/contact");
  await page.getByRole("button", { name: "Send inquiry" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Please fix the following:")).toBeVisible();
  const summaryFocused = await page.evaluate(() => document.activeElement?.getAttribute("role") === "alert");
  expect(summaryFocused).toBe(true);
  // Skip link is the first tab stop on public pages.
  await page.goto("/demo/pine-hollow");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Skip to content");
  await ctx.close();
});

test("keyboard: editor sections reorder with Move up/Move down buttons", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}/content?kind=page&q=Home`);
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  const list = page.locator("fieldset", { hasText: "Page sections" }).locator("ol > li");
  const first = (await list.nth(0).innerText()).split("\n")[0];
  const second = (await list.nth(1).innerText()).split("\n")[0];
  await page.getByRole("button", { name: "Move section 2 up" }).focus();
  await page.keyboard.press("Enter");
  expect((await list.nth(0).innerText()).split("\n")[0]).toBe(second!.replace(/^2\./, "1."));
  expect((await list.nth(1).innerText()).split("\n")[0]).toBe(first!.replace(/^1\./, "2."));
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
});

test("no horizontal overflow at 200% zoom equivalent (720 CSS px) on representative pages (UX-02)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const { sites } = seed();
  for (const path of ["/demo/pine-hollow", "/demo/pine-hollow/places", "/demo/pine-hollow/events", "/demo/range-athletics", "/demo/range-athletics/locations/longmont", "/demo/range-athletics/contact"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${path} overflows at 720px`).toBe(false);
  }
  await signIn(page, emails.owner);
  for (const path of [`/app/sites/${sites.pineHollow}`, `/app/sites/${sites.pineHollow}/content`, `/app/sites/${sites.pineHollow}/publishing`, `/app/sites/${sites.pineHollow}/settings`]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${path} overflows at 720px`).toBe(false);
  }
  await ctx.close();
});
