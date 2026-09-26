import { test, expect } from "@playwright/test";
import { seed, emails, signIn, approveAllPages } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("edit → draft → frozen preview → publish → public page (PUB-01, PUB-02, PUB-03)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await approveAllPages(page, sites.pineHollow, ["Home", "About", "Contact"]);

  // First release.
  await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  await page.getByRole("button", { name: "Build a candidate" }).click();
  await expect(page).toHaveURL(/\/publishing\/candidates\//);
  await expect(page.getByText(/Ready to activate/)).toBeVisible();
  await page.getByRole("button", { name: "Activate this candidate" }).click();
  await expect(page.getByText(/Release activated/).first()).toBeVisible();

  // Public site in a separate browser session.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  const res = await pub.goto("/demo/pine-hollow");
  expect(res?.status()).toBe(200);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(pub.locator("h1").first()).toContainText("Pine Hollow");

  // Edit and save: public unchanged.
  const marker = `Quiet mornings ${Date.now()}`;
  await page.goto(`/app/sites/${sites.pineHollow}/content?kind=page&q=Home`);
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  await page.getByLabel("Subheading").first().fill(marker);
  // The owner's save is approved on save (review not required, B1); the public page is still unchanged.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved version \d+.*It is approved/)).toBeVisible();
  await pub.reload();
  await expect(pub.locator("body")).not.toContainText(marker);

  // Candidate built now stays frozen even if the draft changes again.
  await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  await page.getByRole("button", { name: "Build a candidate" }).click();
  await expect(page).toHaveURL(/\/publishing\/candidates\//);
  const candidateUrl = page.url();
  await expect(page.getByText("Changed (1)")).toBeVisible();
  await page.goto(`/app/sites/${sites.pineHollow}/content?kind=page&q=Home`);
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  await page.getByLabel("Subheading").first().fill(`${marker} LATER EDIT`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved version \d+/)).toBeVisible();
  const previewUrl = candidateUrl.replace("/publishing/candidates/", "/previews/") + "/render";
  await page.goto(previewUrl);
  await expect(page.locator("body")).toContainText(marker);
  await expect(page.locator("body")).not.toContainText("LATER EDIT");

  // Activate and verify the public page in the visitor session.
  await page.goto(candidateUrl);
  await page.getByRole("button", { name: "Activate this candidate" }).click();
  await expect(page.getByText(/Release activated/).first()).toBeVisible();
  await pub.reload();
  await expect(pub.locator("body")).toContainText(marker);
  await expect(pub.locator("body")).not.toContainText("LATER EDIT");
  await visitor.close();
});

test("site B is unaffected and unauthorized access is denied without leaks (AUTH-01, AUTH-02, AUTH-03)", async ({ page, browser }) => {
  const { sites } = seed();
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  const r = await anonPage.goto(`/app/sites/${sites.rangeAthletics}`);
  expect(anonPage.url()).toContain("/sign-in");
  expect(r?.status()).toBe(200);
  await anon.close();

  await signIn(page, emails.editorA);
  const denied = await page.goto(`/app/sites/${sites.rangeAthletics}`);
  expect(denied?.status()).toBe(404);
  await expect(page.locator("body")).not.toContainText("Range Athletics");
  const publishing = await page.goto(`/app/sites/${sites.pineHollow}/publishing`);
  expect(publishing?.status()).toBe(404);
  await page.goto(`/app/sites/${sites.pineHollow}`);
  await expect(page.getByRole("link", { name: "Publish", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inbox", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/sign-in/);
  const after = await page.goto(`/app/sites/${sites.pineHollow}`);
  expect(page.url()).toContain("/sign-in");
  expect(after?.status()).toBe(200);
});
