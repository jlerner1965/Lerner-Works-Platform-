import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Alert, Badge, Button, Card, PageHeader, LinkButton, formatDateTime, selectClass } from "@/components/admin/ui";
import { csvSpecs, importableKinds } from "@/server/import/csv-spec";
import { presets } from "@/modules/presets";
import { kindRegistry } from "@/modules/registry";

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
      <PageHeader eyebrow={ctx.site.name} title="Import and export" description={`Every import begins with a dry run that changes nothing. Imported records are ${ctx.site.reviewRequired || !ctx.capabilities.canPublish ? "drafts until reviewed and published" : "approved as they are imported and go out with the next publish"}. The site package is portability, not disaster recovery.`} />
      {sp.error ? <div className="mb-4"><Alert tone="danger" role="alert">{sp.error}</Alert></div> : null}
      {sp.done ? <div className="mb-4"><Alert tone="success">Import applied: {sp.done}</Alert></div> : null}
      <Card title="Onboarding package: fill in the sheets, add the pictures, import once">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div className="text-sm text-ink-muted">
            <p>The fastest way from an empty site to a first release. The template holds one spreadsheet per content kind of this site ({kinds.map((k) => kindRegistry[k].plural.toLowerCase()).join(", ")}), a settings sheet for the brand, contact details and the text of the home and About pages, and an images folder with a sheet for alternative text and rights. Zip it again and upload it here: the dry run lists every row, image and setting before anything is written.</p>
            <p className="mt-2">{ctx.capabilities.isOwner ? "As an owner you can import the settings sheet as well as the content." : "The settings sheet needs an organization owner; your import brings the content and images."}</p>
          </div>
          <LinkButton href={`/app/sites/${siteId}/import/onboarding-template`}>Download the template</LinkButton>
        </div>
        <form method="post" action={`${base}/upload`} encType="multipart/form-data" className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-3 text-sm">
          <input type="hidden" name="type" value="onboarding" />
          <label className="block">Filled-in package (ZIP, up to 64 MB)<input type="file" name="file" accept=".zip,application/zip" required className="mt-1 block w-full" /></label>
          <Button type="submit">Upload and run dry run</Button>
        </form>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Import CSV (${kinds.map((k) => kindRegistry[k].plural.toLowerCase()).join(", ")})`}>
          <form method="post" action={`${base}/upload`} encType="multipart/form-data" className="space-y-3 text-sm">
            <input type="hidden" name="type" value="csv" />
            <label className="block">File contains
              <select name="kind" className={selectClass} defaultValue={kinds[0]}>
                {kinds.map((k) => <option key={k} value={k}>{kindRegistry[k].plural}</option>)}
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
                    <div><Link href={`${base}/${j.id}`} className="font-medium hover:underline">{j.filename ?? j.id.slice(0, 8)}</Link><p className="text-xs text-ink-subtle">{j.packageType === "csv" ? `${j.kind} CSV · ${j.rowCount ?? 0} rows` : j.packageType === "onboarding" ? `onboarding package · ${j.rowCount ?? 0} rows` : "site package"} · {formatDateTime(j.createdAt, ctx.site.timeZone)}</p></div>
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
