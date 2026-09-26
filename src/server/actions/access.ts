"use server";

import { revalidatePath } from "next/cache";
import path from "node:path";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getConfig } from "@/server/config";
import { getNotificationProvider } from "@/server/inquiries/notify";

export interface AccessState {
  message?: string;
  error?: string;
  inviteLink?: string;
}

const uuid = z.uuid();
const orgRoles = ["owner", "member"] as const;
const siteRoles = ["publisher", "editor", "reviewer", "none"] as const;

async function ownerContext(userId: string, siteId: string) {
  return withUser(userId, async (db) => {
    const ctx = await loadSiteContext(db, siteId);
    return ctx?.capabilities.isOwner ? ctx : null;
  });
}

export async function setMemberRolesAction(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const memberId = String(formData.get("userId") ?? "");
  const orgRole = String(formData.get("organizationRole") ?? "");
  const siteRole = String(formData.get("siteRole") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(memberId).success) return { error: "Invalid request." };
  if (!(orgRoles as readonly string[]).includes(orgRole) || !(siteRoles as readonly string[]).includes(siteRole)) return { error: "Choose valid roles." };
  const ctx = await ownerContext(user.id, siteId);
  if (!ctx) return { error: "Only organization owners can manage access." };
  try {
    await withUser(user.id, async (db) => {
      await db`select public.set_organization_membership(${ctx.site.organizationId}, ${memberId}, ${orgRole})`;
      if (siteRole === "none") await db`select public.remove_site_membership(${siteId}, ${memberId})`;
      else await db`select public.set_site_membership(${siteId}, ${memberId}, ${siteRole})`;
    });
    revalidatePath(`/app/sites/${siteId}/access`);
    return { message: "Roles updated. The change applies to that person's next request." };
  } catch (err) {
    const d = describeDbError(err);
    return { error: d.message };
  }
}

export async function removeMemberAction(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const memberId = String(formData.get("userId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(memberId).success) return { error: "Invalid request." };
  const ctx = await ownerContext(user.id, siteId);
  if (!ctx) return { error: "Only organization owners can manage access." };
  try {
    await withUser(user.id, (db) => db`select public.remove_organization_membership(${ctx.site.organizationId}, ${memberId})`);
    revalidatePath(`/app/sites/${siteId}/access`);
    return { message: "Membership removed. Their sessions lose access on the next protected request." };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

export async function createInvitationAction(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const orgRole = String(formData.get("organizationRole") ?? "member");
  const siteRole = String(formData.get("siteRole") ?? "none");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email address." };
  if (!(orgRoles as readonly string[]).includes(orgRole) || !(siteRoles as readonly string[]).includes(siteRole)) return { error: "Choose valid roles." };
  const ctx = await ownerContext(user.id, siteId);
  if (!ctx) return { error: "Only organization owners can invite people." };
  const assignments = siteRole === "none" ? [] : [{ siteId, siteRole }];
  try {
    const rows = await withUser(user.id, (db) => db<{ invitationId: string; token: string; expiresAt: Date }[]>`
      select invitation_id, token, expires_at from public.create_invitation(${ctx.site.organizationId}, ${email}, ${orgRole}, ${db.json(assignments)}, interval '7 days')`);
    const inv = rows[0]!;
    const cfg = getConfig();
    const link = `${cfg.APP_URL}/invite/${inv.token}`;
    const provider = getNotificationProvider();
    const sent = await provider.send({
      to: [email],
      subject: `You're invited to ${ctx.organization.name} on Lerner Works`,
      text: `${user.email} invited you to join ${ctx.organization.name}${siteRole !== "none" ? ` as ${siteRole} on ${ctx.site.name}` : ""}.\n\nAccept the invitation (expires ${inv.expiresAt.toUTCString()}):\n${link}\n\nIf you did not expect this, ignore this message.`,
      idempotencyKey: `invitation-${inv.invitationId}`,
    });
    revalidatePath(`/app/sites/${siteId}/access`);
    if (!sent.ok) return { message: `Invitation created, but the notification could not be sent (${sent.error}). Revoke and retry once the provider is configured.` };
    const where = provider.name === "local-sink" ? `written to the local notification sink (${path.join(cfg.NOTIFY_LOCAL_DIR, sent.reference)})` : `sent via ${provider.name}`;
    return { message: `Invitation for ${email} ${where}. It expires in 7 days and can be used once.`, inviteLink: cfg.isLocal ? link : undefined };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

export async function revokeInvitationAction(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(invitationId).success) return { error: "Invalid request." };
  try {
    await withUser(user.id, (db) => db`select public.revoke_invitation(${invitationId})`);
    revalidatePath(`/app/sites/${siteId}/access`);
    return { message: "Invitation revoked." };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}
