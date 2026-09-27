import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import type { UploadJobSummary } from "@/server/uploaded/publish";
import { Alert, Badge, Card, PageHeader, formatDateTime } from "@/components/admin/ui";
import { PublishUploadForm } from "@/components/admin/upload-forms";

export const dynamic = "force-dynamic";

/** A checked upload (B7): what the ZIP holds, what is wrong with it, and the button that publishes it. */
export default async function UploadJobPage({ params }: { params: Promise<{ siteId: string; jobId: string }> }) {
  const { siteId, jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const user = await requireUser(`/app/sites/${siteId}/upload/${jobId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || ctx.site.siteType !== "uploaded" || !ctx.capabilities.canPublish) notFound();
  const { site } = ctx;
  const base = `/app/sites/${siteId}`;
  const data = await withUser(user.id, async (db) => {
    const jobs = await db<Array<{ id: string; filename: string | null; state: string; createdAt: Date; summary: UploadJobSummary | null; result: { errors?: string[]; version?: number; releaseId?: string } | null }>>`select id, filename, state::text, created_at, dry_run_result as summary, result from public.import_jobs where id = ${jobId} and site_id = ${siteId} and package_type = 'uploaded_site'`;
    const [next] = await db<Array<{ version: number }>>`select coalesce(max(version), 0) + 1 as version from public.releases where site_id = ${siteId}`;
    return { job: jobs[0] ?? null, nextVersion: next?.version ?? 1 };
  });
  if (!data.job) notFound();
  const job = data.job;
  const s = job.summary;
  const errors = s?.errors?.length ? s.errors : (job.result?.errors ?? []);
  const mb = (n: number) => (n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1);
  return (
    <>
      <PageHeader
        eyebrow={site.name}
        title={job.state === "completed" ? `Published as release v${job.result?.version ?? "?"}` : errors.length ? "This upload cannot be published" : "Upload checked"}
        description={`${job.filename ?? "upload"}, ${formatDateTime(job.createdAt, site.timeZone)}${s ? `: ${s.files} file${s.files === 1 ? "" : "s"}, ${mb(s.totalBytes)} MB unpacked` : ""}.`}
      />
      {errors.length ? (
        <div className="mb-4">
          <Alert tone="danger" role="alert" title="Fix these and upload again">
            <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </Alert>
        </div>
      ) : null}
      {job.state === "completed" ? <div className="mb-4"><Alert tone="success">This upload is published as release v{job.result?.version}. <Link href={base} className="underline">Back to the overview</Link>.</Alert></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="What the ZIP holds">
          {s ? (
            <>
              <ul className="space-y-1 text-sm">
                <li>{s.files} file{s.files === 1 ? "" : "s"}, {mb(s.totalBytes)} MB unpacked ({mb(s.archiveBytes)} MB zipped)</li>
                <li>{s.hasIndex ? "index.html at the top: yes" : "index.html at the top: missing"}</li>
                <li>{s.hasNotFoundPage ? "404.html for missing addresses: yes" : "404.html for missing addresses: none (a plain not-found page is used)"}</li>
                {s.strippedFolder ? <li>Everything sat inside the folder &quot;{s.strippedFolder}&quot;, which is dropped from the addresses.</li> : null}
              </ul>
              {s.warnings.length ? (
                <div className="mt-3">
                  <Alert tone="warning" title="Worth a look, not blocking">
                    <ul className="list-disc pl-5">{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </Alert>
                </div>
              ) : null}
            </>
          ) : <p className="text-sm text-ink-muted">No inspection was recorded.</p>}
          {job.state === "dry_run" && !errors.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <PublishUploadForm siteId={siteId} jobId={job.id} version={data.nextVersion} />
            </div>
          ) : null}
          {job.state !== "dry_run" && !errors.length && job.state !== "completed" ? <p className="mt-3 text-sm text-ink-muted"><Badge tone="neutral">{job.state}</Badge></p> : null}
        </Card>
        <Card title="Files">
          {s?.listing?.length ? (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-line text-left uppercase tracking-wide text-ink-subtle"><th className="py-1 pr-2">Address</th><th className="py-1 pr-2">Type</th><th className="py-1 text-right">Size</th></tr></thead>
                <tbody>
                  {s.listing.map((f) => (
                    <tr key={f.path} className="border-b border-line">
                      <td className="py-1 pr-2 break-all"><code>{f.path}</code></td>
                      <td className="py-1 pr-2 text-ink-muted">{f.type.split(";")[0]}</td>
                      <td className="py-1 text-right text-ink-muted">{f.bytes < 1024 ? `${f.bytes} B` : f.bytes < 1024 * 1024 ? `${(f.bytes / 1024).toFixed(0)} KB` : `${mb(f.bytes)} MB`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.files > s.listing.length ? <p className="mt-2 text-xs text-ink-subtle">The first {s.listing.length} of {s.files} files are listed.</p> : null}
            </div>
          ) : <p className="text-sm text-ink-muted">Nothing to list.</p>}
        </Card>
      </div>
      <p className="mt-4 text-sm"><Link href={`${base}/upload`} className="text-action underline">← Back to Upload</Link></p>
    </>
  );
}
