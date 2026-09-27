import type { Db } from "@/server/data/db";
import type { SiteContext } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import type { DeploySourceRef } from "./archive";
import { archiveKey } from "./intake";
import { publishUploadedSite, type UploadJobSummary } from "./publish";
import { markSourcePublished } from "./sources";

/**
 * Publishing a checked upload job (B7, B8, B9): the stored archive is published under the
 * remembered folder and source, the job is closed, the archive dropped. Shared by the
 * dashboard's publish button and the deploy endpoint.
 */

export type PublishJobResult = { ok: true; version: number; releaseId: string; files: number; totalBytes: number } | { ok: false; error: string };

export async function publishCheckedJob(db: Db, ctx: SiteContext, userId: string, jobId: string, opts: { reason: string | null; deploy?: DeploySourceRef | null }): Promise<PublishJobResult> {
  if (!ctx.capabilities.canPublish) return { ok: false, error: "Only owners and publishers publish a site." };
  if (ctx.site.siteType !== "uploaded") return { ok: false, error: "This site is not an uploaded site." };
  const siteId = ctx.site.id;
  const jobs = await db<{ id: string; filename: string | null; state: string; packageType: string; summary: UploadJobSummary | null }[]>`select id, filename, state::text, package_type, dry_run_result as summary from public.import_jobs where id = ${jobId} and site_id = ${siteId}`;
  const job = jobs[0];
  if (!job || job.packageType !== "uploaded_site") return { ok: false, error: "The upload was not found." };
  if (job.state !== "dry_run") return { ok: false, error: job.state === "completed" ? "This upload was already published." : "This upload cannot be published; upload the ZIP again." };
  const key = archiveKey(ctx.site.organizationId, siteId, jobId);
  const bytes = await getStorage().getPrivate(key);
  if (!bytes) return { ok: false, error: "The uploaded ZIP is no longer stored; upload it again." };
  const github = job.summary?.github ?? null;
  const result = await publishUploadedSite(userId, ctx.site, bytes, { filename: job.filename ?? "site.zip", reason: opts.reason, idempotencyKey: `upload:${jobId}`, root: job.summary?.root ?? null, github, deploy: opts.deploy ?? null }, db);
  if (!result.ok) {
    await db`update public.import_jobs set state = 'failed', result = ${db.json({ errors: result.errors })}, completed_at = now() where id = ${jobId}`;
    return { ok: false, error: result.errors.join(" ") };
  }
  await db`update public.import_jobs set state = 'completed', result = ${db.json({ releaseId: result.release.releaseId, version: result.release.version, files: result.release.files, totalBytes: result.release.totalBytes })}, completed_at = now() where id = ${jobId}`;
  if (github) await markSourcePublished(db, siteId, github, result.release.releaseId);
  await getStorage().deletePrivatePrefix(key).catch(() => undefined);
  return { ok: true, version: result.release.version, releaseId: result.release.releaseId, files: result.release.files, totalBytes: result.release.totalBytes };
}
