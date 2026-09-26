"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import { parseCsv, dryRun, applyImport, type Mapping } from "@/server/import/csv";
import { csvSpecs, isImportableKind } from "@/server/import/csv-spec";
import { dryRunPackage, applyPackage } from "@/server/import/package";

const uuid = z.uuid();

export interface ImportState {
  error?: string;
  message?: string;
}

/** Re-runs the dry run with an edited mapping and stores it on the job. */
export async function remapImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(jobId).success) return { error: "Invalid request." };
  try {
    await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canEdit) throw new Error("no edit access");
      const [job] = await db<{ id: string; kind: string; fileSha256: string; state: string }[]>`select id, kind::text, file_sha256, state::text from public.import_jobs where id = ${jobId} and site_id = ${siteId} and package_type = 'csv'`;
      if (!job || job.state !== "dry_run" || !isImportableKind(job.kind)) throw new Error("This import is no longer editable.");
      const raw = await getStorage().getPrivate(`${ctx.site.organizationId}/${siteId}/imports/${jobId}.csv`);
      if (!raw) throw new Error("The uploaded file is no longer available; upload it again.");
      const parsed = parseCsv(Buffer.from(raw).toString("utf8"));
      const mapping: Mapping = {};
      for (const col of csvSpecs[job.kind]) mapping[col.key] = String(formData.get(`map_${col.key}`) ?? "");
      const result = await dryRun(db, ctx.site, job.kind, parsed, mapping);
      await db`update public.import_jobs set mapping = ${db.json(mapping)}, dry_run_result = ${db.json({ counts: result.counts, rows: result.rows } as never)}, row_count = ${parsed.rows.length} where id = ${jobId}`;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}/import/${jobId}`);
  return { message: "Dry run updated with the new mapping. No records were written." };
}

export async function confirmImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(jobId).success) return { error: "Invalid request." };
  let summary: string;
  try {
    summary = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canEdit) throw new Error("no edit access");
      const [job] = await db<{ id: string; kind: string | null; packageType: string; mapping: Mapping; state: string }[]>`select id, kind::text, package_type, mapping, state::text from public.import_jobs where id = ${jobId} and site_id = ${siteId} for update`;
      if (!job) throw new Error("Import job not found.");
      if (job.state !== "dry_run") throw new Error("This import was already confirmed or cancelled; start a new import to repeat it.");
      const storage = getStorage();
      if (job.packageType === "csv") {
        if (!job.kind || !isImportableKind(job.kind)) throw new Error("Unsupported kind.");
        const raw = await storage.getPrivate(`${ctx.site.organizationId}/${siteId}/imports/${jobId}.csv`);
        if (!raw) throw new Error("The uploaded file is no longer available; upload it again.");
        const parsed = parseCsv(Buffer.from(raw).toString("utf8"));
        const dry = await dryRun(db, ctx.site, job.kind, parsed, job.mapping);
        const applied = await applyImport(db, ctx.site, job.kind, user.id, dry);
        await db`update public.import_jobs set state = 'completed', completed_at = now(), result = ${db.json({ ...applied, errors: dry.counts.error })} where id = ${jobId}`;
        await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata) values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'import.csv_applied', 'import_job', ${jobId}, ${db.json({ kind: job.kind, ...applied })})`;
        return `${applied.created} created, ${applied.updated} updated, ${applied.skipped} unchanged; ${dry.counts.error} row(s) with errors were not imported. Imported items are drafts awaiting review.`;
      }
      const raw = await storage.getPrivate(`${ctx.site.organizationId}/${siteId}/imports/${jobId}.zip`);
      if (!raw) throw new Error("The uploaded package is no longer available; upload it again.");
      const dry = await dryRunPackage(db, ctx.site, raw);
      if (dry.errors.length) throw new Error(`The package failed validation: ${dry.errors[0]}`);
      const applied = await applyPackage(db, ctx.site, user.id, dry, { keepDesign: !ctx.capabilities.canDesign });
      await db`update public.import_jobs set state = 'completed', completed_at = now(), result = ${db.json(applied)} where id = ${jobId}`;
      await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata) values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'import.package_applied', 'import_job', ${jobId}, ${db.json(applied)})`;
      return `${applied.items} items (${applied.adoptedPages} starter pages replaced), ${applied.media} images and the configuration were imported as drafts. Domains and notification recipients were not imported.`;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}/content`);
  redirect(`/app/sites/${siteId}/import?done=${encodeURIComponent(summary)}`);
}

export async function cancelImportAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (uuid.safeParse(siteId).success && uuid.safeParse(jobId).success) {
    await withUser(user.id, (db) => db`update public.import_jobs set state = 'cancelled' where id = ${jobId} and site_id = ${siteId} and state = 'dry_run'`);
  }
  redirect(`/app/sites/${siteId}/import`);
}
