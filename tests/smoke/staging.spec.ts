import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Staging smoke tests (docs/LAUNCH-CHECKLIST.md section 6) against a deployed environment.
 * Required: SMOKE_BASE_URL, SMOKE_OWNER_EMAIL, SMOKE_OWNER_PASSWORD, SMOKE_JOB_SECRET.
 * Optional: SMOKE_INVITEE_EMAIL (invitation test; must be a mailbox the owner controls),
 * SMOKE_HOSTNAME (a hostname whose DNS already points at the hosting project, for the
 * domain/go-live test), SMOKE_RESEND_API_KEY (reads the sent messages back to follow the
 * invitation link and confirm delivery), SMOKE_EVIDENCE_DIR (screenshots).
 * Every message these tests send goes to the owner's own mailbox.
 */
test.describe.configure({ mode: "serial" });

const env = (k: string): string => process.env[k] ?? "";
const base = env("SMOKE_BASE_URL");
const owner = { email: env("SMOKE_OWNER_EMAIL"), password: env("SMOKE_OWNER_PASSWORD") };
const evidence = env("SMOKE_EVIDENCE_DIR") || "docs/evidence/staging";
const runId = Date.now().toString(36);
const siteKey = env("SMOKE_SITE_KEY") || `smoke-${runId}`;
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });

// Set SMOKE_SITE_ID to reuse a site created by an earlier run instead of creating a new one.
let siteId = env("SMOKE_SITE_ID");

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(\?|$)/);
}

async function resendEmail(id: string): Promise<{ text: string; lastEvent: string } | null> {
  const key = env("SMOKE_RESEND_API_KEY");
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/${id}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const body = (await res.json()) as { text?: string; html?: string; last_event?: string };
  return { text: body.text ?? body.html ?? "", lastEvent: body.last_event ?? "" };
}

test.beforeAll(() => {
  for (const k of ["SMOKE_BASE_URL", "SMOKE_OWNER_EMAIL", "SMOKE_OWNER_PASSWORD", "SMOKE_JOB_SECRET"]) {
    if (!env(k)) throw new Error(`${k} is required`);
  }
  fs.mkdirSync(evidence, { recursive: true });
});

test("1. owner signs in, creates a site, uploads an image, publishes; the demo route serves it from hosted storage", async ({ page }) => {
  test.skip(Boolean(env("SMOKE_SITE_ID")), "reusing an existing site (SMOKE_SITE_ID)");
  await signIn(page, owner.email, owner.password);
  await expect(page.getByRole("heading", { name: /Lerner Works/ })).toBeVisible();
  await shot(page, "01-organizations");

  await page.goto("/app/sites/new");
  await page.getByLabel("Site name").fill(`Smoke Guide ${runId}`);
  await page.getByLabel("Internal key").fill(siteKey);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page.getByText("Site created from the Community guide preset")).toBeVisible();
  siteId = page.url().split("/app/sites/")[1]!.split(/[/?]/)[0]!;
  console.log(`created site ${siteId} (key ${siteKey}); set SMOKE_SITE_ID=${siteId} SMOKE_SITE_KEY=${siteKey} to reuse it`);

  // Upload: a generated PNG through the media library, then its alternative text in the pass that follows (B2-3).
  await page.goto(`/app/sites/${siteId}/media`);
  const png = path.join(evidence, "smoke-upload.png");
  await page.getByLabel("Image files").setInputFiles(png);
  await page.getByRole("textbox", { name: /License/ }).fill("CC0-1.0, generated for this test");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Alternative text for 1 uploaded image/ })).toBeVisible();
  await page.getByLabel("smoke-upload", { exact: true }).fill("A generated test pattern");
  await page.getByRole("button", { name: /Save alternative text for 1 image/ }).click();
  await expect(page.getByText(/Saved alternative text for 1 image/)).toBeVisible();
  await shot(page, "02-media-uploaded");

  // Starter pages are approved at creation for an owner (B1); this loop only approves what still needs it. Then publish.
  for (const title of ["Home", "About", "Contact"]) {
    await page.goto(`/app/sites/${siteId}/content?kind=page&q=${encodeURIComponent(title)}`);
    const link = page.getByRole("link", { name: title, exact: true }).first();
    if (!(await link.count())) continue;
    await link.click();
    await expect(page.getByLabel("Change note (optional)")).toBeVisible();
    const approve = page.getByRole("button", { name: /Approve/ });
    if (await approve.count()) {
      await approve.click();
      await expect(page.getByText("Revision approved.")).toBeVisible();
    }
  }
  await page.goto(`/app/sites/${siteId}/publishing`);
  await page.getByRole("button", { name: "Build candidate" }).click();
  await expect(page.getByText(/Ready to activate/)).toBeVisible();
  await page.getByRole("button", { name: "Activate this candidate" }).click();
  await expect(page.getByText(/Release activated/).first()).toBeVisible();
  await shot(page, "03-release-activated");

  const pub = await page.request.get(`/demo/${siteKey}`);
  expect(pub.status()).toBe(200);
  const html = await pub.text();
  expect(html).toContain(`Smoke Guide ${runId}`);
  await page.goto(`/demo/${siteKey}`);
  await shot(page, "04-public-demo-route");
});

