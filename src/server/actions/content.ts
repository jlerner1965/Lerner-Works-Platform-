"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { createContentItem, saveRevision, getItem, setArchived, findSlugCollision, ContentValidationError, validatePayload, type RevisionRow } from "@/server/data/content";
import { isContentKind, kindRegistry, type ContentKind } from "@/modules/registry";
import { presets } from "@/modules/presets";
import { slugify } from "@/lib/slug";

const uuid = z.uuid();

export interface SaveState {
  status: "idle" | "saved" | "conflict" | "invalid" | "error";
  revisionId?: string;
  version?: number;
  savedAt?: string;
  message?: string;
  issues?: Array<{ path: string; message: string }>;
  latest?: { revisionId: string; version: number; createdAt: string; authorEmail?: string; payload: Record<string, unknown> };
}

function serializeRevision(r: RevisionRow): NonNullable<SaveState["latest"]> {
  return { revisionId: r.id, version: r.version, createdAt: r.createdAt.toISOString(), payload: r.payload };
}

/** Saves a new revision with optimistic concurrency. Called directly from the editor. */
export async function saveItemAction(input: { itemId: string; baseRevisionId: string; payload: unknown; changeNote?: string }): Promise<SaveState> {
  const user = await requireUser();
  const itemId = uuid.safeParse(input.itemId);
  const baseId = uuid.safeParse(input.baseRevisionId);
  if (!itemId.success || !baseId.success) return { status: "error", message: "Invalid identifiers." };
  try {
    return await withUser(user.id, async (db) => {
      const current = await getItem(db, itemId.data);
      if (!current) return { status: "error", message: "This item is not available to you." };
      const ctx = await loadSiteContext(db, current.item.siteId);
      if (!ctx?.capabilities.canEdit) return { status: "error", message: "You do not have edit access to this site." };
      let payload: ReturnType<typeof validatePayload>;
      try {
        payload = validatePayload(current.item.kind, input.payload);
      } catch (err) {
        if (err instanceof ContentValidationError) return { status: "invalid", issues: err.issues, message: "Some fields need attention." };
        throw err;
      }
      const collision = await findSlugCollision(db, current.item.siteId, current.item.kind, payload.slug, current.item.id);
      if (collision) return { status: "invalid", issues: [{ path: "slug", message: `The slug "${payload.slug}" is already used by "${collision.title}".` }], message: "Some fields need attention." };
      const result = await saveRevision(db, { itemId: itemId.data, baseRevisionId: baseId.data, payload, authorId: user.id, changeNote: input.changeNote?.slice(0, 300) });
      if (!result.ok) {
        return { status: "conflict", message: "Someone saved a newer version while you were editing. Your input is kept below for comparison.", latest: result.latest ? serializeRevision(result.latest) : undefined };
      }
      revalidatePath(`/app/sites/${current.item.siteId}/content`);
      return { status: "saved", revisionId: result.revision.id, version: result.revision.version, savedAt: result.revision.createdAt.toISOString() };
    });
  } catch (err) {
    const d = describeDbError(err);
    return { status: "error", message: d.code === "forbidden" ? "You do not have permission to save this item." : "Save failed. Nothing was stored; you can retry." };
  }
}

export interface CreateItemState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createItemAction(_prev: CreateItemState, formData: FormData): Promise<CreateItemState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  if (!uuid.safeParse(siteId).success || !isContentKind(kind)) return { error: "Invalid request." };
  if (!title) return { fieldErrors: { title: "Enter a title." } };
  const slug = slugInput ? slugify(slugInput) : slugify(title);
  if (!slug) return { fieldErrors: { slug: "Enter a slug using letters, numbers and hyphens." } };
  let newId: string | null = null;
  try {
    const result = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canEdit) return { error: "You do not have edit access to this site." };
      if (!presets[ctx.site.preset].kinds.includes(kind as ContentKind)) return { error: `${kindRegistry[kind as ContentKind].plural} are not part of this site's preset.` };
      const collision = await findSlugCollision(db, siteId, kind as ContentKind, slug, null);
      if (collision) return { fieldErrors: { slug: `The slug "${slug}" is already used by "${collision.title}".` } };
      const payload = defaultPayload(kind as ContentKind, title, slug, ctx.site.timeZone);
      const { item } = await createContentItem(db, { siteId, organizationId: ctx.site.organizationId, kind: kind as ContentKind, payload, authorId: user.id });
      newId = item.id;
      return {};
    });
    if (result.error || result.fieldErrors) return result;
  } catch (err) {
    if (err instanceof ContentValidationError) return { error: err.issues.map((i) => `${i.path}: ${i.message}`).join("; ") };
    return { error: describeDbError(err).message };
  }
  redirect(`/app/sites/${siteId}/content/${newId}`);
}

