import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { listItems } from "@/server/data/content";
import { isContentKind, kindRegistry, type ContentKind } from "@/modules/registry";
import { presets } from "@/modules/presets";
import { Alert, Badge, Button, EmptyState, LinkButton, PageHeader, formatDateTime, inputClass, selectClass } from "@/components/admin/ui";
import { archiveItemsAction } from "@/server/actions/content";
import { BulkSelectionForm } from "@/components/admin/bulk-selection";

export const dynamic = "force-dynamic";

type Search = { kind?: string; q?: string; status?: string; page?: string; sort?: string; notice?: string; count?: string };

export default async function ContentListPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<Search> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/content`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx) notFound();
  const kinds = presets[ctx.site.preset].kinds as ContentKind[];
  const kind = sp.kind && isContentKind(sp.kind) && kinds.includes(sp.kind) ? sp.kind : undefined;
  const status = (["all", "draft", "archived", "published", "unpublished"].includes(sp.status ?? "") ? sp.status : "draft") as "all" | "draft" | "archived" | "published" | "unpublished";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const sort = sp.sort === "title" ? "title" : "updated";
  const result = await withUser(user.id, (db) => listItems(db, { siteId, kind, search: sp.q, status, page, pageSize: 25, sort }));
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const base = `/app/sites/${siteId}/content`;
  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { kind: kind ?? "", q: sp.q ?? "", status, sort, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `${base}?${p.toString()}`;
  };
  return (
    <>
      <PageHeader
        eyebrow={ctx.site.name}
        title="Content"
        description="Working revisions for this site. Published state is shown separately: an item can be live and have a newer draft at the same time."
        actions={ctx.capabilities.canEdit ? <LinkButton href={`${base}/new${kind ? `?kind=${kind}` : ""}`}>New item</LinkButton> : null}
      />
      {sp.notice === "archived" ? <div className="mb-4"><Alert tone="success">Archived {sp.count} item(s). Archiving is a draft change until the next release removes them from public routes.</Alert></div> : null}
      {sp.notice === "restored" ? <div className="mb-4"><Alert tone="success">Restored {sp.count} item(s) from the archive.</Alert></div> : null}
      {sp.notice === "nothing-selected" ? <div className="mb-4"><Alert tone="warning">Select at least one item first.</Alert></div> : null}
      <form method="get" action={base} className="mb-4 flex flex-wrap items-end gap-3 rounded border border-line bg-surface p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-subtle">Type</span>
          <select name="kind" defaultValue={kind ?? ""} className={selectClass}>
            <option value="">All types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>{kindRegistry[k].plural}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-subtle">Status</span>
          <select name="status" defaultValue={status} className={selectClass}>
            <option value="draft">Active (not archived)</option>
            <option value="unpublished">With unpublished changes</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="all">Everything</option>
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-ink-subtle">Search title or slug</span>
          <input type="search" name="q" defaultValue={sp.q ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-subtle">Sort</span>
          <select name="sort" defaultValue={sort} className={selectClass}>
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">Apply</Button>
        {(kind || sp.q || status !== "draft" || sort !== "updated") ? <Link href={base} className="text-action underline">Reset</Link> : null}
      </form>
      {result.entries.length === 0 ? (
        <EmptyState
          title={sp.q || kind || status !== "draft" ? "No items match these filters." : "No content yet."}
          description={sp.q || kind || status !== "draft" ? "Try clearing the search or choosing a different status." : "Create the first page, place, event or store for this site."}
          action={ctx.capabilities.canEdit && !sp.q ? <LinkButton href={`${base}/new`}>New item</LinkButton> : null}
        />
      ) : (
        <BulkSelectionForm action={archiveItemsAction} siteId={siteId} mode={status === "archived" ? "restore" : "archive"} canEdit={ctx.capabilities.canEdit} total={result.total}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
                {ctx.capabilities.canEdit ? <th scope="col" className="w-8 py-2"><span className="sr-only">Select</span></th> : null}
                <th scope="col" className="py-2">Title</th>
                <th scope="col" className="py-2">Type</th>
                <th scope="col" className="py-2">Working revision</th>
                <th scope="col" className="py-2">Review</th>
                <th scope="col" className="py-2">Published</th>
                <th scope="col" className="py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((e) => {
                const isPublished = Boolean(e.publishedRevisionId);
                const upToDate = e.publishedRevisionId === e.revision.id;
                return (
                  <tr key={e.item.id} className="border-b border-line align-top">
                    {ctx.capabilities.canEdit ? (
                      <td className="py-2"><input type="checkbox" name="itemId" value={e.item.id} aria-label={`Select ${e.revision.title}`} /></td>
                    ) : null}
                    <td className="py-2">
                      <Link href={`${base}/${e.item.id}`} className="font-medium text-ink hover:underline">{e.revision.title}</Link>
                      <p className="text-xs text-ink-subtle">/{e.revision.slug}{e.item.archivedAt ? " · archived" : ""}</p>
                    </td>
                    <td className="py-2">{kindRegistry[e.item.kind].label}</td>
                    <td className="py-2">v{e.revision.version}</td>
                    <td className="py-2">
                      <Badge tone={e.reviewState === "approved" ? "success" : e.reviewState === "submitted" ? "info" : e.reviewState === "changes_requested" ? "warning" : "neutral"}>
                        {e.reviewState.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {!isPublished ? <Badge tone="neutral">not published</Badge> : upToDate ? <Badge tone="success">live</Badge> : <Badge tone="warning">live · newer draft</Badge>}
                    </td>
                    <td className="py-2 whitespace-nowrap text-ink-muted">{formatDateTime(e.item.updatedAt, ctx.site.timeZone)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BulkSelectionForm>
      )}
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-action underline">Previous</Link> : <span className="text-ink-subtle">Previous</span>}
          <span>Page {page} of {pages} · {result.total} items</span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })} className="text-action underline">Next</Link> : <span className="text-ink-subtle">Next</span>}
        </nav>
      ) : (
        <p className="mt-3 text-xs text-ink-subtle">{result.total} item{result.total === 1 ? "" : "s"}</p>
      )}
    </>
  );
}
