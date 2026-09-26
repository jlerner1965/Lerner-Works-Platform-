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
import type { OnboardingDryRun } from "@/server/import/onboarding";
import { kindRegistry } from "@/modules/registry";
import { snakeCaseKeys } from "@/lib/snake-keys";

export const dynamic = "force-dynamic";

function RowsTable({ rows }: { rows: DryRunRow[] }) {
  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-1 pr-2">Row</th><th className="py-1 pr-2">External id</th><th className="py-1 pr-2">Title</th><th className="py-1 pr-2">Action</th><th className="py-1">Findings</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-1 pr-2">{r.row || "—"}</td><td className="py-1 pr-2"><code>{r.externalId}</code></td><td className="py-1 pr-2">{r.title}{r.image ? <span className="block text-xs text-ink-subtle">image: {r.image}</span> : null}</td>
              <td className="py-1 pr-2"><Badge tone={r.action === "error" ? "danger" : r.action === "skip" ? "neutral" : "success"}>{r.action}</Badge></td>
              <td className="py-1 text-xs text-danger">{r.errors.join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  // Keys of stored maps (the column mapping, the settings sheet) come back camel-cased from the database client.
  const mapping = snakeCaseKeys(job.mapping);
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
        {job.state === "completed" ? <div className="mb-4"><Alert tone="success">Applied {formatDateTime(job.completedAt, ctx.site.timeZone)}: {JSON.stringify(job.result)}. {job.result?.approved ? "Imported items are approved and go out with the next publish." : "Imported items are drafts in Content."}</Alert></div> : null}
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
              {job.state === "dry_run" ? <RemapForm siteId={siteId} jobId={job.id} columns={csvSpecs[kind].map((c) => ({ key: c.key, required: Boolean(c.required) }))} headers={headers} mapping={mapping} /> : (
                <ul className="text-xs text-ink-muted">{Object.entries(mapping).filter(([, v]) => v).map(([k, v]) => <li key={k}><code>{k}</code> ← {v}</li>)}</ul>
              )}
            </Card>
          </div>
        </div>
      </>
    );
  }
  if (job.packageType === "onboarding") {
    const o = dry as unknown as Omit<OnboardingDryRun, "results" | "files">;
    const errors = o.errors ?? [];
    const warnings = o.warnings ?? [];
    const kinds = o.kinds ?? [];
    const images = o.images ?? [];
    const settings = snakeCaseKeys(o.settings?.values);
    const summary = o.summary ?? { items: 0, images: 0, settings: 0, rowErrors: 0 };
    const canConfirm = job.state === "dry_run" && errors.length === 0 && summary.items + summary.images + summary.settings > 0;
    const result = job.result as { created?: number; updated?: number; images?: number; settings?: string[]; pages?: string[]; approved?: boolean } | null;
    return (
      <>
        <PageHeader eyebrow={`${ctx.site.name} · Import`} title={job.filename ?? "Onboarding package"} description={<span><Link href={base} className="text-action underline">← Import and export</Link> · uploaded {formatDateTime(job.createdAt, ctx.site.timeZone)} · <Badge tone={job.state === "completed" ? "success" : job.state === "dry_run" ? "info" : "neutral"}>{job.state.replace("_", " ")}</Badge></span>} />
        {job.state === "completed" && result ? (
          <div className="mb-4"><Alert tone="success">Applied {formatDateTime(job.completedAt, ctx.site.timeZone)}: {result.created ?? 0} created, {result.updated ?? 0} updated, {result.images ?? 0} images{result.settings?.length ? `, settings ${result.settings.join(", ")}` : ""}{result.pages?.length ? `, the ${result.pages.join(" and ")} page${result.pages.length === 1 ? "" : "s"} given their text` : ""}. {result.approved ? "Everything imported is approved and goes out with the next publish." : "Imported items are drafts in Content."} <Link href={`/app/sites/${siteId}/publishing`} className="underline">Publish</Link></Alert></div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <Card title={`Dry run: ${summary.items} row(s) to import, ${summary.images} image(s), ${summary.settings} setting(s)${summary.rowErrors ? `, ${summary.rowErrors} row(s) with errors` : ""}`}>
              {errors.length ? <ul className="mb-3 list-disc pl-5 text-sm text-danger">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p className="mb-3 text-sm text-success">The package is well-formed. Nothing has been written.</p>}
              {warnings.length ? <ul className="mb-3 list-disc pl-5 text-sm text-warning">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
              {Object.keys(settings).length ? (
                <div className="text-sm">
                  <p className="font-medium">Settings sheet</p>
                  <ul className="mt-1 grid gap-x-6 gap-y-0.5 text-xs text-ink-muted sm:grid-cols-2">{Object.entries(settings).map(([k, v]) => <li key={k}><code>{k}</code>: {v.length > 80 ? `${v.slice(0, 80)}…` : v}</li>)}</ul>
                </div>
              ) : null}
            </Card>
            {kinds.map((k) => (
              <Card key={k.kind} title={`${k.file}: ${k.counts.create} to create, ${k.counts.update} to update, ${k.counts.skip} unchanged, ${k.counts.error} with errors (of ${k.counts.total} ${kindRegistry[k.kind].plural.toLowerCase()})`}>
                <RowsTable rows={k.rows} />
              </Card>
            ))}
            {images.length ? (
              <Card title={`Images (${images.length})`}>
                <ul className="divide-y divide-line text-sm">
                  {images.map((img) => (
                    <li key={img.file} className="flex flex-wrap items-center gap-2 py-1.5">
                      <code className="mr-auto">{img.file}</code>
                      <span className="text-xs text-ink-subtle">{Math.round(img.bytes / 1024)} KB</span>
                      {img.decorative ? <Badge tone="neutral">decorative</Badge> : img.alt ? <Badge tone="success">alt text</Badge> : <Badge tone="warning">no alt text</Badge>}
                      {img.license ? <Badge tone="success">licensed</Badge> : <Badge tone="warning">no license</Badge>}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
          {job.state === "dry_run" ? (
            <Card title="Confirm">
              <p className="mb-2 text-sm text-ink-muted">Imports the images, then the rows in order, then the settings sheet, all at once. Rows with errors are skipped; fix them in the file and upload again if they matter.</p>
              <ConfirmImportForm siteId={siteId} jobId={job.id} disabled={!canConfirm} label={errors.length ? "Fix the package first" : canConfirm ? `Import ${summary.items} row(s), ${summary.images} image(s) and ${summary.settings} setting(s)` : "Nothing to import"} />
              <form action={cancelImportAction} className="mt-2"><input type="hidden" name="siteId" value={siteId} /><input type="hidden" name="jobId" value={job.id} /><Button type="submit" variant="ghost">Cancel this import</Button></form>
            </Card>
          ) : null}
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
      {job.state === "completed" ? <div className="mb-4"><Alert tone="success">Applied: {JSON.stringify(job.result)}. {job.result?.approved ? "Imported items are approved and go out with the next publish." : "Imported items are drafts in Content."}</Alert></div> : null}
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
