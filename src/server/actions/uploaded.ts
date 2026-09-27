"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { publishCheckedJob } from "@/server/uploaded/publish-job";

export interface PublishUploadState {
  error?: string;
}

const uuid = z.uuid();

/** Publishes an inspected upload (B7): the files go to public storage, the release is inserted and activated, the job is closed. */
export async function publishUploadAction(_prev: PublishUploadState, formData: FormData): Promise<PublishUploadState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(jobId).success) return { error: "Invalid request." };
  let version: number;
  try {
    const outcome = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx) return { ok: false as const, error: "The site was not found." };
      return publishCheckedJob(db, ctx, user.id, jobId, { reason });
    });
    if (!outcome.ok) return { error: outcome.error };
    version = outcome.version;
  } catch (err) {
    return { error: describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}`);
  revalidatePath(`/app/sites/${siteId}/upload`);
  redirect(`/app/sites/${siteId}?published=${version}`);
}
