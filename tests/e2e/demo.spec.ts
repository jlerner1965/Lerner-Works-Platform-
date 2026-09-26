import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { seed, emails, signIn } from "./fixtures";

/**
 * The ten-step demonstration from the build guide (section 24), driven entirely through the
 * interface with two browser sessions. Screenshots land in docs/evidence/demo/.
 */
test.describe.configure({ mode: "serial" });
const shots = "docs/evidence/demo";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
});

test("steps 1–6: dashboard, homepages, editor edit → review → approve → candidate → preview → publish, denied access", async ({ browser }) => {
  const { sites } = seed();
  const agency = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const owner = await agency.newPage();
  await signIn(owner, emails.owner);
  await expect(owner.getByRole("heading", { name: /Pine Hollow Guide Co-op \(fictional\)/ })).toBeVisible();
  await expect(owner.getByRole("heading", { name: /Range Athletics Inc\. \(fictional\)/ })).toBeVisible();
  await shot(owner, "01-dashboard-organizations");
  await owner.goto(`/app/sites/${sites.pineHollow}`);
  await expect(owner.getByText("Waiting for review").locator("..")).toContainText("1");
  await shot(owner, "01b-site-overview-pending-actions");

  const visitorCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const visitor = await visitorCtx.newPage();
  await visitor.goto("/demo/pine-hollow");
  await shot(visitor, "02-pine-hollow-home");
  await visitor.goto("/demo/range-athletics");
  await shot(visitor, "02-range-athletics-home");

  // Step 3: editor A edits a guide event and saves; public unchanged.
  const editorCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const editor = await editorCtx.newPage();
  await signIn(editor, emails.editorA);
  await editor.goto(`/app/sites/${sites.pineHollow}/content?kind=event&q=Harvest`);
  await editor.getByRole("link", { name: "Harvest Market on Aspen Street" }).click();
  const marker = `Bring bags; the cider tent opens at noon (${Date.now()}).`;
  await editor.getByLabel("Summary").fill(marker);
  await editor.getByRole("button", { name: "Save draft" }).click();
  await expect(editor.getByText(/Saved version/)).toBeVisible();
  await shot(editor, "03-editor-saved-event");
  await visitor.goto("/demo/pine-hollow/events/harvest-market-on-aspen-street");
  await expect(visitor.locator("body")).not.toContainText(marker);
  await shot(visitor, "03b-public-event-unchanged");

  // Step 4: submit for review; publisher inspects difference and approves.
  await editor.getByRole("button", { name: "Request review" }).click();
  await expect(editor.getByText("Submitted for review.")).toBeVisible();
  await owner.goto(`/app/sites/${sites.pineHollow}/reviews`);
  await expect(owner.getByRole("link", { name: "Harvest Market on Aspen Street" })).toBeVisible();
  await shot(owner, "04-review-queue");
  await owner.getByRole("link", { name: "Harvest Market on Aspen Street" }).click();
  await owner.getByRole("link", { name: "Revision history" }).click();
  await expect(owner.getByText(/Changed: Summary/)).toBeVisible();
  await shot(owner, "04b-revision-difference");
  await owner.goBack();
  await owner.getByRole("button", { name: /^Approve v\d+$/ }).click();
  await expect(owner.getByText("Revision approved.")).toBeVisible();

  // Step 5: build candidate, preview, publish; the change is public.
  await owner.goto(`/app/sites/${sites.pineHollow}/publishing`);
  await owner.getByRole("button", { name: "Build a candidate" }).click();
  await expect(owner.getByText(/Ready to activate/)).toBeVisible();
  await expect(owner.getByText("Changed (1)")).toBeVisible();
  await shot(owner, "05-candidate-summary");
  const candidateUrl = owner.url();
  await owner.goto(candidateUrl.replace("/publishing/candidates/", "/previews/") + "?path=%2Fevents%2Fharvest-market-on-aspen-street");
  await expect(owner.frameLocator("iframe").locator("body")).toContainText(marker);
  await shot(owner, "05b-frozen-preview");
  await owner.goto(candidateUrl);
  await owner.getByRole("button", { name: "Activate this candidate" }).click();
  await expect(owner.getByText(/Release activated/).first()).toBeVisible();
  await visitor.reload();
  await expect(visitor.locator("body")).toContainText(marker);
  await shot(visitor, "05c-public-event-updated");

  // Step 6: editor A tries organization B.
  const denied = await editor.goto(`/app/sites/${sites.rangeAthletics}`);
  expect(denied?.status()).toBe(404);
  await expect(editor.locator("body")).not.toContainText("Range Athletics");
  await shot(editor, "06-editor-denied-org-b");
  await agency.close();
  await visitorCtx.close();
  await editorCtx.close();
});

