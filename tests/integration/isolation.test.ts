import { afterAll, describe, expect, it } from "vitest";
import { seedInfo, withUser, withAnon, endPool, adminClient, key } from "./helpers";

const seed = seedInfo();
const { users, sites, organizations } = seed;

afterAll(async () => {
  await endPool();
});

describe("tenant isolation through the request role (AUTH-02, AUTH-04, PUB-08)", () => {
  it("editor A sees no rows for site B and cannot read its private tables", async () => {
    const counts = await withUser(users.editorA, async (db) => ({
      sites: (await db`select id from public.sites where id = ${sites.rangeAthletics}`).length,
      items: (await db`select id from public.content_items where site_id = ${sites.rangeAthletics}`).length,
      revisions: (await db`select id from public.content_revisions where site_id = ${sites.rangeAthletics}`).length,
      candidates: (await db`select id from public.release_candidates where site_id = ${sites.rangeAthletics}`).length,
      memberships: (await db`select user_id from public.memberships where organization_id = ${organizations.rangeAthletics}`).length,
      inquiries: (await db`select id from public.inquiries`).length,
      ownSite: (await db`select id from public.sites where id = ${sites.pineHollow}`).length,
    }));
    expect(counts).toEqual({ sites: 0, items: 0, revisions: 0, candidates: 0, memberships: 0, inquiries: 0, ownSite: 1 });
  });

  it("rejects creating content in a site the user cannot edit, and with a mismatched organization id", async () => {
    const admin0 = adminClient();
    const before = (await admin0`select count(*)::int as n from public.content_items where site_id = ${sites.rangeAthletics}`)[0]!.n as number;
    await admin0.end();
    await expect(
      withUser(users.editorA, (db) => db`insert into public.content_items (organization_id, site_id, kind, created_by) values (${organizations.rangeAthletics}, ${sites.rangeAthletics}, 'page', ${users.editorA})`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withUser(users.editorA, (db) => db`insert into public.content_items (organization_id, site_id, kind, created_by) values (${organizations.rangeAthletics}, ${sites.pineHollow}, 'page', ${users.editorA})`),
    ).rejects.toMatchObject({ code: "42501" });
    const admin = adminClient();
    try {
      const rows = await admin`select count(*)::int as n from public.content_items where site_id = ${sites.rangeAthletics}`;
      expect(rows[0]!.n).toBe(before);
    } finally {
      await admin.end();
    }
  });

  it("reviewer A cannot edit content; stranger sees nothing", async () => {
    await expect(
      withUser(users.reviewerA, (db) => db`insert into public.content_items (organization_id, site_id, kind, created_by) values (${organizations.pineHollow}, ${sites.pineHollow}, 'page', ${users.reviewerA})`),
    ).rejects.toMatchObject({ code: "42501" });
    const n = await withUser(users.stranger, (db) => db`select id from public.sites`);
    expect(n.length).toBe(0);
  });

  it("anonymous visitors cannot read drafts, candidates or releases but can call the public read function", async () => {
    for (const table of ["content_revisions", "release_candidates", "releases", "sites", "domains", "inquiries"]) {
      await expect(withAnon((db) => db.unsafe(`select * from public.${table} limit 1`))).rejects.toMatchObject({ code: "42501" });
    }
    const rows = await withAnon((db) => db`select * from public.get_demo_release('does-not-exist')`);
    expect(rows.length).toBe(0);
    await expect(withAnon((db) => db`select * from public.activate_release_candidate(${key()}::uuid, 'abcdefghij', null)`)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("publish and membership authority (AUTH-03, AUTH-05, AUTH-07)", () => {
  it("editor cannot activate a candidate or build one", async () => {
    await expect(withUser(users.editorA, (db) => db`select * from public.activate_release_candidate(${key()}::uuid, 'abcdefghij', null)`)).rejects.toMatchObject({ code: "P0002" });
    await expect(
      withUser(users.editorA, (db) => db`insert into public.release_candidates (organization_id, site_id, config_revision_id, manifest, manifest_hash, schema_version, created_by, state)
        select organization_id, id, current_config_revision_id, '{}'::jsonb, 'x', 1, ${users.editorA}, 'ready' from public.sites where id = ${sites.pineHollow}`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(withUser(users.editorA, (db) => db`update public.sites set active_release_id = null where id = ${sites.pineHollow}`)).rejects.toMatchObject({ code: "42501" });
  });

  it("members cannot promote themselves; the last owner cannot be removed or demoted", async () => {
    await expect(withUser(users.editorA, (db) => db`select public.set_organization_membership(${organizations.pineHollow}, ${users.editorA}, 'owner')`)).rejects.toMatchObject({ code: "42501" });
    await expect(withUser(users.editorA, (db) => db`insert into public.memberships (organization_id, user_id, organization_role) values (${organizations.pineHollow}, ${users.editorA}, 'owner')`)).rejects.toMatchObject({ code: "42501" });
    await expect(withUser(users.editorA, (db) => db`update public.memberships set organization_role = 'owner' where user_id = ${users.editorA}`)).rejects.toMatchObject({ code: "42501" });
    await expect(withUser(users.owner, (db) => db`select public.remove_organization_membership(${organizations.pineHollow}, ${users.owner})`)).rejects.toMatchObject({ code: "P0001" });
    await expect(withUser(users.owner, (db) => db`select public.set_organization_membership(${organizations.pineHollow}, ${users.owner}, 'member')`)).rejects.toMatchObject({ code: "P0001" });
  });

  it("revoking a membership takes effect on the next request", async () => {
    // Give editor A a temporary site role on site B via the owner, then revoke it.
    await withUser(users.owner, async (db) => {
      await db`select public.set_organization_membership(${organizations.rangeAthletics}, ${users.editorA}, 'member')`;
      await db`select public.set_site_membership(${sites.rangeAthletics}, ${users.editorA}, 'editor')`;
    });
    expect((await withUser(users.editorA, (db) => db`select id from public.sites where id = ${sites.rangeAthletics}`)).length).toBe(1);
    await withUser(users.owner, (db) => db`select public.remove_organization_membership(${organizations.rangeAthletics}, ${users.editorA})`);
    expect((await withUser(users.editorA, (db) => db`select id from public.sites where id = ${sites.rangeAthletics}`)).length).toBe(0);
    await expect(
      withUser(users.editorA, (db) => db`insert into public.content_items (organization_id, site_id, kind, created_by) values (${organizations.rangeAthletics}, ${sites.rangeAthletics}, 'page', ${users.editorA})`),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
