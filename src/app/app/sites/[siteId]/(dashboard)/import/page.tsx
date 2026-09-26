import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Alert, Badge, Button, Card, PageHeader, LinkButton, formatDateTime, selectClass } from "@/components/admin/ui";
import { csvSpecs, importableKinds } from "@/server/import/csv-spec";
import { presets } from "@/modules/presets";

export const dynamic = "force-dynamic";

export default async function ImportExportPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ error?: string; done?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/import`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  const jobs = await withUser(user.id, (db) => db<Array<{ id: string; packageType: string; kind: string | null; filename: string | null; state: string; rowCount: number | null; createdAt: Date; result: Record<string, unknown> | null }>>`
    select id, package_type, kind::text, filename, state::text, row_count, created_at, result from public.import_jobs where site_id = ${siteId} order by created_at desc limit 20`);
  const kinds = importableKinds.filter((k) => presets[ctx.site.preset].kinds.includes(k));
  const base = `/app/sites/${siteId}/import`;
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="Import and export" description="CSV imports begin with a dry run that changes nothing. Imported records are drafts until reviewed and published. The site package is portability, not disaster recovery." />
      {sp.error ? <div className="mb-4"><Alert tone="danger" role="alert">{sp.error}</Alert></div> : null}
      {sp.done ? <div className="mb-4"><Alert tone="success">Import applied: {sp.done}</Alert></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Import CSV (stores, places, events)">
          <form method="post" action={`${base}/upload`} encType="multipart/form-data" className="space-y-3 text-sm">
            <input type="hidden" name="type" value="csv" />
            <label className="block">File contains
              <select name="kind" className={selectClass} defaultValue={kinds[0]}>
                {kinds.map((k) => <option key={k} value={k}>{k === "store" ? "Stores" : k === "place" ? "Places" : "Events"}</option>)}
              </select>
            </label>
            <label className="block">CSV file (up to 500 rows, 5 MB)<input type="file" name="file" accept=".csv,text/csv" required className="mt-1 block w-full" /></label>
            <Button type="submit">Upload and run dry run</Button>
          </form>
          <div className="mt-4 text-sm">
            <p className="font-medium">Templates with field descriptions</p>
            <ul className="mt-1 space-y-1">
              {kinds.map((k) => (
                <li key={k}>
                  <a href={`${base}/templates/${k}`} className="text-action underline">{k}-import-template.csv</a>
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-ink-subtle">Columns</summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">{csvSpecs[k].map((c) => <li key={c.key}><code>{c.key}</code>{c.required ? " (required)" : ""}: {c.description}</li>)}</ul>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Portable site package">
            {ctx.capabilities.isOwner ? (
              <>
                <p className="text-sm text-ink-muted">Download a ZIP with content, configuration, redirects and reusable image derivatives with rights metadata. Passwords, members, inquiries, recipients and domains are never included.</p>
                <LinkButton href={`/app/sites/${siteId}/export/package`} className="mt-3">Download site package</LinkButton>
                <form method="post" action={`${base}/upload`} encType="multipart/form-data" className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                  <input type="hidden" name="type" value="package" />
                  <p className="font-medium">Import a package into this site</p>
                  <p className="text-xs text-ink-subtle">Validates checksums, paths, sizes and schemas first. Content arrives as drafts with new ids; domains and recipients stay untouched. Same-slug starter pages are replaced.</p>
                  <input type="file" name="file" accept=".zip,application/zip" required className="block w-full" />
                  <Button type="submit" variant="secondary">Upload and validate</Button>
                </form>
              </>
            ) : <p className="text-sm text-ink-muted">Only organization owners can export or import site packages.</p>}
          </Card>
          <Card title="Recent imports">
            {jobs.length === 0 ? <p className="text-sm text-ink-muted">No imports yet.</p> : (
              <ul className="divide-y divide-line text-sm">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 py-2">
                    <div><Link href={`${base}/${j.id}`} className="font-medium hover:underline">{j.filename ?? j.id.slice(0, 8)}</Link><p className="text-xs text-ink-subtle">{j.packageType === "csv" ? `${j.kind} CSV · ${j.rowCount ?? 0} rows` : "site package"} · {formatDateTime(j.createdAt, ctx.site.timeZone)}</p></div>
                    <Badge tone={j.state === "completed" ? "success" : j.state === "dry_run" ? "info" : "neutral"}>{j.state.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
