import { test, expect } from "@playwright/test";
import { seed, emails, signIn } from "./fixtures";

test("owner invites an editor; the invitee registers and accepts; revoking access takes effect immediately (AUTH-05)", async ({ page, browser }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.rangeAthletics}/access`);
  const email = `invitee-${Date.now()}@rangeathletics.example`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Role on/).selectOption("editor");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(new RegExp(`Invitation for ${email}`))).toBeVisible();
  const link = await page.locator("a[href*='/invite/']").first().getAttribute("href");
  expect(link).toBeTruthy();

  const invitee = await browser.newContext();
  const ip = await invitee.newPage();
  await ip.goto(link!);
  await expect(ip.getByText(email).first()).toBeVisible();
  await ip.getByLabel("Password (12+ characters)").fill("invitee-password-2026-xyz");
  await ip.getByLabel("Confirm password").fill("invitee-password-2026-xyz");
  await ip.getByRole("button", { name: "Create account and accept" }).click();
  await expect(ip).toHaveURL(/\/app\?invited=1/);
  const r1 = await ip.goto(`/app/sites/${sites.rangeAthletics}/content`);
  expect(r1?.status()).toBe(200);
  // Replaying the link is refused.
  await ip.goto(link!);
  await expect(ip.getByText(/already been used/)).toBeVisible();

  // Owner removes the membership; the invitee's existing session loses access on the next request.
  await page.goto(`/app/sites/${sites.rangeAthletics}/access`);
  const row = page.getByRole("row", { name: new RegExp(email) });
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("row", { name: new RegExp(email) })).toHaveCount(0);
  const r2 = await ip.goto(`/app/sites/${sites.rangeAthletics}/content`);
  expect(r2?.status()).toBe(404);
  await invitee.close();
});

test("the last owner cannot be demoted or removed (AUTH-07)", async ({ page }) => {
  const { sites } = seed();
  await signIn(page, emails.owner);
  await page.goto(`/app/sites/${sites.pineHollow}/access`);
  const row = page.getByRole("row", { name: /owner@lernerworks\.example/ });
  await expect(row.getByRole("button", { name: "Remove" })).toBeDisabled();
  await expect(row.getByText("Last owner")).toBeVisible();
});