function defaultPayload(kind: ContentKind, title: string, slug: string, timeZone: string): Record<string, unknown> {
  const base = { schemaVersion: 1, title, slug, summary: "", body: [], featuredImageAssetId: null, metaTitle: "", metaDescription: "", indexable: true, sourceUrl: "", lastVerifiedOn: "", attribution: "" };
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7, 18, 0));
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  switch (kind) {
    case "page":
      return { ...base, sections: [{ id: `s-${Date.now().toString(36)}`, type: "rich_text", heading: title, body: [] }] };
    case "place":
      return { ...base, category: "Uncategorized", address: { line1: "", line2: "", locality: "", region: "", postalCode: "", approved: false }, areaDescription: "", website: "", phone: "", hours: null, nextAction: { label: "", path: "" } };
    case "event":
      return { ...base, startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone, venueItemId: null, venueText: "", organizerName: "", organizerUrl: "", status: "scheduled", eventUrl: "", admission: "" };
    case "article":
      return { ...base, authorName: "", publishedOn: now.toISOString().slice(0, 10), updatedOn: "" };
    case "store":
      return { ...base, address: { line1: "", line2: "", locality: "", region: "", postalCode: "", approved: false }, phone: "", timeZone, weeklyHours: null, exceptions: [], serviceItemIds: [], status: "open", statusNote: "" };
    case "service":
      return { ...base, inquiryPrompt: "" };
  }
}

export async function archiveItemsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const archive = String(formData.get("mode") ?? "archive") === "archive";
  const ids = formData.getAll("itemId").map(String).filter((id) => uuid.safeParse(id).success);
  if (!uuid.safeParse(siteId).success || ids.length === 0) redirect(`/app/sites/${siteId}/content?notice=nothing-selected`);
  await withUser(user.id, async (db) => {
    const ctx = await loadSiteContext(db, siteId);
    if (!ctx?.capabilities.canEdit) return;
    for (const id of ids) {
      const item = await getItem(db, id);
      if (item && item.item.siteId === siteId) await setArchived(db, id, archive, user.id);
    }
  });
  revalidatePath(`/app/sites/${siteId}/content`);
  redirect(`/app/sites/${siteId}/content?notice=${archive ? "archived" : "restored"}&count=${ids.length}`);
}

export interface ReviewActionState {
  message?: string;
  error?: string;
}

/** Review decisions are immutable rows tied to an exact revision. */
export async function reviewAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const user = await requireUser();
  const revisionId = String(formData.get("revisionId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const state = String(formData.get("state") ?? "");
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 4000);
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!uuid.safeParse(revisionId).success || !uuid.safeParse(itemId).success) return { error: "Invalid request." };
  if (!["submitted", "comment", "changes_requested", "approved"].includes(state)) return { error: "Invalid review state." };
  if ((state === "changes_requested" || state === "comment") && !comment) return { error: "Add a comment explaining what should change." };
  try {
    const result = await withUser(user.id, async (db) => {
      const current = await getItem(db, itemId);
      if (!current) return { error: "Item not found." };
      const ctx = await loadSiteContext(db, current.item.siteId);
      if (!ctx) return { error: "Site not found." };
      const cap = ctx.capabilities;
      if (state === "approved" && !cap.canPublish) return { error: "Only publishers and owners can approve." };
      if (state === "changes_requested" && !cap.canReview) return { error: "Only reviewers, publishers and owners can request changes." };
      if (state === "submitted" && !cap.canEdit) return { error: "Only editors can submit for review." };
      const [rev] = await db<{ id: string; itemId: string; authorId: string | null }[]>`select id, item_id, author_id from public.content_revisions where id = ${revisionId}`;
      if (!rev || rev.itemId !== itemId) return { error: "Revision not found." };
      if (state === "approved" && current.item.currentRevisionId !== revisionId) return { error: "Only the latest revision can be approved. Reload to see the newest version." };
      await db`insert into public.reviews (organization_id, site_id, item_id, revision_id, state, comment, actor_id)
        values (${current.item.organizationId}, ${current.item.siteId}, ${itemId}, ${revisionId}, ${state}, ${comment || null}, ${user.id})`;
      if (state === "approved" && rev.authorId === user.id) {
        await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
          values (${current.item.organizationId}, ${current.item.siteId}, ${user.id}, 'review.self_approved', 'content_revision', ${revisionId}, ${db.json({ itemId })})`;
      }
      revalidatePath(`/app/sites/${current.item.siteId}/content/${itemId}`);
      revalidatePath(`/app/sites/${current.item.siteId}/reviews`);
      return { message: state === "submitted" ? "Submitted for review." : state === "approved" ? "Revision approved." : state === "changes_requested" ? "Changes requested." : "Comment added." };
    });
    if (returnTo && /^\/app\//.test(returnTo) && !result.error) redirect(returnTo);
    return result;
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    return { error: describeDbError(err).code === "forbidden" ? "You do not have permission for this review action." : describeDbError(err).message };
  }
}
