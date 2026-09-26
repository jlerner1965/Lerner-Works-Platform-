import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Badge, Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { kindRegistry, type ContentKind } from "@/modules/registry";

export const dynamic = "force-dynamic";

/** Review queue: working revisions whose latest decision is submitted, commented or changes requested. */
export default async function ReviewsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/reviews`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !(ctx.capabilities.canReview || ctx.capabilities.canEdit)) notFound();
  const rows = await withUser(user.id, (db) => db<Array<{ itemId: string; kind: ContentKind; title: string; version: number; state: string; comment: string | null; actorEmail: string | null; decidedAt: Date; revisionId: string }>>`
    select i.id as item_id, i.kind, r.title, r.version, rv.state::text, rv.comment, public.user_display(rv.actor_id) as actor_email, rv.created_at as decided_at, r.id as revision_id
    from public.content_items i
    join public.content_revisions r on r.id = i.current_revision_id
    join lateral (select * from public.reviews x where x.revision_id = r.id order by x.created_at desc limit 1) rv on true
    where i.site_id = ${siteId} and i.archived_at is null and rv.state in ('submitted', 'comment', 'changes_requested')
    order by rv.created_at asc`);
  const waiting = rows.filter((r) => r.state !== "changes_requested");
  const returned = rows.filter((r) => r.state === "changes_requested");
  const base = `/app/sites/${siteId}/content`;
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <div className="min-w-0">
        <Link href={`${base}/${r.itemId}`} className="font-medium hover:underline">{r.title}</Link>
        <span className="ml-2 text-xs text-ink-subtle">{kindRegistry[r.kind].label} · v{r.version} · {r.actorEmail ?? "unknown user"} · {formatDateTime(r.decidedAt, ctx.site.timeZone)}</span>
        {r.comment ? <p className="text-xs text-ink-muted">“{r.comment}”</p> : null}
      </div>
      <Badge tone={r.state === "changes_requested" ? "warning" : "info"}>{r.state.replace("_", " ")}</Badge>
    </li>
  );
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="Reviews" description="Decisions are tied to exact revisions. If an editor saves again after approval, the new revision is unreviewed and the approved one stays available to publish." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Waiting for review (${waiting.length})`}>
          {waiting.length === 0 ? <EmptyState title="Nothing waiting" description="Submitted revisions appear here." /> : <ul className="divide-y divide-line">{waiting.map((r) => <Row key={r.revisionId} r={r} />)}</ul>}
        </Card>
        <Card title={`Changes requested (${returned.length})`}>
          {returned.length === 0 ? <EmptyState title="No open change requests" /> : <ul className="divide-y divide-line">{returned.map((r) => <Row key={r.revisionId} r={r} />)}</ul>}
        </Card>
      </div>
    </>
  );
}
