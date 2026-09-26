import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { listCandidates, listReleases } from "@/server/publishing/candidates";
import { buildCandidateAction } from "@/server/actions/publishing";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function PublishingPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/publishing`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canPublish) notFound();
  const { candidates, releases, actors } = await withUser(user.id, async (db) => {
    const candidates = await listCandidates(db, siteId, 20);
    const releases = await listReleases(db, siteId, 50);
    const ids = [...new Set([...releases.map((r) => r.actorId), ...candidates.map((c) => c.createdBy)].filter((x): x is string => Boolean(x)))];
    const rows = ids.length ? await db<{ id: string; email: string | null }[]>`select u.id, public.user_display(u.id) as email from unnest(${ids}::uuid[]) as u(id)` : [];
    return { candidates, releases, actors: new Map(rows.map((r) => [r.id, r.email ?? "unknown user"])) };
  });
  const base = `/app/sites/${siteId}/publishing`;
  const active = releases.find((r) => r.id === ctx.site.activeReleaseId) ?? null;
  const open = candidates.filter((c) => c.state === "ready" || c.state === "blocked");
  return (
    <>
      <PageHeader
        eyebrow={ctx.site.name}
        title="Publishing"
        description="Build a candidate from approved changes, review its summary and findings, preview the frozen result, then activate it. Restoring a historical release creates a new release."
        actions={
          <form action={buildCandidateAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <Button type="submit">Build candidate</Button>
          </form>
        }
      />
      {sp.error ? <div className="mb-4"><Alert tone="danger">Candidate could not be built: {sp.error}</Alert></div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Active release">
          {active ? (
            <div className="text-sm">
              <p className="text-lg font-semibold">Release v{active.version}</p>
              <p className="text-ink-muted">Activated {formatDateTime(active.createdAt, ctx.site.timeZone)} by {actors.get(active.actorId ?? "") ?? "unknown user"}</p>
              {active.restoredFromReleaseId ? <p className="mt-1"><Badge tone="warning">restored from an earlier release</Badge></p> : null}
              <p className="mt-2 text-xs text-ink-subtle">Snapshot hash {active.snapshotHash.slice(0, 16)} · schema v{active.schemaVersion}</p>
              {ctx.site.mode === "demo" ? <p className="mt-2"><a href={`/demo/${ctx.site.key}`} target="_blank" rel="noreferrer" className="text-action underline">Open the public demonstration site</a></p> : null}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Nothing has been published yet. Build a candidate to create the first release.</p>
          )}
        </Card>
        <Card title="Open candidates">
          {open.length === 0 ? <p className="text-sm text-ink-muted">No open candidates.</p> : (
            <ul className="divide-y divide-line text-sm">
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
          )}
        </Card>
      </div>
      <Card title="Release history" className="mt-4">
        {releases.length === 0 ? <EmptyState title="No releases yet" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-2">Release</th><th className="py-2">Activated</th><th className="py-2">By</th><th className="py-2">Reason</th><th className="py-2">Status</th></tr></thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="py-2"><Link href={`${base}/releases/${r.id}`} className="font-medium hover:underline">v{r.version}</Link>{r.restoredFromReleaseId ? <span className="ml-1 text-xs text-ink-subtle">(restore)</span> : null}</td>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(r.createdAt, ctx.site.timeZone)}</td>
                  <td className="py-2">{actors.get(r.actorId ?? "") ?? "unknown user"}</td>
                  <td className="py-2 text-ink-muted">{r.reason ?? "—"}</td>
                  <td className="py-2">{r.id === ctx.site.activeReleaseId ? <Badge tone="success">active</Badge> : r.restorationBlockedReason ? <Badge tone="danger">restore blocked</Badge> : <Badge tone="neutral">historical</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {candidates.some((c) => c.state !== "ready" && c.state !== "blocked") ? (
        <Card title="Closed candidates" className="mt-4">
          <ul className="divide-y divide-line text-sm">
            {candidates.filter((c) => c.state !== "ready" && c.state !== "blocked").map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`${base}/candidates/${c.id}`} className="hover:underline">Candidate {c.id.slice(0, 8)} · {formatDateTime(c.createdAt, ctx.site.timeZone)}</Link>
                <Badge tone={c.state === "activated" ? "success" : "neutral"}>{c.state}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
