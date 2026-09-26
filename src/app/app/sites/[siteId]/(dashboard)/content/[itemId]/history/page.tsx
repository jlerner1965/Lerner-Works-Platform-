import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getItem, listRevisions } from "@/server/data/content";
import { changedFields, labelForField } from "@/server/publishing/diff";
import { PageHeader, formatDateTime, Badge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function RevisionHistoryPage({ params }: { params: Promise<{ siteId: string; itemId: string }> }) {
  const { siteId, itemId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/content/${itemId}/history`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx) notFound();
  const data = await withUser(user.id, async (db) => {
    const found = await getItem(db, itemId);
    if (!found || found.item.siteId !== siteId) return null;
    const revisions = await listRevisions(db, itemId, 100);
    const authors = await db<{ id: string; email: string | null }[]>`
      select r.id, public.user_display(r.author_id) as email from public.content_revisions r where r.item_id = ${itemId}`;
    const states = await db<{ revisionId: string; state: string }[]>`
      select distinct on (revision_id) revision_id, state::text from public.reviews where item_id = ${itemId} order by revision_id, created_at desc`;
    const [pub] = await db<{ revisionId: string | null }[]>`
      select r.snapshot #>> array['items', ${itemId}::text, 'revisionId'] as revision_id
      from public.sites s join public.releases r on r.id = s.active_release_id where s.id = ${siteId}`;
    return { found, revisions, authors: new Map(authors.map((a) => [a.id, a.email])), states: new Map(states.map((s) => [s.revisionId, s.state])), publishedRevisionId: pub?.revisionId ?? null };
  });
  if (!data) notFound();
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title={`History · ${data.found.revision.title}`} description={<Link href={`/app/sites/${siteId}/content/${itemId}`} className="text-action underline">← Back to editor</Link>} />
      <ol className="space-y-2">
        {data.revisions.map((r, i) => {
          const prev = data.revisions[i + 1];
          const fields = prev ? changedFields(prev.payload, r.payload).map(labelForField) : [];
          const state = data.states.get(r.id);
          return (
            <li key={r.id} className="rounded border border-line bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">v{r.version}</span>
                <span className="text-ink-subtle">{formatDateTime(r.createdAt, ctx.site.timeZone)} · {data.authors.get(r.id) ?? "unknown user"}</span>
                {r.id === data.found.item.currentRevisionId ? <Badge tone="info">working</Badge> : null}
                {r.id === data.publishedRevisionId ? <Badge tone="success">published</Badge> : null}
                {state ? <Badge tone={state === "approved" ? "success" : state === "changes_requested" ? "warning" : "neutral"}>{state.replace("_", " ")}</Badge> : null}
              </div>
              {r.changeNote ? <p className="mt-1">{r.changeNote}</p> : null}
              <p className="mt-1 text-xs text-ink-subtle">{prev ? (fields.length ? `Changed: ${fields.join(", ")}` : "No field changes") : "Initial revision"}</p>
            </li>
          );
        })}
      </ol>
    </>
  );
}
