import type { RenderContext } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { PageSection } from "@/modules/page";
import type { ContentKind } from "@/modules/registry";
import { isUpcomingOrInProgress } from "@/lib/events";

type CollectionSection = Extract<PageSection, { type: "content_collection" }> | Extract<PageSection, { type: "location_collection" }>;

/** Items for a collection section, restricted to the frozen snapshot of the same site. */
export function resolveCollection(ctx: RenderContext, section: CollectionSection): SnapshotItem[] {
  const kind: ContentKind = section.type === "location_collection" ? "store" : section.kind;
  const all = Object.values(ctx.snapshot.items).filter((i) => i.kind === kind);
  const routed = new Set(ctx.snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  const published = all.filter((i) => routed.has(i.id));
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

export function itemPath(ctx: RenderContext, item: SnapshotItem): string | null {
  return ctx.snapshot.routes.find((r) => r.itemId === item.id)?.path ?? null;
}

export function featuredImage(ctx: RenderContext, item: SnapshotItem) {
  const id = item.payload.featuredImageAssetId;
  return typeof id === "string" ? (ctx.snapshot.media[id] ?? null) : null;
}
