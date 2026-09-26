import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import dotenv from "dotenv";
import { seed, emails, signIn } from "./fixtures";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

test("unknown hosts, forbidden host paths and environment metadata (ROUTE-01, META-01)", async ({ request, baseURL }) => {
  const unknown = await request.get(`${baseURL}/`, { headers: { Host: "unknown.example" } });
  expect(unknown.status()).toBe(404);
  const body = await unknown.text();
  expect(body).not.toContain("Pine Hollow");
  expect(body).not.toContain("Range Athletics");
  expect((await request.get(`${baseURL}/host/pinehollow.example`)).status()).toBe(404);

  const demo = await request.get(`${baseURL}/demo/pine-hollow`);
  expect(demo.status()).toBe(200);
  expect(demo.headers()["x-robots-tag"]).toContain("noindex");
  expect(await demo.text()).toMatch(/<meta name="robots" content="noindex/);
  expect((await request.get(`${baseURL}/demo/pine-hollow/does-not-exist`)).status()).toBe(404);
  expect((await request.get(`${baseURL}/demo/pine-hollow/sitemap.xml`)).status()).toBe(404);
  const robots = await request.get(`${baseURL}/robots.txt`);
  expect(await robots.text()).toMatch(/Disallow: \//);
  expect((await request.get(`${baseURL}/app`, { maxRedirects: 0 })).headers()["x-robots-tag"]).toContain("noindex");
});

test("a verified live domain serves its site with canonical metadata and a sitemap; an alias redirects (ROUTE-01, META-01)", async ({ request, baseURL }) => {
  const admin = postgres(process.env.DATABASE_TEST_ADMIN_URL!, { max: 1, onnotice: () => {} });
  const { sites } = seed();
  try {
    await admin`update public.sites set mode = 'live' where id = ${sites.rangeAthletics}`;
    await admin`insert into public.domains (organization_id, site_id, normalized_host, status, is_canonical, verified_at)
      select organization_id, id, 'range.example', 'active', true, now() from public.sites where id = ${sites.rangeAthletics} on conflict (normalized_host) do nothing`;
    await admin`insert into public.domains (organization_id, site_id, normalized_host, status, is_canonical)
      select organization_id, id, 'www.range.example', 'active', false from public.sites where id = ${sites.rangeAthletics} on conflict (normalized_host) do nothing`;
    await admin`insert into public.domains (organization_id, site_id, normalized_host, status, is_canonical)
      select organization_id, id, 'pending.range.example', 'pending', false from public.sites where id = ${sites.rangeAthletics} on conflict (normalized_host) do nothing`;

    const live = await request.get(`${baseURL}/locations/longmont`, { headers: { Host: "range.example" } });
    expect(live.status()).toBe(200);
    const html = await live.text();
    expect(html).toContain("Range Athletics Longmont");
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/range\.example\/locations\/longmont"/);
    expect(html).toMatch(/<meta name="robots" content="index, follow"/);
    expect(html).not.toContain("Demonstration site");

    const alias = await request.get(`${baseURL}/locations/longmont`, { headers: { Host: "www.range.example" }, maxRedirects: 0 });
    expect(alias.status()).toBe(308);
    expect(alias.headers()["location"]).toBe("https://range.example/locations/longmont");

    const pending = await request.get(`${baseURL}/`, { headers: { Host: "pending.range.example" } });
    expect(pending.status()).toBe(404);

    const sitemap = await request.get(`${baseURL}/sitemap.xml`, { headers: { Host: "range.example" } });
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain("https://range.example/locations/longmont");
    expect(xml).not.toContain("/search");
    const robots = await request.get(`${baseURL}/robots.txt`, { headers: { Host: "range.example" } });
    expect(await robots.text()).toContain("Sitemap: https://range.example/sitemap.xml");
    // The demo route no longer serves a live site.
    expect((await request.get(`${baseURL}/demo/range-athletics`)).status()).toBe(404);
  } finally {
    await admin`update public.sites set mode = 'demo' where id = ${sites.rangeAthletics}`;
    await admin`delete from public.domains where normalized_host in ('range.example', 'www.range.example', 'pending.range.example')`;
    await admin.end();
  }
});

test("private uploads and preview assets of another site are denied (AUTH-06)", async ({ page, request, baseURL }) => {
  const { sites } = seed();
  const admin = postgres(process.env.DATABASE_TEST_ADMIN_URL!, { max: 1, onnotice: () => {} });
  let assetId = "";
  let candidateId = "";
  try {
    const [a] = await admin`select id from public.media_assets where site_id = ${sites.rangeAthletics} and status = 'ready' limit 1`;
    assetId = a!.id as string;
    const [c] = await admin`select id from public.release_candidates where site_id = ${sites.rangeAthletics} order by created_at desc limit 1`;
    candidateId = (c?.id as string) ?? "00000000-0000-4000-8000-000000000000";
  } finally {
    await admin.end();
  }
  // Anonymous: 401.
  expect((await request.get(`${baseURL}/app/sites/${sites.rangeAthletics}/media/${assetId}/file/w480`)).status()).toBe(401);
  // Editor A (site A only): 404, no bytes.
  await signIn(page, emails.editorA);
  const r1 = await page.request.get(`${baseURL}/app/sites/${sites.rangeAthletics}/media/${assetId}/file/w480`);
  expect(r1.status()).toBe(404);
  const r2 = await page.request.get(`${baseURL}/app/sites/${sites.rangeAthletics}/previews/${candidateId}/assets/${assetId}/w480`);
  expect(r2.status()).toBe(404);
  const r3 = await page.request.get(`${baseURL}/app/sites/${sites.rangeAthletics}/previews/${candidateId}/render`);
  expect(r3.status()).toBe(404);
  // Owner can fetch it, proving the route works when authorized.
  const ownerCtx = await page.context().browser()!.newContext();
  const op = await ownerCtx.newPage();
  await signIn(op, emails.owner);
  const ok = await op.request.get(`${baseURL}/app/sites/${sites.rangeAthletics}/media/${assetId}/file/w480`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toBe("image/webp");
  expect(ok.headers()["cache-control"]).toContain("private");
  await ownerCtx.close();
  fs.mkdirSync("docs/evidence", { recursive: true });
});

test("owner registers a hostname; without a hosting provider it stays pending and the site cannot go live", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.rangeAthletics}/settings`);
  const host = `shop-${Date.now().toString(36)}.range.example`;
  const domains = page.locator("form", { has: page.getByRole("button", { name: "Register hostname" }) });
  await domains.getByLabel("Hostname").fill(host);
  await domains.getByRole("button", { name: "Register hostname" }).click();
  await expect(page.getByText(`${host} registered with status "pending"`)).toBeVisible();
  const row = page.locator("li", { hasText: host });
  await expect(row.getByText("pending", { exact: true })).toBeVisible();
  await expect(row.getByText("not verified", { exact: true })).toBeVisible();
  await expect(row.getByText(/No hosting provider is configured/)).toBeVisible();
  await expect(row.getByRole("button", { name: "Activate" })).toHaveCount(0);
  // Publishing mode: an active release exists, but no verified canonical domain, so going live is refused.
  await expect(page.getByRole("button", { name: "Go live" })).toBeDisabled();
  await expect(page.getByText("A verified, active canonical domain exists.")).toBeVisible();
  await page.screenshot({ path: "docs/evidence/screenshots/dash-domains-1440.png", fullPage: true });
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("li", { hasText: host })).toHaveCount(0);
});
