"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { checkGithubSource, forgetSiteSource } from "@/server/uploaded/sources";

export interface SourceActionState {
  error?: string;
  done?: boolean;
}

const uuid = z.uuid();

/** Fetches the repository's current files and checks them like an upload (B8); lands on the check page. */
export async function checkGithubSourceAction(_prev: SourceActionState, formData: FormData): Promise<SourceActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  const repository = String(formData.get("repository") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").trim() || null;
  const root = String(formData.get("root") ?? "").trim() || null;
  if (!repository) return { error: "Name the repository, as owner/name or its github.com address." };
  let jobId: string;
  try {
    jobId = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx) throw new Error("The site was not found.");
      return (await checkGithubSource(db, ctx, user.id, { repository, branch, root })).jobId;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}/upload`);
  redirect(`/app/sites/${siteId}/upload/${jobId}`);
}

/** Forgets the site's GitHub source; nothing published changes. */
export async function forgetSourceAction(_prev: SourceActionState, formData: FormData): Promise<SourceActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  try {
    await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx) throw new Error("The site was not found.");
      await forgetSiteSource(db, ctx);
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}/upload`);
  return { done: true };
}
