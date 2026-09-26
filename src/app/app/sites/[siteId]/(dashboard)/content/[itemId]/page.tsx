import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getItem } from "@/server/data/content";
import { kindRegistry } from "@/modules/registry";
import { PageHeader } from "@/components/admin/ui";
import { ItemEditor } from "@/components/admin/editor/item-editor";
import { loadEditorContext } from "@/server/data/editor-context";

export const dynamic = "force-dynamic";

export default async function ItemEditorPage({ params }: { params: Promise<{ siteId: string; itemId: string }> }) {
  const { siteId, itemId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/content/${itemId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx) notFound();
  const data = await withUser(user.id, async (db) => {
    const found = await getItem(db, itemId);
    if (!found || found.item.siteId !== siteId) return null;
    const editor = await loadEditorContext(db, ctx.site);
    const reviews = await db<{ id: string; state: string; comment: string | null; actorEmail: string; createdAt: Date; revisionVersion: number }[]>`
      select rv.id, rv.state::text, rv.comment, coalesce(public.user_display(rv.actor_id), 'unknown user') as actor_email, rv.created_at, r.version as revision_version
      from public.reviews rv
      join public.content_revisions r on r.id = rv.revision_id
      where rv.item_id = ${itemId}
      order by rv.created_at desc limit 20`;
    const latestReview = reviews.find((r) => r.revisionVersion === found.revision.version);
    const [pub] = await db<{ revisionId: string | null }[]>`
      select r.snapshot #>> array['items', ${itemId}::text, 'revisionId'] as revision_id
      from public.sites s join public.releases r on r.id = s.active_release_id where s.id = ${siteId}`;
    return { found, editor, reviews, latestReview, publishedRevisionId: pub?.revisionId ?? null };
  });
  if (!data) notFound();
  const { found, editor, reviews, latestReview } = data;
  const reviewState = (latestReview?.state ?? "unsubmitted") as "unsubmitted" | "submitted" | "comment" | "changes_requested" | "approved";
  const label = kindRegistry[found.item.kind].label;
  return (
    <>
      <PageHeader
        eyebrow={`${ctx.site.name} · ${label}`}
        title={found.revision.title}
        description={<span><Link href={`/app/sites/${siteId}/content`} className="text-action underline">← Content</Link> · Explicit save is required; leaving with unsaved changes prompts a warning.</span>}
      />
      <ItemEditor
        siteId={siteId}
        preset={ctx.site.preset}
        kindLabel={label}
        item={{ id: found.item.id, kind: found.item.kind, archivedAt: found.item.archivedAt?.toISOString() ?? null }}
        revision={{ id: found.revision.id, version: found.revision.version, createdAt: found.revision.createdAt.toISOString(), payload: found.revision.payload }}
        reviewState={reviewState === "comment" ? (reviews.find((r) => r.revisionVersion === found.revision.version && r.state !== "comment")?.state as typeof reviewState) ?? "unsubmitted" : reviewState}
        reviews={reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        publishedRevisionId={data.publishedRevisionId}
        capabilities={{ canEdit: ctx.capabilities.canEdit && !found.item.archivedAt, canReview: ctx.capabilities.canReview, canPublish: ctx.capabilities.canPublish }}
        ctx={editor}
        timeZone={ctx.site.timeZone}
        isOwnRevision={found.revision.authorId === user.id}
        reviewRequired={ctx.site.reviewRequired}
      />
    </>
  );
}
