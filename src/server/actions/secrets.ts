"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { removeGithubToken, setGithubToken } from "@/server/uploaded/sources";

export interface SecretActionState {
  error?: string;
  ok?: string;
}

const uuid = z.uuid();

/** Stores the organization's GitHub token after GitHub has accepted it (owners only, enforced in SQL). */
export async function setGithubTokenAction(_prev: SecretActionState, formData: FormData): Promise<SecretActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const token = String(formData.get("token") ?? "");
  if (!uuid.safeParse(organizationId).success) return { error: "Invalid request." };
  try {
    const result = await withUser(user.id, (db) => setGithubToken(db, organizationId, token));
    revalidatePath("/app");
    return { ok: `GitHub accepted the token of ${result.login}; it is stored for this organization (ending in ${result.last4}).` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
}

export async function removeGithubTokenAction(_prev: SecretActionState, formData: FormData): Promise<SecretActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!uuid.safeParse(organizationId).success) return { error: "Invalid request." };
  try {
    const removed = await withUser(user.id, (db) => removeGithubToken(db, organizationId));
    revalidatePath("/app");
    return { ok: removed ? "The token was removed." : "No token was stored." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
}
