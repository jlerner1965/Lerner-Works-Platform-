import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { listCandidates, listReleases, previewCandidate, type CandidatePreview } from "@/server/publishing/candidates";
import { buildCandidateAction } from "@/server/actions/publishing";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { PublishNowForm } from "@/components/admin/publishing-forms";
import { ChangeSummaryList, ExcludedList } from "@/components/admin/publish-summary";

export const dynamic = "force-dynamic";

/**
 * Publish (site-building programme B1): what the next release would contain is computed from
 * the saved and approved work without writing anything, blockers link to their fixes, and one
 * action builds the candidate and activates it. The careful path (build a candidate, preview
 * the frozen result, waive warnings, activate) stays available below, as does restoring.
 */
export default async function PublishingPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/publishing`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canPublish) notFound();
  const { preview, previewError, candidates, releases, actors } = await withUser(user.id, async (db) => {
    let preview: CandidatePreview | null = null;
    let previewError: string | null = null;
    try {
      preview = await previewCandidate(db, ctx.site);
    } catch (err) {
      previewError = (err as Error).message;
    }
    const candidates = await listCandidates(db, siteId, 20);
    const releases = await listReleases(db, siteId, 50);
    const ids = [...new Set([...releases.map((r) => r.actorId), ...candidates.map((c) => c.createdBy)].filter((x): x is string => Boolean(x)))];
    const rows = ids.length ? await db<{ id: string; email: string | null }[]>`select u.id, public.user_display(u.id) as email from unnest(${ids}::uuid[]) as u(id)` : [];
    return { preview, previewError, candidates, releases, actors: new Map(rows.map((r) => [r.id, r.email ?? "unknown user"])) };
  });
  const base = `/app/sites/${siteId}/publishing`;
  const active = releases.find((r) => r.id === ctx.site.activeReleaseId) ?? null;
  const open = candidates.filter((c) => c.state === "ready" || c.state === "blocked");
  const demoUrl = ctx.site.mode === "demo" ? `/demo/${ctx.site.key}` : null;
  const blockers = preview?.validation.blockers ?? [];
  const warnings = preview?.validation.warnings ?? [];
  const mediaTitle = (id: string) => preview?.built.manifest.media[id]?.title || id.slice(0, 8);
  const disabledReason = !preview ? "Nothing can be computed for this site yet." : !preview.differs ? "Nothing to publish: the public site matches the saved and approved work." : blockers.length ? `${blockers.length} problem${blockers.length === 1 ? "" : "s"} to fix first.` : undefined;
  return (
    <>
      <PageHeader
        eyebrow={ctx.site.name}
        title="Publish"
        description="Publishing takes the saved and approved work, checks it and activates it as a new release in one step. Every release is kept and can be restored."
      />
      {sp.error ? <div className="mb-4"><Alert tone="danger">Candidate could not be built: {sp.error}</Alert></div> : null}
      {previewError ? <div className="mb-4"><Alert tone="danger">The next release could not be computed: {previewError}</Alert></div> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={preview?.differs ? "What will publish" : "Next release"}>
          {preview ? (
            <>
              {preview.differs ? <ChangeSummaryList summary={preview.summary} mediaTitle={mediaTitle} /> : <p className="text-sm text-ink-muted">Nothing to publish. The public site matches the saved and approved work.</p>}
              <ExcludedList siteId={siteId} notes={preview.notes} />
              {blockers.length ? (
                <div className="mt-4">
                  <p className="mb-1 text-sm font-semibold text-danger">Fix before publishing ({blockers.length})</p>
                  <ul className="space-y-2 text-sm">
                    {blockers.map((f, i) => (
                      <li key={i} className="rounded border border-danger/40 bg-danger-soft p-2">
                        <p>{f.message}</p>
                        <p className="text-xs text-ink-muted">{f.itemTitle ? `${f.itemTitle} · ` : ""}{f.field ? `field ${f.field} · ` : ""}<Link href={f.href} className="text-action underline">Fix</Link></p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {warnings.length ? (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-warning">Warnings ({warnings.length}) — recorded with the release, publishing is still allowed</summary>
                  <ul className="mt-2 space-y-2">
                    {warnings.map((f, i) => (
                      <li key={i} className="rounded border border-warning/40 bg-warning-soft p-2">
                        <p>{f.message}</p>
                        <p className="text-xs text-ink-muted">{f.itemTitle ? `${f.itemTitle} · ` : ""}{f.field ? `field ${f.field} · ` : ""}<Link href={f.href} className="text-action underline">Fix</Link></p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <div className="mt-4 border-t border-line pt-4">
                <PublishNowForm siteId={siteId} disabled={!preview.differs || blockers.length > 0} disabledReason={disabledReason} demoUrl={demoUrl} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{disabledReason}</p>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Live now">
            {active ? (
              <div className="text-sm">
                <p className="text-lg font-semibold">Release v{active.version}</p>
                <p className="text-ink-muted">Published {formatDateTime(active.createdAt, ctx.site.timeZone)} by {actors.get(active.actorId ?? "") ?? "unknown user"}</p>
                {active.reason ? <p className="mt-1 text-ink-muted">{active.reason}</p> : null}
                {active.restoredFromReleaseId ? <p className="mt-1"><Badge tone="warning">restored from an earlier release</Badge></p> : null}
                <p className="mt-2">
                  {demoUrl ? <a href={demoUrl} target="_blank" rel="noreferrer" className="text-action underline">Open the public site</a> : <span className="text-ink-muted">Served on the active verified domain.</span>}
                  {" · "}
                  <Link href={`${base}/releases/${active.id}`} className="text-action underline">Release details</Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Nothing has been published yet. The first publish creates release v1.</p>
            )}
          </Card>
          <Card title="Preview or waive warnings first">
            <p className="text-sm text-ink-muted">To look at the frozen result before it goes live, or to waive a warning with a reason, build a candidate: it is checked and previewed on its own page and activated from there.</p>
            <form action={buildCandidateAction} className="mt-3">
              <input type="hidden" name="siteId" value={siteId} />
              <Button type="submit" variant="secondary">Build a candidate</Button>
            </form>
            {open.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {open.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <Link href={`${base}/candidates/${c.id}`} className="font-medium hover:underline">Candidate {c.id.slice(0, 8)}</Link>
                      <p className="text-xs text-ink-subtle">built {formatDateTime(c.createdAt, ctx.site.timeZone)} by {actors.get(c.createdBy ?? "") ?? "unknown user"} · {c.validation.blockers.length} blocker(s), {c.validation.warnings.length} warning(s)</p>
                    </div>
                    <Badge tone={c.state === "ready" ? "success" : "danger"}>{c.state}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
      <Card title="Release history" className="mt-4">
        {releases.length === 0 ? <EmptyState title="No releases yet" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-2">Release</th><th className="py-2">Published</th><th className="py-2">By</th><th className="py-2">Note</th><th className="py-2">Status</th></tr></thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="py-2"><Link href={`${base}/releases/${r.id}`} className="font-medium hover:underline">v{r.version}</Link>{r.restoredFromReleaseId ? <span className="ml-1 text-xs text-ink-subtle">(restore)</span> : null}</td>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(r.createdAt, ctx.site.timeZone)}</td>
                  <td className="py-2">{actors.get(r.actorId ?? "") ?? "unknown user"}</td>
                  <td className="py-2 text-ink-muted">{r.reason ?? "—"}</td>
                  <td className="py-2">{r.id === ctx.site.activeReleaseId ? <Badge tone="success">live</Badge> : r.restorationBlockedReason ? <Badge tone="danger">restore blocked</Badge> : <Badge tone="neutral">earlier</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {candidates.some((c) => c.state !== "ready" && c.state !== "blocked") ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-action underline">Closed candidates</summary>
          <ul className="mt-2 divide-y divide-line rounded border border-line bg-surface px-3">
            {candidates.filter((c) => c.state !== "ready" && c.state !== "blocked").map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`${base}/candidates/${c.id}`} className="hover:underline">Candidate {c.id.slice(0, 8)} · {formatDateTime(c.createdAt, ctx.site.timeZone)}</Link>
                <Badge tone={c.state === "activated" ? "success" : "neutral"}>{c.state}</Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
