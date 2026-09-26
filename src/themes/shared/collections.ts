import type { RenderContext } from "@/themes/shared/types";
import type { ReleaseSnapshot, SnapshotItem } from "@/server/publishing/snapshot";
import type { PageSection } from "@/modules/page";
import type { ContentKind } from "@/modules/registry";
import { isUpcomingOrInProgress } from "@/lib/events";

type CollectionSection = Extract<PageSection, { type: "content_collection" }> | Extract<PageSection, { type: "location_collection" }>;
/** What collection resolution needs: the frozen snapshot and the clock (a render context, or the validator's manifest and time). */
export type CollectionScope = Pick<RenderContext, "snapshot" | "now">;

/** Published items of a kind: those of the snapshot that have a route (archived or unpublished items have none). */
export function publishedItems(snapshot: ReleaseSnapshot, kind: ContentKind): SnapshotItem[] {
  const routed = new Set(snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  return Object.values(snapshot.items).filter((i) => i.kind === kind && routed.has(i.id));
}

/** Items for a collection section, restricted to the frozen snapshot of the same site. */
export function resolveCollection(ctx: CollectionScope, section: CollectionSection): SnapshotItem[] {
  const kind: ContentKind = section.type === "location_collection" ? "store" : section.kind;
  const published = publishedItems(ctx.snapshot, kind);
  if (section.mode === "selected") {
    return section.itemIds.map((id) => published.find((i) => i.id === id)).filter((i): i is SnapshotItem => Boolean(i));
  }
  if (section.type === "location_collection") {
    return published.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (section.mode === "upcoming" && kind === "event") {
    return published
      .filter((i) => isUpcomingOrInProgress(String(i.payload.startsAt), String(i.payload.endsAt), ctx.now) && i.payload.status !== "cancelled")
      .sort((a, b) => Date.parse(String(a.payload.startsAt)) - Date.parse(String(b.payload.startsAt)))
      .slice(0, section.limit);
  }
  // latest: articles by publication date desc, others by title.
  const sorted = kind === "article"
    ? published.sort((a, b) => String(b.payload.publishedOn).localeCompare(String(a.payload.publishedOn)))
    : kind === "event"
      ? published.sort((a, b) => Date.parse(String(a.payload.startsAt)) - Date.parse(String(b.payload.startsAt)))
      : published.sort((a, b) => a.title.localeCompare(b.title));
  return sorted.slice(0, section.limit);
}

export interface CategoryEntry {
  name: string;
  count: number;
  /** Site-relative path of the directory filtered to this category. */
  path: string;
}

/**
 * The categories of the published places, largest first (ties alphabetical), each linking to
 * the directory filtered by it. Nothing is invented: a category exists only because a
 * published place carries it.
 */
export function resolveCategories(ctx: Pick<RenderContext, "snapshot">, section: Extract<PageSection, { type: "category_list" }>): CategoryEntry[] {
  const counts = new Map<string, number>();
  for (const place of publishedItems(ctx.snapshot, "place")) {
    const name = String(place.payload.category ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, path: `/places?category=${encodeURIComponent(name)}` }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, section.limit);
}

export function itemPath(ctx: RenderContext, item: SnapshotItem): string | null {
  return ctx.snapshot.routes.find((r) => r.itemId === item.id)?.path ?? null;
}

export function featuredImage(ctx: RenderContext, item: SnapshotItem) {
  const id = item.payload.featuredImageAssetId;
  return typeof id === "string" ? (ctx.snapshot.media[id] ?? null) : null;
}
