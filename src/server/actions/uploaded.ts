"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import { publishUploadedSite } from "@/server/uploaded/publish";

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
      if (!ctx?.capabilities.canPublish) return { error: "Only owners and publishers publish a site." };
      if (ctx.site.siteType !== "uploaded") return { error: "This site is not an uploaded site." };
      const jobs = await db<{ id: string; filename: string | null; state: string; packageType: string }[]>`select id, filename, state::text, package_type from public.import_jobs where id = ${jobId} and site_id = ${siteId}`;
      const job = jobs[0];
      if (!job || job.packageType !== "uploaded_site") return { error: "The upload was not found." };
      if (job.state !== "dry_run") return { error: job.state === "completed" ? "This upload was already published." : "This upload cannot be published; upload the ZIP again." };
      const key = `${ctx.site.organizationId}/${siteId}/uploads/${jobId}.zip`;
      const bytes = await getStorage().getPrivate(key);
      if (!bytes) return { error: "The uploaded ZIP is no longer stored; upload it again." };
      const result = await publishUploadedSite(user.id, ctx.site, bytes, { filename: job.filename ?? "site.zip", reason, idempotencyKey: `upload:${jobId}` });
      if (!result.ok) {
        await db`update public.import_jobs set state = 'failed', result = ${db.json({ errors: result.errors })}, completed_at = now() where id = ${jobId}`;
        return { error: result.errors.join(" ") };
      }
      await db`update public.import_jobs set state = 'completed', result = ${db.json({ releaseId: result.release.releaseId, version: result.release.version, files: result.release.files, totalBytes: result.release.totalBytes })}, completed_at = now() where id = ${jobId}`;
      await getStorage().deletePrivatePrefix(key).catch(() => undefined);
      return { version: result.release.version };
    });
    if ("error" in outcome) return { error: outcome.error };
    version = outcome.version;
  } catch (err) {
    return { error: describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}`);
  revalidatePath(`/app/sites/${siteId}/upload`);
  redirect(`/app/sites/${siteId}?published=${version}`);
}
