import { createHash } from "node:crypto";
import { getSessionUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import { parseCsv, autoMap, dryRun, MAX_BYTES } from "@/server/import/csv";
import { isImportableKind } from "@/server/import/csv-spec";
import { dryRunPackage, MAX_PACKAGE_BYTES } from "@/server/import/package";

export const dynamic = "force-dynamic";

/**
 * Redirects with a relative Location so the browser stays on the origin it used. Building an
 * absolute URL from `request.url` is wrong here: in production `request.url` carries the
 * server's own hostname (or an internal proxy hostname), not the host the visitor typed, and
 * the session cookie would not follow a cross-origin redirect.
 */
function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}

/** Uploads a CSV or site package, stores it privately, runs the dry run, and creates the job. */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return redirectTo(`/sign-in?next=${encodeURIComponent(`/app/sites/${siteId}/import`)}`);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const type = String(form.get("type") ?? "csv");
  const back = (msg: string) => redirectTo(`/app/sites/${siteId}/import?error=${encodeURIComponent(msg)}`);
  if (!(file instanceof File) || file.size === 0) return back("Choose a file to upload.");
  try {
    const jobId = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canEdit) throw new Error("You do not have edit access to this site.");
      if (type === "package") {
        if (!ctx.capabilities.isOwner) throw new Error("Only organization owners can import a site package.");
        if (file.size > MAX_PACKAGE_BYTES) throw new Error("The package is larger than 64 MB.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const dry = await dryRunPackage(db, ctx.site, bytes);
        const sha = createHash("sha256").update(bytes).digest("hex");
        const [job] = await db<{ id: string }[]>`insert into public.import_jobs (organization_id, site_id, package_type, filename, file_sha256, row_count, dry_run_result, created_by)
          values (${ctx.site.organizationId}, ${siteId}, 'site_package', ${file.name.slice(0, 200)}, ${sha}, ${dry.summary.items}, ${db.json({ summary: dry.summary, errors: dry.errors, warnings: dry.warnings } as never)}, ${user.id}) returning id`;
        await getStorage().putPrivate(`${ctx.site.organizationId}/${siteId}/imports/${job!.id}.zip`, bytes, "application/zip");
        return job!.id;
      }
      if (!isImportableKind(kind)) throw new Error("Choose what the file contains (stores, places or events).");
      if (file.size > MAX_BYTES) throw new Error("The file is larger than 5 MB. Split it into smaller files.");
      const text = await file.text();
      const parsed = parseCsv(text);
      const mapping = autoMap(kind, parsed.headers);
      const result = await dryRun(db, ctx.site, kind, parsed, mapping);
      const [job] = await db<{ id: string }[]>`insert into public.import_jobs (organization_id, site_id, package_type, kind, filename, file_sha256, row_count, mapping, dry_run_result, created_by)
        values (${ctx.site.organizationId}, ${siteId}, 'csv', ${kind}, ${file.name.slice(0, 200)}, ${parsed.sha256}, ${parsed.rows.length}, ${db.json(mapping)}, ${db.json({ counts: result.counts, rows: result.rows, headers: parsed.headers } as never)}, ${user.id}) returning id`;
      await getStorage().putPrivate(`${ctx.site.organizationId}/${siteId}/imports/${job!.id}.csv`, new TextEncoder().encode(text), "text/csv");
      return job!.id;
    });
    return redirectTo(`/app/sites/${siteId}/import/${jobId}`);
  } catch (err) {
    return back(err instanceof Error ? err.message : describeDbError(err).message);
  }
}
