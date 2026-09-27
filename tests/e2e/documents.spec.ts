import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { emails, seed, signIn } from "./fixtures";

/**
 * Site-building programme B5-1 in the browser (SB-10): a PDF goes up through the media library
 * like a picture, is attached to an article in the editor, published, and served from the
 * public site with its type and size, under a stable content-hash address. Screenshots land in
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

async function samplePdf(title: string): Promise<Buffer> {
  const { renderSimplePdf } = await import("../../src/server/demo/documents");
  return Buffer.from(renderSimplePdf({ title, lines: ["Twelve miles of trail, marked at every junction.", "Start at the Larkspur Loop lot."] }));
}

test("a PDF is uploaded to Media, attached to an article, published and served from the public site (SB-10)", async ({ page, browser }) => {
  const { sites } = seed();
  const siteId = sites.pineHollow;
  await signIn(page, emails.owner);

  // Upload: the same form as pictures; a document needs a license but no alternative text.
  await page.goto(`/app/sites/${siteId}/media`);
  await page.getByLabel("Image files").setInputFiles({ name: "trail-map.pdf", mimeType: "application/pdf", buffer: await samplePdf("Trail map") });
  await page.getByLabel("License / rights (all files)").fill("Owned by the client");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("heading", { name: "1 document uploaded" })).toBeVisible();
  await shot(page, "b5-document-uploaded");
  await page.getByRole("button", { name: "Done" }).click();
  // The seed's own sample documents are counted with it.
  await expect(page.getByText(/\d+ images?, \d+ documents?\./)).toBeVisible();
  const card = page.locator("li", { has: page.getByRole("link", { name: /trail-map/ }) });
  await expect(card.getByText("PDF", { exact: true })).toBeVisible();
  await expect(card.getByText("licensed", { exact: true })).toBeVisible();

  // The document's page shows the reference to paste into text and opens the private copy.
  await card.getByRole("link", { name: /trail-map/ }).click();
  await expect(page.getByText(/Document \(served as uploaded\)/)).toBeVisible();
  await expect(page.getByText(/\[trail-map\]\(document:[0-9a-f-]{36}\)/)).toBeVisible();
  const assetId = page.url().match(/media\/([0-9a-f-]{36})/)![1]!;
  await page.getByLabel("Title").fill("Trail map");
  await page.getByRole("button", { name: "Save metadata" }).click();
  await expect(page.getByText("Metadata saved.")).toBeVisible();
  const privateCopy = await page.request.get(`/app/sites/${siteId}/media/${assetId}/file/document`);
  expect(privateCopy.status()).toBe(200);
  expect(privateCopy.headers()["content-type"]).toBe("application/pdf");
  expect(privateCopy.headers()["content-disposition"]).toContain('filename="Trail-map.pdf"');
  await shot(page, "b5-document-page");

  // A picture renamed as a PDF is refused by its signature, and nothing is stored.
  await page.goto(`/app/sites/${siteId}/media`);
  const { default: sharp } = await import("sharp");
  const png = await sharp({ create: { width: 200, height: 150, channels: 3, background: "#336699" } }).png().toBuffer();
  await page.getByLabel("Image files").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: png });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /does not match|not accepted/ })).toBeVisible();

  // Attach the document to an article and publish.
  await page.goto(`/app/sites/${siteId}/content?kind=article&q=${encodeURIComponent("trailheads")}`);
  await page.getByRole("link", { name: "How Pine Hollow keeps its trailheads open", exact: true }).first().click();
  await expect(page.getByLabel("Change note (optional)")).toBeVisible();
  const slug = await page.getByLabel("Slug").inputValue();
  // The seeded article already carries a sample document; the new row is the last one.
  await page.getByRole("button", { name: "Attach a document" }).click();
  await page.getByLabel("Document").last().selectOption(assetId);
  await page.getByLabel("Link text (optional)").last().fill("Trailhead map (PDF)");
  await shot(page, "b5-article-attachment");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved version \d+/)).toBeVisible();
  await page.getByRole("link", { name: "Publish…" }).click();
  await expect(page.getByRole("heading", { name: "Publish", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published as release v\d+/)).toBeVisible();

  // The public article lists the download with its type and size; the file is served with the right type from the content-hash store.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(`/demo/pine-hollow/articles/${slug}`);
  await expect(pub.getByRole("heading", { name: "Downloads" })).toBeVisible();
  const link = pub.getByRole("link", { name: "Trailhead map (PDF)" });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  expect(href).toMatch(/^\/assets\/[0-9a-f]{64}\.pdf$/);
  const row = pub.locator("li", { hasText: "Trailhead map (PDF)" });
  await expect(row.getByText(/PDF · \d+ KB/)).toBeVisible();
  await expect(row.getByRole("link", { name: "Download" })).toHaveAttribute("download", "Trailhead-map-PDF.pdf");
  await pub.screenshot({ path: `${shots}/b5-public-downloads.png`, fullPage: true });
  const served = await pub.request.get(href);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("application/pdf");
  expect(served.headers()["cache-control"]).toContain("immutable");
  expect((await served.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  // Nothing else is served from the public store, whatever the name.
  expect((await pub.request.get("/assets/" + "0".repeat(64) + ".exe")).status()).toBe(404);
  await visitor.close();
});
