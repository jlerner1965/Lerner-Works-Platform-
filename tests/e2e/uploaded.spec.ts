import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type http from "node:http";
import { strToU8, unzipSync, zipSync, strFromU8 } from "fflate";
import { emails, seed, signIn } from "./fixtures";
import { FAKE_GITHUB_HEADLINES, FAKE_GITHUB_TOKEN, startFakeGithub } from "./fake-github";

/**
 * Uploaded sites in the browser (site-building programme B7, UP-01 to UP-04; B8, UP-05 to
 * UP-07): the owner creates an uploaded site, uploads the sample ZIP (in parts, B8),
 * publishes it, opens it on its preview hostname (clean addresses, the stylesheet applied,
 * the site's own 404 page), sends the contact form and finds the message in the inbox,
 * uploads a second version and restores the first; a repository download with housekeeping
 * files is checked with those files left out; the site is fetched from GitHub, public and,
 * with the organization's token, private. Screenshots land in docs/evidence/dashboard/.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
const shots = "docs/evidence/dashboard";
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const PORT = process.env.E2E_PORT ?? "3100";

let github: http.Server;
let siteId = "";
let key = "";

test.beforeAll(async () => {
  fs.mkdirSync(shots, { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test"], { stdio: "inherit", env: { ...process.env, SEED_FIXED_PASSWORD: seed().password } });
  github = await startFakeGithub();
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => github?.close(() => resolve()));
});

test("an uploaded site goes from a ZIP to a preview with a working form, a second version and a restore (UP-01..04)", async ({ page }) => {
  await signIn(page, emails.owner);

  // An uploaded site: no preset to choose, no starter pages.
  key = `harbor-${Date.now().toString(36)}`;
  await page.goto("/app/sites/new");
  await page.getByRole("radio", { name: /^Uploaded/ }).check();
  await expect(page.getByText("Preset", { exact: true })).toHaveCount(0);
  await page.getByLabel("Site name").fill("Harbor Lane Studio");
  await page.getByLabel("Internal key").fill(key);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created. Upload the site's ZIP to publish it")).toBeVisible();
  siteId = page.url().split("/app/sites/")[1]!.split("?")[0]!;
  await expect(page.getByRole("link", { name: "Upload", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Places", exact: true })).toHaveCount(0);
  expect((await page.request.get(`/app/sites/${siteId}/content`)).status()).toBe(404);

  // The sample ZIP, uploaded in parts (the test server keeps parts small), checked, published.
  const sample = await page.request.get(`/app/sites/${siteId}/upload/sample`);
  expect(sample.status()).toBe(200);
  const zipBytes = await sample.body();
  let parts = 0;
  page.on("request", (r) => {
    if (r.url().includes("/upload/part?")) parts++;
  });
  await page.getByRole("link", { name: "Upload the site" }).click();
  await expect(page.getByRole("heading", { name: "Upload", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "harbor-lane-studio.zip", mimeType: "application/zip", buffer: zipBytes });
  await page.getByRole("button", { name: "Upload and check" }).click();
  await expect(page.getByRole("heading", { name: "Upload checked" })).toBeVisible();
  expect(parts).toBeGreaterThan(1);
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

test("a repository download is checked with its housekeeping left out, and a project that has to be built is told so (UP-06)", async ({ page }) => {
  await signIn(page, emails.owner);
  const sample = unzipSync(await (await page.request.get(`/app/sites/${siteId}/upload/sample`)).body());
  const repo: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(sample)) repo[`harbor-site-main/${name}`] = data;
  repo["harbor-site-main/README.md"] = strToU8("# Harbor");
  repo["harbor-site-main/LICENSE"] = strToU8("MIT");
  repo["harbor-site-main/.gitignore"] = strToU8("node_modules");
  repo["harbor-site-main/scripts/deploy.sh"] = strToU8("#!/bin/sh");
  await page.goto(`/app/sites/${siteId}/upload`);
  await page.locator('input[type="file"]').setInputFiles({ name: "harbor-site-main.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(repo)) });
  await page.getByRole("button", { name: "Upload and check" }).click();
  await expect(page.getByRole("heading", { name: "Upload checked" })).toBeVisible();
  await expect(page.getByText("Left out, repository housekeeping: /README.md, /LICENSE.")).toBeVisible();
  await expect(page.getByText(/Left out as server-side code: \/scripts\/deploy\.sh/)).toBeVisible();
  await page.getByText("4 left out").click();
  await expect(page.getByRole("cell", { name: "/.gitignore" })).toBeVisible();
  await shot(page, "b8-repository-download-checked");

  const project = zipSync({ "package.json": strToU8("{}"), "src/App.tsx": strToU8("export default 1"), "src/index.css": strToU8("") });
  await page.goto(`/app/sites/${siteId}/upload`);
  await page.locator('input[type="file"]').setInputFiles({ name: "project.zip", mimeType: "application/zip", buffer: Buffer.from(project) });
  await page.getByRole("button", { name: "Upload and check" }).click();
  await expect(page.getByRole("heading", { name: "This upload cannot be published" })).toBeVisible();
  await expect(page.getByText(/looks like a project that has to be built first/)).toBeVisible();
});

test("the site is fetched from GitHub, public and then private with the organization's token, and the source is remembered (UP-07)", async ({ page }) => {
  await signIn(page, emails.owner);
  const preview = `http://${key}.preview.localhost:${PORT}`;

  await page.goto(`/app/sites/${siteId}/upload`);
  await page.getByLabel("Repository").fill("https://github.com/harbor/site");
  await page.getByRole("button", { name: "Fetch and check" }).click();
  await expect(page.getByRole("heading", { name: "Upload checked" })).toBeVisible();
  await expect(page.getByText(/From GitHub: harbor\/site, branch main, commit/)).toBeVisible();
  await shot(page, "b8-github-checked");
  await page.getByRole("button", { name: /Publish as release v/ }).click();
  await expect(page.getByText(/Published release v\d+\./)).toBeVisible();
  await page.goto(`${preview}/`);
  await expect(page.getByRole("heading", { level: 1, name: FAKE_GITHUB_HEADLINES.public })).toBeVisible();
  await page.goto(`/app/sites/${siteId}/upload`);
  await expect(page.getByText("harbor/site @ main", { exact: true })).toBeVisible();
  await expect(page.getByText(/Live: commit 89abcde/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Check the latest from GitHub" })).toBeVisible();
  await shot(page, "b8-github-source");

  // A private repository needs the token; the owner stores it on the organizations page.
  await page.getByLabel("Repository").fill("harbor/private-site");
  await page.getByRole("button", { name: "Check the latest from GitHub" }).click();
  await expect(page.getByText(/private and no token with access/)).toBeVisible();
  await page.goto("/app");
  await page.getByLabel("GitHub token for private repositories (optional)").first().fill(FAKE_GITHUB_TOKEN);
  await page.getByRole("button", { name: "Save token" }).first().click();
  await expect(page.getByRole("status").first()).toContainText("GitHub accepted the token of harbor-bot");
  await expect(page.getByText(/A GitHub token ending in/).first()).toBeVisible();
  await shot(page, "b8-github-token");
  await page.goto(`/app/sites/${siteId}/upload`);
  await page.getByLabel("Repository").fill("harbor/private-site");
  await page.getByRole("button", { name: "Check the latest from GitHub" }).click();
  await expect(page.getByRole("heading", { name: "Upload checked" })).toBeVisible();
  await expect(page.getByText(/From GitHub: harbor\/private-site, branch main/)).toBeVisible();
  await page.getByRole("button", { name: /Publish as release v/ }).click();
  await expect(page.getByText(/Published release v\d+\./)).toBeVisible();
  await page.goto(`${preview}/`);
  await expect(page.getByRole("heading", { level: 1, name: FAKE_GITHUB_HEADLINES.private })).toBeVisible();

  // The token can be removed; the private repository is out of reach again.
  await page.goto("/app");
  await page.getByRole("button", { name: "Remove token" }).first().click();
  await expect(page.getByRole("status").first()).toContainText("The token was removed.");
});

test("a deploy token lets a CI push a built site, with its own redirects and headers honoured (UP-08, UP-09)", async ({ page }) => {
  await signIn(page, emails.owner);
  const preview = `http://${key}.preview.localhost:${PORT}`;

  await page.goto(`/app/sites/${siteId}/upload`);
  await page.getByLabel("Label (optional)").fill("GitHub Actions");
  await page.getByRole("button", { name: "Create deploy token" }).click();
  await expect(page.getByText("Token created; copy it now, it is not shown again")).toBeVisible();
  const token = (await page.locator("code", { hasText: /^lwd_[0-9a-f]{40}$/ }).first().textContent())!.trim();
  await expect(page.getByText("bash deploy.sh dist")).toBeVisible();
  await shot(page, "b9-deploy-token");
  expect((await page.request.get("/deploy.sh")).status()).toBe(200);

  // The deploy as the script does it, against the real endpoints: begin, the parts, complete.
  const files = unzipSync(await (await page.request.get(`/app/sites/${siteId}/upload/sample`)).body());
  files["index.html"] = strToU8(strFromU8(files["index.html"]!).replace("Furniture made to be handed down.", "Deployed from CI."));
  files["_redirects"] = strToU8("/compare/ /about/ 301\n");
  files["_headers"] = strToU8("/*\n  X-Frame-Options: DENY\n");
  const zip = Buffer.from(zipSync(files));
  const auth = { Authorization: `Bearer ${token}` };
  const opened = await (await page.request.post("/api/deploy/begin", { headers: { ...auth, "Content-Type": "application/json" }, data: { filename: "site.zip", size: zip.byteLength } })).json();
  expect(opened.ok).toBe(true);
  for (let i = 0; i < opened.parts; i++) {
    const res = await page.request.put(`/api/deploy/part?session=${opened.session}&index=${i}`, { headers: { ...auth, "Content-Type": "application/octet-stream" }, data: zip.subarray(i * opened.partBytes, Math.min((i + 1) * opened.partBytes, zip.byteLength)) });
    expect(res.status()).toBe(200);
  }
  const done = await (await page.request.post("/api/deploy/complete", { headers: { ...auth, "Content-Type": "application/json" }, data: { session: opened.session, commit: "0123456789abcdef0123456789abcdef01234567", ref: "main" } })).json();
  expect(done.ok).toBe(true);
  expect(done.preview).toBe(`${preview}/`);

  // Preview hostnames resolve in the browser, not in Node, so these checks navigate.
  const home = await page.goto(`${preview}/`);
  await expect(page.getByRole("heading", { level: 1, name: "Deployed from CI." })).toBeVisible();
  expect(home?.headers()["x-frame-options"]).toBe("DENY");
  const landed = await page.goto(`${preview}/compare`);
  expect(page.url()).toBe(`${preview}/about/`);
  const hop = landed?.request().redirectedFrom();
  expect(hop).toBeTruthy();
  expect((await hop!.response())?.status()).toBe(301);
  await page.goto(`/app/sites/${siteId}/upload`);
  await expect(page.getByText(/Push to deploy \(GitHub Actions\): main @ 0123456/)).toBeVisible();
  await expect(page.getByText(/last used/)).toBeVisible();
  await shot(page, "b9-deployed-release");
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await expect(page.getByText("revoked", { exact: true })).toBeVisible();
  expect((await page.request.post("/api/deploy/begin", { headers: { ...auth, "Content-Type": "application/json" }, data: { filename: "site.zip", size: 10 } })).status()).toBe(401);
});
