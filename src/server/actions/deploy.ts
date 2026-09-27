"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { createDeployToken, revokeDeployToken } from "@/server/uploaded/deploy";

export interface DeployTokenState {
  error?: string;
  /** The new token, shown once. */
  token?: string;
  label?: string;
  revoked?: boolean;
}

const uuid = z.uuid();

export async function createDeployTokenAction(_prev: DeployTokenState, formData: FormData): Promise<DeployTokenState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const label = String(formData.get("label") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  try {
    const created = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx) throw new Error("The site was not found.");
      return createDeployToken(db, ctx, user.id, label);
    });
    revalidatePath(`/app/sites/${siteId}/upload`);
    return { token: created.token, label: created.label };
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
}

export async function revokeDeployTokenAction(_prev: DeployTokenState, formData: FormData): Promise<DeployTokenState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(tokenId).success) return { error: "Invalid request." };
  try {
    const revoked = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx) throw new Error("The site was not found.");
      return revokeDeployToken(db, ctx, tokenId);
    });
    revalidatePath(`/app/sites/${siteId}/upload`);
    return { revoked };
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
}
