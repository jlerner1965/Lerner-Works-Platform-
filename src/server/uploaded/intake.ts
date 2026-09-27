import { createHash } from "node:crypto";
import type { Db } from "@/server/data/db";
import type { SiteContext } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import { inspectSiteArchive, MAX_ARCHIVE_BYTES, type GithubSourceRef } from "./archive";
import { inspectionSummary } from "./publish";

/**
 * Taking in an archive of an uploaded site (B7, B8), whichever way it arrived: one request,
 * assembled from parts, or fetched from GitHub. The archive is inspected without writing
 * anything to the site, the inspection is stored on an upload job, and the archive is kept
 * privately until the job is published or purged.
 */

export interface IntakeInput {
  filename: string;
  bytes: Uint8Array;
  /** The folder inside the archive that holds the site, when the person named one. */
  root?: string | null;
  /** Set when the archive was fetched from GitHub. */
  github?: GithubSourceRef | null;
}

export interface IntakeResult {
  jobId: string;
  ok: boolean;
  errors: string[];
}

export function archiveKey(organizationId: string, siteId: string, jobId: string): string {
  return `${organizationId}/${siteId}/uploads/${jobId}.zip`;
}

/** Checks the caller may take an archive into this site; throws the message the person should see. */
export function assertUploadAllowed(ctx: SiteContext | null): asserts ctx is SiteContext {
  if (!ctx?.capabilities.canPublish) throw new Error("Only owners and publishers upload a site.");
  if (ctx.site.siteType !== "uploaded") throw new Error("This site is built here from a preset; it has no ZIP to upload.");
}

export async function registerUploadedArchive(db: Db, ctx: SiteContext, userId: string, input: IntakeInput): Promise<IntakeResult> {
  assertUploadAllowed(ctx);
  if (input.bytes.byteLength === 0) throw new Error("The upload is empty.");
  if (input.bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error(`The ZIP is larger than ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
  const filename = (input.filename || "site.zip").slice(0, 200);
  const inspection = inspectSiteArchive(input.bytes, { root: input.root ?? null });
  const summary = inspectionSummary(inspection, { filename, archiveBytes: input.bytes.byteLength, github: input.github ?? null });
  const sha = createHash("sha256").update(input.bytes).digest("hex");
  const ok = inspection.errors.length === 0;
  const siteId = ctx.site.id;
  const [job] = await db<{ id: string }[]>`insert into public.import_jobs (organization_id, site_id, package_type, filename, file_sha256, row_count, dry_run_result, state, result, created_by)
    values (${ctx.site.organizationId}, ${siteId}, 'uploaded_site', ${filename}, ${sha}, ${inspection.files.length}, ${db.json(summary as never)}, ${ok ? "dry_run" : "failed"}::public.import_state, ${ok ? null : db.json({ errors: inspection.errors })}, ${userId}) returning id`;
  if (ok) await getStorage().putPrivate(archiveKey(ctx.site.organizationId, siteId, job!.id), input.bytes, "application/zip");
  return { jobId: job!.id, ok, errors: inspection.errors };
}