test("steps 7–9: holiday hours update, inquiry to inbox with delivery status, restore previous release", async ({ browser }) => {
  const { sites } = seed();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const publisher = await ctx.newPage();
  await signIn(publisher, emails.publisherB);
  await publisher.goto(`/app/sites/${sites.rangeAthletics}/content?kind=store&q=Longmont`);
  await publisher.getByRole("link", { name: "Range Athletics Longmont" }).click();
  await publisher.getByRole("button", { name: "Add date exception" }).click();
  const row = publisher.locator("fieldset", { hasText: "Date exceptions" }).locator("div.rounded").last();
  await row.getByLabel("Date").fill("2026-12-24");
  await row.getByLabel("Label").fill("Christmas Eve");
  await row.getByLabel("Closed all day").uncheck();
  await row.getByRole("button", { name: "Add interval" }).click();
  // A publisher's save is approved on save: the pilot does not require a separate review (B1).
  await publisher.getByRole("button", { name: "Save", exact: true }).click();
  await expect(publisher.getByText(/Saved version \d+.*It is approved/)).toBeVisible();
  await shot(publisher, "07-store-hours-edited");
  await publisher.goto(`/app/sites/${sites.rangeAthletics}/publishing`);
  await publisher.getByRole("button", { name: "Build a candidate" }).click();
  await expect(publisher.getByText(/Ready to activate/)).toBeVisible();
  await publisher.getByRole("button", { name: "Activate this candidate" }).click();
  await expect(publisher.getByText(/Release activated/).first()).toBeVisible();
  const visitorCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const visitor = await visitorCtx.newPage();
  await visitor.goto("/demo/range-athletics/locations/longmont");
  await expect(visitor.getByText(/Christmas Eve/)).toBeVisible();
  await shot(visitor, "07b-public-store-holiday-hours");

  // Step 8: inquiry → inbox → delivery status after the worker runs.
  await visitor.getByLabel(/^Name/).fill("Demo Visitor");
  await visitor.getByLabel(/^Email/).fill("demo-visitor@example.test");
  await visitor.getByLabel(/^Message/).fill("Is the ski tuning bench open on Christmas Eve?");
  await visitor.getByRole("button", { name: "Send inquiry" }).click();
  const receipt = (await visitor.getByText(/LW-[0-9A-F]{8}/).innerText()).match(/LW-[0-9A-F]{8}/)![0];
  await shot(visitor, "08-inquiry-receipt");
  await publisher.goto(`/app/sites/${sites.rangeAthletics}/inquiries`);
  await expect(publisher.getByText(receipt)).toBeVisible();
  await publisher.locator("tr", { hasText: receipt }).getByRole("link").first().click();
  await expect(publisher).toHaveURL(/\/inquiries\/[0-9a-f-]{36}/);
  await expect(publisher.getByText("pending", { exact: true }).first()).toBeVisible();
  execFileSync("pnpm", ["exec", "tsx", "scripts/worker.ts", "--once"], { stdio: "inherit", env: { ...process.env, DATABASE_ADMIN_URL: process.env.DATABASE_TEST_ADMIN_URL, DATABASE_URL: process.env.DATABASE_TEST_URL, NOTIFY_LOCAL_DIR: ".data/test-mail", STORAGE_LOCAL_DIR: ".data/test-storage" } });
  await publisher.reload();
  await expect(publisher.getByText("delivered", { exact: true }).first()).toBeVisible();
  await expect(publisher.getByText("Local notification log")).toHaveCount(0);
  await shot(publisher, "08b-inbox-record-delivery-status");

  // Step 9: restore the previous retailer release; old hours back, inquiry preserved.
  await publisher.goto(`/app/sites/${sites.rangeAthletics}/publishing`);
  const historical = publisher.locator("table tbody tr").nth(1).getByRole("link");
  await historical.click();
  await publisher.getByLabel(/Reason for restoring/).fill("Holiday hours were entered against the wrong store");
  await publisher.getByRole("button", { name: /Restore v\d+ as a new release/ }).click();
  await expect(publisher.getByText(/Release restored as a new release/)).toBeVisible();
  await shot(publisher, "09-restored-release");
  await visitor.goto("/demo/range-athletics/locations/longmont");
  await expect(visitor.getByText(/Christmas Eve/)).toHaveCount(0);
  await publisher.goto(`/app/sites/${sites.rangeAthletics}/inquiries`);
  await expect(publisher.getByText(receipt)).toBeVisible();
  await shot(publisher, "09b-inquiry-survives-restore");
  await ctx.close();
  await visitorCtx.close();
});

test("step 10: create a third blank site from a preset and import the portable package as drafts", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  const zip = await page.request.get(`/app/sites/${sites.pineHollow}/export/package`);
  expect(zip.status()).toBe(200);
  const zipBytes = await zip.body();
  await page.goto("/app/sites/new");
  await page.getByLabel("Site name").fill("Cedar Bend Guide");
  await page.getByLabel("Internal key").fill(`cedar-bend-${Date.now().toString(36)}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  await shot(page, "10-site-created-from-preset");
  const siteC = page.url().split("/app/sites/")[1]!.split("?")[0]!;
  await page.goto(`/app/sites/${siteC}/import`);
  const packageForm = page.locator("form", { has: page.locator('input[name="type"][value="package"]') });
  await packageForm.locator('input[type="file"]').setInputFiles({ name: "pine-hollow.zip", mimeType: "application/zip", buffer: zipBytes });
  await packageForm.getByRole("button", { name: "Upload and validate" }).click();
  await expect(page.getByText(/The package is well-formed/)).toBeVisible();
  await shot(page, "10b-package-validated");
  await page.getByRole("button", { name: "Import package as drafts" }).click();
  await expect(page.getByText(/Import applied/)).toBeVisible();
  await page.goto(`/app/sites/${siteC}/content?kind=place`);
  await expect(page.getByRole("link", { name: "Creekside Coffee Roasters" })).toBeVisible();
  await shot(page, "10c-imported-content-drafts");
  await page.goto(`/app/sites/${siteC}/content?kind=place&q=Creekside`);
  await page.getByRole("link", { name: "Creekside Coffee Roasters" }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Creekside Coffee Roasters");
  await expect(page.getByText("not published", { exact: true }).first()).toBeVisible();
});
