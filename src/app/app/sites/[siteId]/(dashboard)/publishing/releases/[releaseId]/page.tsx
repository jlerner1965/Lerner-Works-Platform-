import crypto from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getRelease, getActiveRelease } from "@/server/publishing/candidates";
import { summarizeChanges } from "@/server/publishing/diff";
import { isSupportedSnapshot } from "@/server/publishing/snapshot";
import { Badge, Card, PageHeader, formatDateTime, DescriptionList } from "@/components/admin/ui";
import { RestoreForm } from "@/components/admin/publishing-forms";

export const dynamic = "force-dynamic";

export default async function ReleasePage({ params }: { params: Promise<{ siteId: string; releaseId: string }> }) {
  const { siteId, releaseId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/publishing/releases/${releaseId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canPublish) notFound();
  const data = await withUser(user.id, async (db) => {
    const release = await getRelease(db, releaseId);
    if (!release || release.siteId !== siteId) return null;
    const active = await getActiveRelease(db, ctx.site);
    const actor = release.actorId ? (await db<{ email: string | null }[]>`select public.user_display(${release.actorId}) as email`)[0]?.email : null;
    return { release, active, actor };
  });
  if (!data) notFound();
  const { release, active } = data;
  const isActive = active?.id === release.id;
  const diff = active && isSupportedSnapshot(active.snapshot) && isSupportedSnapshot(release.snapshot) && !isActive ? summarizeChanges(active.snapshot, release.snapshot) : null;
  return (
    <>
      <PageHeader eyebrow={`${ctx.site.name} · Publishing`} title={`Release v${release.version}`} description={<Link href={`/app/sites/${siteId}/publishing`} className="text-action underline">← Publishing</Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Release facts">
          <DescriptionList
            items={[
              { term: "Status", value: isActive ? <Badge tone="success">active</Badge> : <Badge tone="neutral">historical</Badge> },
              { term: "Activated", value: formatDateTime(release.createdAt, ctx.site.timeZone) },
              { term: "By", value: data.actor ?? "unknown user" },
              { term: "Reason", value: release.reason ?? "—" },
              { term: "Source", value: release.restoredFromReleaseId ? `restored from release ${release.restoredFromReleaseId.slice(0, 8)}` : release.sourceCandidateId ? `candidate ${release.sourceCandidateId.slice(0, 8)}` : "—" },
              { term: "Snapshot hash", value: <code>{release.snapshotHash.slice(0, 16)}</code> },
              { term: "Schema", value: `v${release.schemaVersion}` },
              { term: "Waivers", value: Array.isArray(release.waivers) && release.waivers.length ? `${release.waivers.length} warning(s) waived` : "none" },
            ]}
          />
        </Card>
        <Card title="Restore">
          <RestoreForm siteId={siteId} releaseId={release.id} idempotencyKey={crypto.randomUUID()} version={release.version} blockedReason={release.restorationBlockedReason} isActive={isActive} />
        </Card>
      </div>
      <Card title={isActive ? "Content" : "Differences against the active release (what restoring would change)"} className="mt-4">
        {diff ? (
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium">Items that would be added back ({diff.added.length})</p>
              <ul className="list-disc pl-5 text-ink-muted">{diff.added.map((a) => <li key={a.itemId}>{a.kind}: {a.title}</li>)}</ul>
              <p className="mt-2 font-medium">Items that would be removed ({diff.removed.length})</p>
              <ul className="list-disc pl-5 text-ink-muted">{diff.removed.map((a) => <li key={a.itemId}>{a.kind}: {a.title}</li>)}</ul>
            </div>
            <div>
              <p className="font-medium">Items that would change ({diff.changed.length})</p>
              <ul className="list-disc pl-5 text-ink-muted">{diff.changed.map((c) => <li key={c.itemId}>{c.kind}: {c.title} — {c.fields.join(", ") || "no field changes"}</li>)}</ul>
              {diff.navigationChanged ? <p className="mt-2">Navigation would change.</p> : null}
              {diff.configFields.length ? <p className="mt-2">Configuration would change: {diff.configFields.join(", ")}.</p> : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{Object.keys(release.snapshot.items).length} items · {release.snapshot.routes.length} routes · {Object.keys(release.snapshot.media).length} media assets</p>
        )}
      </Card>
    </>
  );
}
