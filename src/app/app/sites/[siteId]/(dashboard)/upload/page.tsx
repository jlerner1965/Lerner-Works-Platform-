import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { previewOrigin } from "@/server/config";
import { listUploadedReleases } from "@/server/uploaded/publish";
import { getSiteSource } from "@/server/uploaded/sources";
import { MAX_ARCHIVE_BYTES, MAX_FILES } from "@/server/uploaded/archive";
import { Alert, Badge, Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { RestoreForm } from "@/components/admin/publishing-forms";
import { UploadZipForm } from "@/components/admin/upload-zip-form";
import { ForgetSourceForm, GithubSourceForm } from "@/components/admin/github-forms";

export const dynamic = "force-dynamic";

/** Upload (B7, B8): a ZIP goes in here in parts, or the site is fetched from GitHub; the releases it made are listed below with restore. */
export default async function UploadPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/upload`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || ctx.site.siteType !== "uploaded" || !ctx.capabilities.canPublish) notFound();
  const { site } = ctx;
  const base = `/app/sites/${siteId}`;
  const data = await withUser(user.id, async (db) => {
    const releases = await listUploadedReleases(db, siteId);
    const jobs = await db<Array<{ id: string; filename: string | null; state: string; createdAt: Date; rowCount: number | null }>>`select id, filename, state::text, created_at, row_count from public.import_jobs where site_id = ${siteId} and package_type = 'uploaded_site' order by created_at desc limit 10`;
    const source = await getSiteSource(db, siteId);
    return { releases, jobs, source };
  });
  const preview = previewOrigin(site.key);
  const source = data.source;
  const short = (sha: string | null) => (sha ? sha.slice(0, 7) : null);
  return (
    <>
      <PageHeader eyebrow={site.name} title="Upload" description="Zip the finished site (its index.html at the top, inside one folder, or in the build folder) and upload it, or fetch it from its GitHub repository. Either way the files are checked first: what they hold, what is left out, what is missing. Nothing changes on the site until you publish the check." />
      {sp.error ? <div className="mb-4"><Alert tone="danger" role="alert">{sp.error}</Alert></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Upload a ZIP">
          <UploadZipForm siteId={siteId} maxMegabytes={MAX_ARCHIVE_BYTES / 1024 / 1024} maxFiles={MAX_FILES} />
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">
            First time? <a className="text-action underline" href={`${base}/upload/sample`}>Download the sample site (ZIP)</a> and upload it as it is: five pages, a stylesheet, a picture and a working contact form.
          </p>
        </Card>
        <Card title="Publish from GitHub">
          {source ? (
            <div className="mb-3 rounded border border-line bg-surface-muted p-3 text-sm">
              <p><span className="font-medium">{source.repository}</span> @ {source.branch}{source.root ? <>, folder <code>{source.root}</code></> : null}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {source.lastPublishedCommit ? <>Live: commit {short(source.lastPublishedCommit)}. </> : <>Nothing from it is published yet. </>}
                {source.lastCommit ? <>Last checked: commit {short(source.lastCommit)}{source.lastCheckedAt ? ` on ${formatDateTime(source.lastCheckedAt, site.timeZone)}` : ""}{source.lastPublishedCommit && source.lastCommit !== source.lastPublishedCommit ? ", newer than what is live" : ""}.</> : null}
              </p>
              <div className="mt-2"><ForgetSourceForm siteId={siteId} /></div>
            </div>
          ) : null}
          <GithubSourceForm siteId={siteId} source={source ? { repository: source.repository, branch: source.branch, root: source.root } : null} />
        </Card>
      </div>
      <Card title="Where it shows" className="mt-4">
        <p className="text-sm">{preview ? <>Preview: <a className="text-action underline" href={`${preview}/`} target="_blank" rel="noreferrer">{preview}/</a> (never indexed by search engines).</> : "No preview hostname is configured on this deployment (PREVIEW_DOMAIN), so the site can be seen only on its live domain."}</p>
        <p className="mt-2 text-sm text-ink-muted">Live: the verified, activated domain in <Link href={`${base}/settings#domains`} className="text-action underline">Settings → Domains</Link>, once the site is switched live in Settings → Publishing.</p>
        {data.jobs.length ? (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-sm font-medium">Recent checks</p>
            <ul className="mt-1 divide-y divide-line text-sm">
              {data.jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span><Link href={`${base}/upload/${j.id}`} className="text-action underline">{j.filename ?? "upload"}</Link> <span className="text-xs text-ink-subtle">{formatDateTime(j.createdAt, site.timeZone)}{j.rowCount != null ? ` · ${j.rowCount} files` : ""}</span></span>
                  <Badge tone={j.state === "completed" ? "success" : j.state === "dry_run" ? "warning" : j.state === "cancelled" ? "neutral" : "danger"}>{j.state === "completed" ? "published" : j.state === "dry_run" ? "checked, not published" : j.state === "cancelled" ? "expired" : j.state}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      <Card title="Releases" className="mt-4">
        {data.releases.length === 0 ? <EmptyState title="No releases yet" description="The first published upload becomes release v1." /> : (
          <ul className="divide-y divide-line">
            {data.releases.map((r) => {
              const active = r.id === site.activeReleaseId;
              return (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Release v{r.version}</span>
                    {active ? <Badge tone="success">active</Badge> : null}
                    {r.restoredFromReleaseId ? <Badge tone="neutral">restored</Badge> : null}
                    <span className="text-ink-subtle">{formatDateTime(r.createdAt, site.timeZone)}{r.actor ? ` · ${r.actor}` : ""}</span>
                  </div>
                  {r.source ? (
                    <p className="mt-1 text-ink-muted">
                      {r.source.github ? <>{r.source.github.repository} @ {r.source.github.branch}, commit {r.source.github.commit.slice(0, 7)}: </> : <>{r.source.filename}: </>}
                      {r.source.files} file{r.source.files === 1 ? "" : "s"}, {(r.source.totalBytes / 1024 / 1024).toFixed(1)} MB{r.source.root ? ` (from the folder "${r.source.root}")` : r.source.strippedFolder ? ` (folder "${r.source.strippedFolder}" dropped)` : ""}.
                    </p>
                  ) : null}
                  {r.reason ? <p className="mt-1 text-ink-muted">Note: {r.reason}</p> : null}
                  <div className="mt-2">
                    <RestoreForm siteId={siteId} releaseId={r.id} idempotencyKey={randomUUID()} version={r.version} blockedReason={r.restorationBlockedReason} isActive={active} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
