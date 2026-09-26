import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedInfo, withAnon, withUser, endPool, adminClient, key, approveAll, publish } from "./helpers";
import { resolveDemoRelease } from "@/server/publishing/public-site";
import { createSiteFromPreset, getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { getItem, saveRevision } from "@/server/data/content";

const { users, sites, organizations } = seedInfo();
const owner = users.owner;

beforeAll(async () => {
  await approveAll(owner, sites.rangeAthletics);
  const rel = await resolveDemoRelease("range-athletics");
  if (!rel) await publish(owner, sites.rangeAthletics, "for inquiries");
});

afterAll(async () => {
  await endPool();
});

const payload = (overrides: Record<string, unknown> = {}) => ({ name: "Visitor", email: "visitor@example.test", phone: "", message: "Do you carry trail shoes in wide sizes?", sourcePath: "/contact", ...overrides });

describe("inquiry intake (LEAD-01, LEAD-03, LEAD-04, LEAD-05)", () => {
  it("stores a valid inquiry with a delivery job, visible only to owners/publishers", async () => {
    const rows = await withAnon((db) => db<{ inquiryId: string; receiptCode: string; outcome: string }[]>`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload())}, 'hash-a', ${key()})`);
    expect(rows[0]!.outcome).toBe("created");
    expect(rows[0]!.receiptCode).toMatch(/^LW-[0-9A-F]{8}$/);
    const asPublisher = await withUser(users.publisherB, (db) => db`select id, status from public.inquiries where id = ${rows[0]!.inquiryId}`);
    expect(asPublisher.length).toBe(1);
    const jobs = await withUser(users.publisherB, (db) => db<{ state: string; recipients: string[] }[]>`select state::text, recipients from public.delivery_jobs where inquiry_id = ${rows[0]!.inquiryId}`);
    expect(jobs[0]).toMatchObject({ state: "pending", recipients: ["stores@rangeathletics.example"] });
    const asEditor = await withUser(users.editorA, (db) => db`select id from public.inquiries where id = ${rows[0]!.inquiryId}`);
    expect(asEditor.length).toBe(0);
  });

  it("returns the same receipt for a repeated idempotency token", async () => {
    const token = key();
    const first = await withAnon((db) => db<{ receiptCode: string; outcome: string }[]>`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload())}, 'hash-b', ${token})`);
    const second = await withAnon((db) => db<{ receiptCode: string; outcome: string }[]>`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload({ message: "changed" }))}, 'hash-b', ${token})`);
    expect(second[0]!.outcome).toBe("duplicate");
    expect(second[0]!.receiptCode).toBe(first[0]!.receiptCode);
  });

  it("rejects foreign or non-location references and invalid fields; recipients cannot be chosen", async () => {
    const pine = (await resolveDemoRelease("pine-hollow"))!;
    const foreignId = Object.keys(pine.snapshot.items)[0]!;
    await expect(withAnon((db) => db`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload({ locationId: foreignId }))}, 'hash-c', ${key()})`)).rejects.toMatchObject({ code: "22023" });
    await expect(withAnon((db) => db`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload({ email: "not-an-email" }))}, 'hash-c', ${key()})`)).rejects.toMatchObject({ code: "22023" });
    await expect(withAnon((db) => db`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload({ message: "x".repeat(4001) }))}, 'hash-c', ${key()})`)).rejects.toMatchObject({ code: "22023" });
    await expect(withAnon((db) => db`select * from public.submit_inquiry('no-such-site', null, ${db.json(payload())}, 'hash-c', ${key()})`)).rejects.toMatchObject({ code: "P0002" });
    const rows = await withAnon((db) => db<{ inquiryId: string }[]>`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload({ recipients: ["attacker@example.test"], to: "attacker@example.test" }))}, 'hash-d', ${key()})`);
    const admin = adminClient();
    try {
      const [job] = await admin<{ recipients: string[] }[]>`select recipients from public.delivery_jobs where inquiry_id = ${rows[0]!.inquiryId}`;
      expect(job!.recipients).toEqual(["stores@rangeathletics.example"]);
    } finally {
      await admin.end();
    }
  });

  it("refuses submissions for a site whose active release has the Inquiries module off (D0-7)", async () => {
    // A fresh site: drop the starter contact form, switch the module off, publish, then submit.
    const siteKey = `inq-off-${key().slice(0, 8)}`;
    const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.rangeAthletics, key: siteKey, name: "Inquiries Off", preset: "location_business", timeZone: "America/Denver", mode: "demo", contact: {} });
    await withUser(owner, async (db) => {
      const [contact] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and r.slug = 'contact'`;
      const found = (await getItem(db, contact!.id))!;
      const sections = (found.revision.payload.sections as Array<{ type: string }>).filter((s) => s.type !== "inquiry_form");
      const saved = await saveRevision(db, { itemId: found.item.id, baseRevisionId: found.revision.id, payload: { ...found.revision.payload, sections }, authorId: owner });
      expect(saved.ok).toBe(true);
      const current = (await getCurrentSiteConfig(db, siteId))!;
      const config = structuredClone(current.config);
      config.modules.inquiries = false;
      const result = await saveSiteConfig(db, { siteId, organizationId: organizations.rangeAthletics, baseRevisionId: current.id, config, authorId: owner, changeNote: "Inquiries off" });
      expect(result.ok).toBe(true);
    });
    await approveAll(owner, siteId);
    await publish(owner, siteId, "inquiries off");
    const rel = await resolveDemoRelease(siteKey);
    expect(rel?.snapshot.config.modules.inquiries).toBe(false);
    await expect(withAnon((db) => db`select * from public.submit_inquiry(${siteKey}, null, ${db.json(payload())}, 'hash-off', ${key()})`)).rejects.toMatchObject({ code: "P0002" });
    const stored = await withUser(owner, (db) => db<{ n: number }[]>`select count(*)::int as n from public.inquiries where site_id = ${siteId}`);
    expect(stored[0]!.n).toBe(0);
  });

  it("applies the persistent per-requester rate limit", async () => {
    for (let i = 0; i < 5; i++) {
      await withAnon((db) => db`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload())}, 'hash-rate', ${key()})`);
    }
    await expect(withAnon((db) => db`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload())}, 'hash-rate', ${key()})`)).rejects.toMatchObject({ code: "P0003" });
    // Another requester is unaffected.
    const ok = await withAnon((db) => db<{ outcome: string }[]>`select * from public.submit_inquiry('range-athletics', null, ${db.json(payload())}, 'hash-other', ${key()})`);
    expect(ok[0]!.outcome).toBe("created");
  });
});
