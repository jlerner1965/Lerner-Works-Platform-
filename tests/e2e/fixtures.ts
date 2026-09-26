import fs from "node:fs";
import { expect, type Page } from "@playwright/test";

export interface Seed {
  sites: { pineHollow: string; rangeAthletics: string };
  users: Record<string, string>;
  password: string;
}

export function seed(): Seed {
  return JSON.parse(fs.readFileSync("tests/e2e/.auth/seed.json", "utf8")) as Seed;
}

export const emails = {
  owner: "owner@lernerworks.example",
  editorA: "editor-a@pinehollow.example",
  reviewerA: "reviewer-a@pinehollow.example",
  publisherB: "publisher-b@rangeathletics.example",
  stranger: "stranger@unrelated.example",
};

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(seed().password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

export async function approveAllPages(page: Page, siteId: string, titles: string[]): Promise<void> {
  for (const title of titles) {
    await page.goto(`/app/sites/${siteId}/content`);
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByLabel("Change note (optional)")).toBeVisible();
    const approve = page.getByRole("button", { name: /Approve/ });
    if (await approve.count()) {
      await approve.click();
      await expect(page.getByText("Revision approved.")).toBeVisible();
    }
  }
}
