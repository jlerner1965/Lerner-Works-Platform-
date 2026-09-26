"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser, getSessionUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { getAuthProvider } from "@/server/auth/provider";
import { getConfig } from "@/server/config";

export interface InviteState {
  error?: string;
}

/** Signed-in acceptance: the token binds the invitee's email and organization. */
export async function acceptInvitationAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "This invitation link is not valid." };
  try {
    await withUser(user.id, (db) => db`select public.accept_invitation(${token})`);
  } catch (err) {
    return { error: describeDbError(err).message };
  }
  redirect("/app?invited=1");
}

/** Local provider only: creates the invited account with a password, then accepts. */
export async function registerAndAcceptAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "This invitation link is not valid." };
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== confirm) return { error: "The passwords do not match." };
  if (await getSessionUser()) return { error: "You are already signed in. Use the accept button instead." };
  const provider = getAuthProvider();
  if (!provider.registerInvitedUser) return { error: "Account creation for invitations is handled by the hosted identity provider in this environment." };
  const result = await provider.registerInvitedUser(token, password);
  if (!result.ok) return { error: "reason" in result && result.reason === "rejected" ? result.message : "The account could not be created." };
  const jar = await cookies();
  jar.set(result.cookie.name, result.cookie.value, { httpOnly: true, sameSite: "lax", secure: getConfig().APP_URL.startsWith("https://"), path: "/", expires: result.cookie.expires });
  try {
    await withUser(result.user.id, (db) => db`select public.accept_invitation(${token})`);
  } catch (err) {
    return { error: describeDbError(err).message };
  }
  redirect("/app?invited=1");
}
