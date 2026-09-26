import { z } from "zod";
import type { Db } from "@/server/data/db";
import { kindRegistry, type ContentKind } from "@/modules/registry";

export interface ContentItemRow {
  id: string;
  organizationId: string;
  siteId: string;
  kind: ContentKind;
  currentRevisionId: string | null;
  externalId: string | null;
  archivedAt: Date | null;
  archivedBy: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionRow {
  id: string;
  itemId: string;
  organizationId: string;
  siteId: string;
  version: number;
  schemaVersion: number;
  kind: ContentKind;
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  changeNote: string | null;
  baseRevisionId: string | null;
  authorId: string | null;
  createdAt: Date;
}

export class ContentValidationError extends Error {
  constructor(public readonly issues: Array<{ path: string; message: string }>) {
    super("Content validation failed");
    this.name = "ContentValidationError";
  }
}

/** Validates a payload against its kind's schema; returns the normalized payload. */
export function validatePayload(kind: ContentKind, payload: unknown): Record<string, unknown> & { title: string; slug: string } {
  const result = kindRegistry[kind].schema.safeParse(payload);
  if (!result.success) {
    throw new ContentValidationError(
      result.error.issues.map((i: z.core.$ZodIssue) => ({ path: i.path.map(String).join("."), message: i.message })),
    );
  }
  return result.data as Record<string, unknown> & { title: string; slug: string };
}

export async function createContentItem(
  db: Db,
  input: { siteId: string; organizationId: string; kind: ContentKind; payload: unknown; authorId: string; externalId?: string | null; changeNote?: string },
): Promise<{ item: ContentItemRow; revision: RevisionRow }> {
  const payload = validatePayload(input.kind, input.payload);
  const [item] = await db<ContentItemRow[]>`
    insert into public.content_items (organization_id, site_id, kind, external_id, created_by)
    values (${input.organizationId}, ${input.siteId}, ${input.kind}, ${input.externalId ?? null}, ${input.authorId})
    returning *`;
  if (!item) throw new Error("content item insert returned no row");
  const [revision] = await db<RevisionRow[]>`
    insert into public.content_revisions (item_id, organization_id, site_id, version, schema_version, kind, slug, title, payload, change_note, author_id)
    values (${item.id}, ${input.organizationId}, ${input.siteId}, 1, 1, ${input.kind}, ${payload.slug}, ${payload.title}, ${db.json(payload as never)}, ${input.changeNote ?? "Created"}, ${input.authorId})
    returning *`;
  if (!revision) throw new Error("revision insert returned no row");
  await db`update public.content_items set current_revision_id = ${revision.id} where id = ${item.id}`;
  return { item: { ...item, currentRevisionId: revision.id }, revision };
}

export type SaveResult = { ok: true; revision: RevisionRow } | { ok: false; conflict: true; latest: RevisionRow | null };

/**
 * Saves a new immutable revision and advances the working pointer with optimistic
 * concurrency. A stale base returns a conflict without writing anything.
 */
export async function saveRevision(
  db: Db,
  input: { itemId: string; baseRevisionId: string; payload: unknown; authorId: string; changeNote?: string },
): Promise<SaveResult> {
  const [item] = await db<ContentItemRow[]>`select * from public.content_items where id = ${input.itemId} for update`;
  if (!item) throw new Error("content item not found");
  if (item.currentRevisionId !== input.baseRevisionId) {
    const [latest] = await db<RevisionRow[]>`select * from public.content_revisions where id = ${item.currentRevisionId}`;
    return { ok: false, conflict: true, latest: latest ?? null };
  }
  const payload = validatePayload(item.kind, input.payload);
  const [base] = await db<{ version: number }[]>`select version from public.content_revisions where id = ${input.baseRevisionId}`;
  const nextVersion = (base?.version ?? 0) + 1;
  const [revision] = await db<RevisionRow[]>`
    insert into public.content_revisions (item_id, organization_id, site_id, version, schema_version, kind, slug, title, payload, change_note, base_revision_id, author_id)
    values (${item.id}, ${item.organizationId}, ${item.siteId}, ${nextVersion}, 1, ${item.kind}, ${payload.slug}, ${payload.title}, ${db.json(payload as never)}, ${input.changeNote ?? null}, ${input.baseRevisionId}, ${input.authorId})
    returning *`;
  if (!revision) throw new Error("revision insert returned no row");
  const updated = await db`
    update public.content_items set current_revision_id = ${revision.id}
    where id = ${item.id} and current_revision_id = ${input.baseRevisionId}`;
  if (updated.count !== 1) {
    throw Object.assign(new Error("concurrent update"), { code: "40001" });
  }
  return { ok: true, revision };
}

export interface ItemListEntry {
  item: ContentItemRow;
  revision: RevisionRow;
  publishedRevisionId: string | null;
  reviewState: "unsubmitted" | "submitted" | "changes_requested" | "approved";
}

export interface ListItemsInput {
  siteId: string;
  kind?: ContentKind;
  search?: string;
  status?: "all" | "draft" | "archived" | "published" | "unpublished";
  page?: number;
  pageSize?: number;
  sort?: "updated" | "title";
}

export async function listItems(db: Db, input: ListItemsInput): Promise<{ entries: ItemListEntry[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const search = input.search?.trim() ?? "";
  const status = input.status ?? "all";
  const orderBy = input.sort === "title" ? db`r.title asc` : db`i.updated_at desc`;
  const rows = await db<Array<ContentItemRow & { revision: RevisionRow; publishedRevisionId: string | null; reviewState: string; total: number }>>`
    with active as (
      select r.snapshot from public.sites s join public.releases r on r.id = s.active_release_id where s.id = ${input.siteId}
    )
    select i.*, row_to_json(r.*) as revision,
      (select a.snapshot #>> array['items', i.id::text, 'revisionId'] from active a) as published_revision_id,
      coalesce((select rv.state::text from public.reviews rv where rv.revision_id = r.id order by rv.created_at desc limit 1), 'unsubmitted') as review_state,
      count(*) over() as total
    from public.content_items i
    join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${input.siteId}
      ${input.kind ? db`and i.kind = ${input.kind}` : db``}
      ${search ? db`and (r.title ilike ${"%" + search + "%"} or r.slug ilike ${"%" + search + "%"})` : db``}
      ${status === "archived" ? db`and i.archived_at is not null` : status === "all" ? db`` : db`and i.archived_at is null`}
      ${status === "published" ? db`and exists (select 1 from active a where a.snapshot #> array['items', i.id::text] is not null)` : db``}
      ${status === "unpublished" ? db`and not exists (select 1 from active a where a.snapshot #>> array['items', i.id::text, 'revisionId'] = r.id::text)` : db``}
    order by ${orderBy}
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  const total = rows[0] ? Number(rows[0].total) : 0;
  const entries: ItemListEntry[] = rows.map((row) => {
    const { revision, publishedRevisionId, reviewState, total: _t, ...item } = row;
    const rev = normalizeRevisionJson(revision as unknown as Record<string, unknown>);
    const state = reviewState === "comment" ? "submitted" : (reviewState as ItemListEntry["reviewState"]);
    return { item: item as ContentItemRow, revision: rev, publishedRevisionId, reviewState: state };
  });
  return { entries, total, page, pageSize };
}

/** row_to_json yields snake_case keys and ISO strings; normalize to RevisionRow. */
export function normalizeRevisionJson(json: Record<string, unknown>): RevisionRow {
  return {
    id: json.id as string,
    itemId: json.item_id as string,
    organizationId: json.organization_id as string,
    siteId: json.site_id as string,
    version: json.version as number,
    schemaVersion: json.schema_version as number,
    kind: json.kind as ContentKind,
    slug: json.slug as string,
    title: json.title as string,
    payload: json.payload as Record<string, unknown>,
    changeNote: (json.change_note as string | null) ?? null,
    baseRevisionId: (json.base_revision_id as string | null) ?? null,
    authorId: (json.author_id as string | null) ?? null,
    createdAt: new Date(json.created_at as string),
  };
}

export async function getItem(db: Db, itemId: string): Promise<{ item: ContentItemRow; revision: RevisionRow } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return null;
  const [item] = await db<ContentItemRow[]>`select * from public.content_items where id = ${itemId}`;
  if (!item || !item.currentRevisionId) return null;
  const [revision] = await db<RevisionRow[]>`select * from public.content_revisions where id = ${item.currentRevisionId}`;
  if (!revision) return null;
  return { item, revision };
}

export async function getRevision(db: Db, revisionId: string): Promise<RevisionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(revisionId)) return null;
  const [revision] = await db<RevisionRow[]>`select * from public.content_revisions where id = ${revisionId}`;
  return revision ?? null;
}

export async function listRevisions(db: Db, itemId: string, limit = 50): Promise<RevisionRow[]> {
  return db<RevisionRow[]>`select * from public.content_revisions where item_id = ${itemId} order by version desc limit ${limit}`;
}

export async function setArchived(db: Db, itemId: string, archived: boolean, userId: string): Promise<void> {
  await db`update public.content_items
    set archived_at = ${archived ? new Date() : null}, archived_by = ${archived ? userId : null}
    where id = ${itemId}`;
}

/** Slugs in use by other non-archived items of the same route namespace (for save-time warnings). */
export async function findSlugCollision(db: Db, siteId: string, kind: ContentKind, slug: string, excludeItemId: string | null): Promise<{ itemId: string; title: string } | null> {
  const rows = await db<{ itemId: string; title: string }[]>`
    select i.id as item_id, r.title
    from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${siteId} and i.kind = ${kind} and r.slug = ${slug} and i.archived_at is null
      ${excludeItemId ? db`and i.id <> ${excludeItemId}` : db``}
    limit 1`;
  return rows[0] ?? null;
}
