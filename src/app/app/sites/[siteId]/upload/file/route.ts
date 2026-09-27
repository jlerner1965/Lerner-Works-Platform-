import { createHash } from "node:crypto";
import { getSessionUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import { inspectSiteArchive, MAX_ARCHIVE_BYTES } from "@/server/uploaded/archive";
import { inspectionSummary } from "@/server/uploaded/publish";

export const dynamic = "force-dynamic";

function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}

/**
 * Uploads a site's ZIP (B7): the archive is inspected without writing anything to the site,
 * the inspection is stored on an upload job, the archive is kept privately until the job is
 * published or dropped, and the browser lands on the job page.
 */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return redirectTo(`/sign-in?next=${encodeURIComponent(`/app/sites/${siteId}/upload`)}`);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const back = (msg: string) => redirectTo(`/app/sites/${siteId}/upload?error=${encodeURIComponent(msg)}`);
  if (!(file instanceof File) || file.size === 0) return back("Choose the ZIP of the site to upload.");
  if (file.size > MAX_ARCHIVE_BYTES) return back(`The ZIP is larger than ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
  try {
    const jobId = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canPublish) throw new Error("Only owners and publishers upload a site.");
      if (ctx.site.siteType !== "uploaded") throw new Error("This site is built here from a preset; it has no ZIP to upload.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const inspection = inspectSiteArchive(bytes);
      const summary = inspectionSummary(inspection, { filename: file.name, archiveBytes: bytes.byteLength });
      const sha = createHash("sha256").update(bytes).digest("hex");
      const ok = inspection.errors.length === 0;
      const [job] = await db<{ id: string }[]>`insert into public.import_jobs (organization_id, site_id, package_type, filename, file_sha256, row_count, dry_run_result, state, result, created_by)
        values (${ctx.site.organizationId}, ${siteId}, 'uploaded_site', ${file.name.slice(0, 200)}, ${sha}, ${inspection.files.length}, ${db.json(summary as never)}, ${ok ? "dry_run" : "failed"}::public.import_state, ${ok ? null : db.json({ errors: inspection.errors })}, ${user.id}) returning id`;
      if (ok) await getStorage().putPrivate(`${ctx.site.organizationId}/${siteId}/uploads/${job!.id}.zip`, bytes, "application/zip");
      return job!.id;
    });
    return redirectTo(`/app/sites/${siteId}/upload/${jobId}`);
  } catch (err) {
    return back(err instanceof Error ? err.message : describeDbError(err).message);
  }
}
