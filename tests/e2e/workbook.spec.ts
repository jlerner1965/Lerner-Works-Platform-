import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { emails, seed, signIn } from "./fixtures";

/**
 * Site-building programme B5-3 in the browser (SB-12): the owner downloads the onboarding
 * workbook, a filled-in workbook is uploaded on its own on the Import & export page, the dry run
 * lists its sheets and rows, and confirming imports and publishes them. Screenshots land in
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

async function filledWorkbook(): Promise<Buffer> {
  const { writeWorkbook } = await import("../../src/server/import/xlsx");
  return Buffer.from(
    writeWorkbook([
      { name: "Read me", rows: [["Filled in for the browser test."]] },
      { name: "Places", rows: [
        ["external_id", "title", "category", "summary", "address_line1", "locality", "last_verified_on"],
        ["WB-1", "Millrace Brewing", "Eat & Drink", "Small-batch ales in the old mill building, with a patio over the millrace.", "1 Mill Road", "Pine Hollow", "2026-09-20"],
        ["WB-2", "Juniper Yoga Studio", "Wellness", "Morning and evening classes for every level; mats provided, first visit free.", "8 Aspen Lane", "Pine Hollow", "2026-09-20"],
      ] },
      // A title and address no fixture link carries, so the public check finds exactly this card.
      { name: "Links", rows: [["external_id", "title", "url", "category", "summary"], ["WB-L1", "Pass and plow report", "https://passes.pine-hollow.example", "Town services", "Closures and chain laws for the passes."]] },
    ]),
  );
}

test("a filled-in workbook uploaded on its own is dry-run, imported and published (SB-12)", async ({ page, browser }) => {
  const { sites } = seed();
  const siteId = sites.pineHollow;
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${siteId}/import`);

  // The workbook template downloads as an Excel file with the preset's sheets.
  const download = await page.request.get(`/app/sites/${siteId}/import/workbook-template`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const { readWorkbook } = await import("../../src/server/import/xlsx");
  expect(readWorkbook(new Uint8Array(await download.body())).map((s) => s.name)).toEqual(["Read me", "Places", "Events", "Articles", "Links", "Site", "Images", "Documents"]);

  const form = page.locator("form", { has: page.locator('input[name="type"][value="onboarding"]') });
  await form.locator('input[type="file"]').setInputFiles({ name: "cedar-bend.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: await filledWorkbook() });
  await form.getByRole("button", { name: "Upload and run dry run" }).click();
  await expect(page.getByText(/Dry run: 3 row\(s\) to import/)).toBeVisible();
  await expect(page.getByText("Workbook content.xlsx")).toBeVisible();
  await expect(page.getByText(/read as/).first()).toBeVisible();
  await expect(page.getByText(/places\.csv: 2 to create/)).toBeVisible();
  await expect(page.getByText(/links\.csv: 1 to create/)).toBeVisible();
  await shot(page, "b5-workbook-dry-run");
  await page.getByRole("button", { name: /^Import 3 row\(s\)/ }).click();
  await expect(page.getByText(/Import applied: 3 created/)).toBeVisible();

  // Imported by an owner on a site without review: approved, so one publish puts them on the public site.
  await page.goto(`/app/sites/${siteId}/publishing`);
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published as release v\d+/)).toBeVisible();
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/demo/pine-hollow/places?category=Wellness");
  await expect(pub.getByRole("link", { name: "Juniper Yoga Studio" })).toBeVisible();
  await pub.goto("/demo/pine-hollow/links");
  await expect(pub.getByRole("link", { name: /Pass and plow report/ })).toHaveAttribute("href", "https://passes.pine-hollow.example");
  await visitor.close();
});
