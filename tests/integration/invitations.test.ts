import { afterAll, describe, expect, it } from "vitest";
import { seedInfo, withUser, withAnon, endPool, adminClient } from "./helpers";

const { users, sites, organizations } = seedInfo();

afterAll(async () => {
  await endPool();
});

describe("invitations bind email and organization, expire and resist replay", () => {
  it("creates, previews and accepts an invitation for the matching account only", async () => {
    const email = `invitee-${Date.now()}@pinehollow.example`;
    const rows = await withUser(users.owner, (db) => db<{ invitationId: string; token: string }[]>`
      select invitation_id, token from public.create_invitation(${organizations.pineHollow}, ${email}, 'member', ${db.json([{ siteId: sites.pineHollow, siteRole: "reviewer" }])}, interval '7 days')`);
    const { token, invitationId } = rows[0]!;
    // Editors cannot create invitations.
    await expect(withUser(users.editorA, (db) => db`select * from public.create_invitation(${organizations.pineHollow}, 'x@example.test', 'owner', '[]'::jsonb, interval '1 day')`)).rejects.toMatchObject({ code: "42501" });
    // Anonymous preview works without exposing anything else.
    const preview = await withAnon((db) => db<{ state: string; email: string }[]>`select state, email from public.get_invitation_preview(${token})`);
    expect(preview[0]).toMatchObject({ state: "valid", email });
    // A different signed-in user cannot accept it.
    await expect(withUser(users.stranger, (db) => db`select public.accept_invitation(${token})`)).rejects.toMatchObject({ code: "P0001" });
    // Register the invited account through the local shim and accept.
    const reg = await withAnon((db) => db<{ userId: string }[]>`select user_id from local_auth.register_invited_user(${token}, 'a-long-enough-password-123')`);
    const newUserId = reg[0]!.userId;
    await withUser(newUserId, (db) => db`select public.accept_invitation(${token})`);
    const access = await withUser(newUserId, (db) => db`select id from public.sites where id = ${sites.pineHollow}`);
    expect(access.length).toBe(1);
    const role = await withUser(newUserId, (db) => db<{ siteRole: string }[]>`select site_role::text from public.site_memberships where user_id = ${newUserId} and site_id = ${sites.pineHollow}`);
    expect(role[0]?.siteRole).toBe("reviewer");
    // Replay is refused.
    await expect(withUser(newUserId, (db) => db`select public.accept_invitation(${token})`)).rejects.toMatchObject({ code: "P0001" });
    expect((await withAnon((db) => db<{ state: string }[]>`select state from public.get_invitation_preview(${token})`))[0]?.state).toBe("accepted");
    const admin = adminClient();
    try {
      const [inv] = await admin<{ acceptedBy: string }[]>`select accepted_by from public.invitations where id = ${invitationId}`;
      expect(inv?.acceptedBy).toBe(newUserId);
    } finally {
      await admin.end();
    }
  });

  it("refuses expired and revoked invitations", async () => {
    const rows = await withUser(users.owner, (db) => db<{ invitationId: string; token: string }[]>`
      select invitation_id, token from public.create_invitation(${organizations.pineHollow}, 'expired@pinehollow.example', 'member', '[]'::jsonb, interval '1 second')`);
    await new Promise((r) => setTimeout(r, 1200));
    expect((await withAnon((db) => db<{ state: string }[]>`select state from public.get_invitation_preview(${rows[0]!.token})`))[0]?.state).toBe("expired");
    await expect(withAnon((db) => db`select * from local_auth.register_invited_user(${rows[0]!.token}, 'a-long-enough-password-123')`)).rejects.toMatchObject({ code: "P0001" });
    const r2 = await withUser(users.owner, (db) => db<{ invitationId: string; token: string }[]>`
      select invitation_id, token from public.create_invitation(${organizations.pineHollow}, 'revoked@pinehollow.example', 'member', '[]'::jsonb, interval '7 days')`);
    await withUser(users.owner, (db) => db`select public.revoke_invitation(${r2[0]!.invitationId})`);
    expect((await withAnon((db) => db<{ state: string }[]>`select state from public.get_invitation_preview(${r2[0]!.token})`))[0]?.state).toBe("revoked");
  });
});
