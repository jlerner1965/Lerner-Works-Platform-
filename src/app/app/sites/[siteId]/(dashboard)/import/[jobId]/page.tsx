import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Alert, Badge, Button, Card, PageHeader, formatDateTime } from "@/components/admin/ui";
import { csvSpecs, isImportableKind } from "@/server/import/csv-spec";
import { cancelImportAction } from "@/server/actions/import";
import { ConfirmImportForm, RemapForm } from "@/components/admin/import-forms";
import type { DryRunRow } from "@/server/import/csv";

export const dynamic = "force-dynamic";

export default async function ImportJobPage({ params }: { params: Promise<{ siteId: string; jobId: string }> }) {
  const { siteId, jobId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/import/${jobId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const [job] = await withUser(user.id, (db) => db<Array<{ id: string; packageType: string; kind: string | null; filename: string | null; state: string; rowCount: number | null; mapping: Record<string, string>; dryRunResult: Record<string, unknown> | null; result: Record<string, unknown> | null; createdAt: Date; completedAt: Date | null }>>`
    select id, package_type, kind::text, filename, state::text, row_count, mapping, dry_run_result, result, created_at, completed_at from public.import_jobs where id = ${jobId} and site_id = ${siteId}`);
  if (!job) notFound();
  const base = `/app/sites/${siteId}/import`;
  const dry = job.dryRunResult ?? {};
  if (job.packageType === "csv") {
    const kind = job.kind && isImportableKind(job.kind) ? job.kind : null;
    if (!kind) notFound();
    const counts = (dry.counts as { create: number; update: number; skip: number; error: number; total: number } | undefined) ?? { create: 0, update: 0, skip: 0, error: 0, total: 0 };
    const rows = (dry.rows as DryRunRow[] | undefined) ?? [];
    const headers = (dry.headers as string[] | undefined) ?? [];
    const canConfirm = job.state === "dry_run" && counts.create + counts.update > 0;
    return (
      <>
        <PageHeader eyebrow={`${ctx.site.name} · Import`} title={`${job.filename ?? "CSV"} (${kind}s)`} description={<span><Link href={base} className="text-action underline">← Import and export</Link> · uploaded {formatDateTime(job.createdAt, ctx.site.timeZone)} · <Badge tone={job.state === "completed" ? "success" : job.state === "dry_run" ? "info" : "neutral"}>{job.state.replace("_", " ")}</Badge></span>} />
        {job.state === "completed" ? <div className="mb-4"><Alert tone="success">Applied {formatDateTime(job.completedAt, ctx.site.timeZone)}: {JSON.stringify(job.result)}. Imported items are drafts in Content.</Alert></div> : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title={`Dry run: ${counts.create} to create, ${counts.update} to update, ${counts.skip} unchanged, ${counts.error} with errors (of ${counts.total} rows)`}>
            <p className="mb-3 text-sm text-ink-muted">Nothing has been written. Rows with errors are skipped on confirmation; fix them in the file and upload again if they matter.</p>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-1 pr-2">Row</th><th className="py-1 pr-2">External id</th><th className="py-1 pr-2">Title</th><th className="py-1 pr-2">Action</th><th className="py-1">Findings</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-line align-top">
                      <td className="py-1 pr-2">{r.row || "—"}</td><td className="py-1 pr-2"><code>{r.externalId}</code></td><td className="py-1 pr-2">{r.title}</td>
                      <td className="py-1 pr-2"><Badge tone={r.action === "error" ? "danger" : r.action === "skip" ? "neutral" : "success"}>{r.action}</Badge></td>
                      <td className="py-1 text-xs text-danger">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="space-y-4">
            {job.state === "dry_run" ? (
              <Card title="Confirm">
                <ConfirmImportForm siteId={siteId} jobId={job.id} disabled={!canConfirm} label={canConfirm ? `Import ${counts.create + counts.update} row(s) as drafts` : "Nothing to import"} />
                <form action={cancelImportAction} className="mt-2"><input type="hidden" name="siteId" value={siteId} /><input type="hidden" name="jobId" value={job.id} /><Button type="submit" variant="ghost">Cancel this import</Button></form>
              </Card>
            ) : null}
            <Card title="Column mapping">
              {job.state === "dry_run" ? <RemapForm siteId={siteId} jobId={job.id} columns={csvSpecs[kind].map((c) => ({ key: c.key, required: Boolean(c.required) }))} headers={headers} mapping={job.mapping} /> : (
                <ul className="text-xs text-ink-muted">{Object.entries(job.mapping).filter(([, v]) => v).map(([k, v]) => <li key={k}><code>{k}</code> ← {v}</li>)}</ul>
              )}
            </Card>
          </div>
        </div>
      </>
    );
  }
  const summary = (dry.summary as { items: number; media: number; byKind: Record<string, number>; adoptablePages: number } | undefined) ?? { items: 0, media: 0, byKind: {}, adoptablePages: 0 };
  const errors = (dry.errors as string[] | undefined) ?? [];
  const warnings = (dry.warnings as string[] | undefined) ?? [];
  return (
    <>
      <PageHeader eyebrow={`${ctx.site.name} · Import`} title={job.filename ?? "Site package"} description={<span><Link href={base} className="text-action underline">← Import and export</Link> · uploaded {formatDateTime(job.createdAt, ctx.site.timeZone)} · <Badge tone={job.state === "completed" ? "success" : "info"}>{job.state.replace("_", " ")}</Badge></span>} />
      {job.state === "completed" ? <div className="mb-4"><Alert tone="success">Applied: {JSON.stringify(job.result)}. Imported items are drafts in Content.</Alert></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Validation">
          {errors.length ? <ul className="list-disc pl-5 text-sm text-danger">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p className="text-sm text-success">The package is well-formed: checksums, paths, sizes and schemas all validate.</p>}
          {warnings.length ? <ul className="mt-2 list-disc pl-5 text-sm text-warning">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
          <p className="mt-3 text-sm">{summary.items} items ({Object.entries(summary.byKind).map(([k, n]) => `${n} ${k}`).join(", ") || "none"}), {summary.media} images, {summary.adoptablePages} starter page(s) would be replaced.</p>
        </Card>
        {job.state === "dry_run" ? (
          <Card title="Confirm">
            <p className="mb-2 text-sm text-ink-muted">Imports content, images and configuration as drafts with new ids. Domains, members and notification recipients are not changed.</p>
            <ConfirmImportForm siteId={siteId} jobId={job.id} disabled={errors.length > 0 || !ctx.capabilities.isOwner} label={errors.length ? "Fix the package first" : "Import package as drafts"} />
            <form action={cancelImportAction} className="mt-2"><input type="hidden" name="siteId" value={siteId} /><input type="hidden" name="jobId" value={job.id} /><Button type="submit" variant="ghost">Cancel</Button></form>
          </Card>
        ) : null}
      </div>
    </>
  );
}