test("2. inquiry from the public site reaches the inbox and is delivered by the scheduled job through the email provider", async ({ page, request }) => {
  await signIn(page, owner.email, owner.password);
  await page.goto(`/app/sites/${siteId}/settings`);
  const contact = page.locator("form", { has: page.getByLabel("Inquiry notification recipients (comma-separated)") });
  await contact.getByLabel("Contact email").fill(owner.email);
  await contact.getByLabel("Inquiry notification recipients (comma-separated)").fill(owner.email);
  await contact.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Contact defaults saved/)).toBeVisible();

  const visitor = await page.context().browser()!.newContext();
  const v = await visitor.newPage();
  await v.goto(`${base}/demo/${siteKey}/contact`);
  await v.getByLabel(/^Name/).fill("Smoke Visitor");
  await v.getByLabel(/^Email/).fill(owner.email);
  await v.getByLabel(/^Message/).fill(`Staging smoke inquiry ${runId}. Please ignore.`);
  await v.getByRole("button", { name: "Send inquiry" }).click();
  const receipt = (await v.getByText(/LW-[0-9A-F]{8}/).innerText()).match(/LW-[0-9A-F]{8}/)![0];
  await v.screenshot({ path: path.join(evidence, "05-inquiry-receipt.png"), fullPage: true });
  await visitor.close();

  const job = await request.get(`${base}/api/jobs/deliver`, { headers: { Authorization: `Bearer ${env("SMOKE_JOB_SECRET")}` } });
  expect(job.status()).toBe(200);
  const result = (await job.json()) as { ok: boolean; provider: string; delivered: number; failed: number };
  expect(result.ok).toBe(true);
  expect(result.provider).toBe("resend");
  expect(result.delivered).toBeGreaterThanOrEqual(1);
  expect(result.failed).toBe(0);

  await page.goto(`/app/sites/${siteId}/inquiries`);
  await expect(page.getByText(receipt)).toBeVisible();
  await page.locator("tr", { hasText: receipt }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/inquiries\/[0-9a-f-]{36}/);
  await expect(page.getByText("delivered", { exact: true }).first()).toBeVisible();
  await shot(page, "06-inquiry-delivered");
  const reference = await page.locator("dd, td, span", { hasText: /^[0-9a-f-]{36}$/ }).first().innerText().catch(() => "");
  if (reference) {
    const mail = await resendEmail(reference.trim());
    if (mail) {
      expect(mail.text).toContain(receipt);
      console.log(`Resend event for the inquiry message: ${mail.lastEvent}`);
    }
  }
});

test("3. invitation email is sent; the invitee creates an account through the link and is admitted; revocation takes effect", async ({ page, request }) => {
  test.skip(!env("SMOKE_INVITEE_EMAIL") || !env("SMOKE_RESEND_API_KEY"), "SMOKE_INVITEE_EMAIL and SMOKE_RESEND_API_KEY are required to follow the invitation link");
  await signIn(page, owner.email, owner.password);
  await page.goto(`/app/sites/${siteId}/access`);
  await page.getByLabel("Email").fill(env("SMOKE_INVITEE_EMAIL"));
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(/Invitation for .* /)).toBeVisible();
  await shot(page, "07-invitation-created");

  const job = await request.get(`${base}/api/jobs/deliver`, { headers: { Authorization: `Bearer ${env("SMOKE_JOB_SECRET")}` } });
  expect(job.status()).toBe(200);

  // Read the message back from the provider to follow the link (sent to the owner's mailbox).
  const key = env("SMOKE_RESEND_API_KEY");
  const list = await fetch("https://api.resend.com/emails", { headers: { Authorization: `Bearer ${key}` } });
  const emails = ((await list.json()) as { data?: Array<{ id: string; subject: string; to: string[]; created_at: string }> }).data ?? [];
  const invite = emails.filter((e) => /invited/i.test(e.subject) && e.to.includes(env("SMOKE_INVITEE_EMAIL"))).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  expect(invite, "invitation email found at the provider").toBeTruthy();
  const mail = await resendEmail(invite!.id);
  const link = /https?:\/\/\S+\/invite\/[0-9a-f]{64}/.exec(mail?.text ?? "")?.[0];
  expect(link, "invitation link in the email").toBeTruthy();

  const inviteeCtx = await page.context().browser()!.newContext();
  const invitee = await inviteeCtx.newPage();
  await invitee.goto(link!);
  const password = `Smoke-${runId}-invitee-pass`;
  await invitee.getByLabel("Password (12+ characters)").fill(password);
  await invitee.getByLabel("Confirm password").fill(password);
  await invitee.getByRole("button", { name: /Create account and accept/ }).click();
  await expect(invitee).toHaveURL(/\/app\?invited=1/);
  await invitee.screenshot({ path: path.join(evidence, "08-invitee-admitted.png"), fullPage: true });
  expect((await invitee.request.get(`${base}/app/sites/${siteId}`)).status()).toBe(200);

  await page.goto(`/app/sites/${siteId}/access`);
  const row = page.locator("tr", { hasText: env("SMOKE_INVITEE_EMAIL") }).first();
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("tr", { hasText: env("SMOKE_INVITEE_EMAIL") })).toHaveCount(0);
  expect((await invitee.request.get(`${base}/app/sites/${siteId}`)).status()).toBe(404);
  await inviteeCtx.close();
});

