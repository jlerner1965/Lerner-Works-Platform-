import type { Sql } from "postgres";
import { withUser } from "@/server/data/db";
import { createSiteFromPreset } from "@/server/data/sites";
import { loadDemoContent } from "@/server/demo/load";

export interface SeedAccount {
  role: string;
  email: string;
}

export interface SeedResult {
  accounts: SeedAccount[];
  organizations: { pineHollow: string; rangeAthletics: string };
  sites: { pineHollow: string; rangeAthletics: string };
  users: Record<string, string>;
}

export const demoAccounts: Array<SeedAccount & { key: string }> = [
  { key: "owner", role: "Agency owner (owner of both organizations)", email: "owner@lernerworks.example" },
  { key: "editorA", role: "Editor A (Pine Hollow Guide editor)", email: "editor-a@pinehollow.example" },
  { key: "reviewerA", role: "Reviewer A (Pine Hollow Guide reviewer)", email: "reviewer-a@pinehollow.example" },
  { key: "publisherB", role: "Publisher B (Range Athletics publisher)", email: "publisher-b@rangeathletics.example" },
  { key: "stranger", role: "Unrelated authenticated user (no memberships)", email: "stranger@unrelated.example" },
];

/**
 * Creates or updates the demonstration organizations, accounts, memberships and sites.
 * Runs identity-carrying steps through the same functions the dashboard uses.
 */
export async function seedDemo(admin: Sql, opts: { passwordFor: (email: string) => string; log?: (line: string) => void; loadContent?: boolean; now?: Date }): Promise<SeedResult> {
  const log = opts.log ?? (() => {});
  // Accounts (local auth shim).
  const users: Record<string, string> = {};
  for (const a of demoAccounts) {
    const row = (await admin<{ id: string }[]>`select local_auth.upsert_user(${a.email}, ${opts.passwordFor(a.email)}) as id`)[0];
    if (!row) throw new Error(`could not create account ${a.email}`);
    users[a.key] = row.id;
  }
  log(`accounts ensured: ${demoAccounts.length}`);

  // Organizations bootstrap (the first owner membership needs elevated access).
  const orgA = await ensureOrganization(admin, "Pine Hollow Guide Co-op (fictional)", users.owner!);
  const orgB = await ensureOrganization(admin, "Range Athletics Inc. (fictional)", users.owner!);
  log("organizations ensured");

  // Memberships via the owner's identity through the real functions.
  const owner = users.owner!;
  await withUser(owner, async (db) => {
    await db`select public.set_organization_membership(${orgA}, ${users.editorA!}, 'member')`;
    await db`select public.set_organization_membership(${orgA}, ${users.reviewerA!}, 'member')`;
    await db`select public.set_organization_membership(${orgB}, ${users.publisherB!}, 'member')`;
  });

  // Sites.
  const siteA = await ensureSite(owner, {
    organizationId: orgA,
    key: "pine-hollow",
    name: "Pine Hollow Guide",
    preset: "community_guide",
    timeZone: "America/Denver",
    contact: { email: "hello@pinehollowguide.example", phone: "(303) 555-0148", address: "PO Box 212, Pine Hollow, CO (fictional)", inquiryRecipients: ["editors@pinehollowguide.example"] },
  });
  const siteB = await ensureSite(owner, {
    organizationId: orgB,
    key: "range-athletics",
    name: "Range Athletics",
    preset: "location_business",
    timeZone: "America/Denver",
    contact: { email: "stores@rangeathletics.example", phone: "(720) 555-0190", address: "Range Athletics Inc., 4100 Foothills Way, Suite 200, Longmont, CO (fictional)", inquiryRecipients: ["stores@rangeathletics.example"] },
  });
  log("sites ensured");

  await withUser(owner, async (db) => {
    await db`select public.set_site_membership(${siteA}, ${users.editorA!}, 'editor')`;
    await db`select public.set_site_membership(${siteA}, ${users.reviewerA!}, 'reviewer')`;
    await db`select public.set_site_membership(${siteB}, ${users.publisherB!}, 'publisher')`;
  });
  log("site memberships ensured");

  if (opts.loadContent !== false) {
    for (const [name, siteId] of [["pine-hollow", siteA], ["range-athletics", siteB]] as const) {
      const result = await loadDemoContent(owner, siteId, { now: opts.now });
      log(`${name}: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged, ${result.images} new images, ${result.releases.length} new releases`);
    }
    await seedInquiries(admin, opts.now ?? new Date());
    log("demo inquiries ensured");
  }

  return {
    accounts: demoAccounts.map(({ role, email }) => ({ role, email })),
    organizations: { pineHollow: orgA, rangeAthletics: orgB },
    sites: { pineHollow: siteA, rangeAthletics: siteB },
    users,
  };
}

async function ensureOrganization(admin: Sql, name: string, ownerId: string): Promise<string> {
  const existing = await admin<{ id: string }[]>`select id from public.organizations where name = ${name}`;
  let id = existing[0]?.id;
  if (!id) {
    const [row] = await admin<{ id: string }[]>`insert into public.organizations (name) values (${name}) returning id`;
    id = row!.id;
  }
  await admin`insert into public.memberships (organization_id, user_id, organization_role, created_by)
    values (${id}, ${ownerId}, 'owner', ${ownerId})
    on conflict (organization_id, user_id) do update set organization_role = 'owner'`;
  return id;
}

async function ensureSite(
  ownerId: string,
  input: { organizationId: string; key: string; name: string; preset: "community_guide" | "location_business"; timeZone: string; contact: { email: string; phone: string; address: string; inquiryRecipients: string[] } },
): Promise<string> {
  const existing = await withUser(ownerId, (db) => db<{ id: string }[]>`select id from public.sites where key = ${input.key}`);
  if (existing[0]) return existing[0].id;
  const { siteId } = await createSiteFromPreset(ownerId, { ...input, mode: "demo" });
  return siteId;
}

/** Clearly labeled fixture inquiries, stored through the public intake function and flagged as fixtures. */
async function seedInquiries(admin: Sql, now: Date): Promise<void> {
  const { fixtureForSite } = await import("@/server/demo/load");
  for (const key of ["pine-hollow", "range-athletics"]) {
    const fixture = fixtureForSite(key, now);
    if (!fixture) continue;
    const token = `seed-inquiry-${key}`;
    const existing = await admin`select i.id from public.inquiries i join public.sites s on s.id = i.site_id where s.key = ${key} and i.idempotency_key = ${token}`;
    if (existing.length) continue;
    let locationId: string | null = null;
    if (fixture.inquiry.externalId) {
      const rows = await admin<{ id: string }[]>`select i.id from public.content_items i join public.sites s on s.id = i.site_id where s.key = ${key} and i.external_id = ${fixture.inquiry.externalId}`;
      locationId = rows[0]?.id ?? null;
    }
    const payload = { name: fixture.inquiry.name, email: fixture.inquiry.email, message: fixture.inquiry.message, sourcePath: fixture.inquiry.sourcePath, locationId, consentVersion: "2026-09-v1" };
    const [row] = await admin<{ inquiryId: string }[]>`select inquiry_id from public.submit_inquiry(${key}, null, ${admin.json(payload)}, 'seed', ${token})`;
    if (row) await admin`update public.inquiries set is_demo_fixture = true where id = ${row.inquiryId}`;
  }
}