test("4. job endpoint refuses a missing or wrong secret", async ({ request }) => {
  expect((await request.get(`${base}/api/jobs/deliver`)).status()).toBe(401);
  expect((await request.get(`${base}/api/jobs/deliver`, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
});

test("5. password recovery request is accepted without revealing whether the address exists", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByText(/If an account exists/)).toBeVisible();
  await shot(page, "09-recovery-requested");
  // Completing the reset needs the emailed link in the same browser; the owner does that step.
});

test("6. domain workflow: register with the provider, verify, activate, go live, serve with canonical metadata, return to demonstration", async ({ page, request }) => {
  test.skip(!env("SMOKE_HOSTNAME"), "SMOKE_HOSTNAME is required");
  const host = env("SMOKE_HOSTNAME");
  await signIn(page, owner.email, owner.password);
  await page.goto(`/app/sites/${siteId}/settings`);
  // Idempotent against the state an earlier run may have left: register only when missing,
  // activate only when not active, go live only when in demonstration mode.
  const row = page.locator("li", { hasText: host });
  if (!(await row.count())) {
    const form = page.locator("form", { has: page.getByRole("button", { name: "Register hostname" }) });
    await form.getByLabel("Hostname").fill(host);
    await form.getByLabel(/Canonical domain/).check();
    await form.getByRole("button", { name: "Register hostname" }).click();
    await expect(page.getByText(`${host} registered with status "pending"`)).toBeVisible();
  }
  if (!(await row.getByText("active", { exact: true }).count())) {
    if (await row.getByRole("button", { name: "Register with hosting provider" }).count()) {
      await row.getByRole("button", { name: "Register with hosting provider" }).click();
      await expect(row.getByRole("alert").or(row.getByRole("status"))).toBeVisible();
    }
    for (let i = 0; i < 6 && !(await row.getByRole("button", { name: "Activate" }).count()); i++) {
      await page.waitForTimeout(10_000);
      await row.getByRole("button", { name: "Check verification" }).click();
      await expect(row.getByRole("alert").or(row.getByRole("status"))).toBeVisible();
    }
    await shot(page, "10-domain-verified");
    await row.getByRole("button", { name: "Activate" }).click();
    await expect(row.getByText("active", { exact: true })).toBeVisible();
  }
  if (await page.getByRole("button", { name: "Go live" }).count()) {
    await page.getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText(/The site is live/)).toBeVisible();
  }
  await shot(page, "11-site-live");

  const live = await request.get(`https://${host}/`);
  expect(live.status()).toBe(200);
  const html = await live.text();
  expect(html).toMatch(new RegExp(`<link rel="canonical" href="https://${host.replace(/\./g, "\\.")}/?"`));
  expect(html).toMatch(/<meta name="robots" content="index, follow"/);
  const sitemap = await request.get(`https://${host}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(`https://${host}/`);
  expect((await request.get(`${base}/demo/${siteKey}`)).status()).toBe(404);

  await page.goto(`/app/sites/${siteId}/settings`);
  await page.getByRole("button", { name: "Return to demonstration mode" }).click();
  await expect(page.getByText(/back in demonstration mode/)).toBeVisible();
  expect((await request.get(`https://${host}/`)).status()).toBe(404);
  expect((await request.get(`${base}/demo/${siteKey}`)).status()).toBe(200);
});
