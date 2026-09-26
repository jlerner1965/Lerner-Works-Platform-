import type { Db } from "@/server/data/db";
import { kindRegistry, moduleIndexRoutes, routeFor, type ContentKind } from "@/modules/registry";
import { siteConfigSchema, type SiteConfig } from "@/modules/site-config";
import { collectImageAssetIds, type Block } from "@/lib/richtext";
import type { RevisionRow } from "@/server/data/content";
import type { SiteRow } from "@/server/data/access";
import {
  SNAPSHOT_SCHEMA_VERSION,
  type ReleaseSnapshot,
  type SnapshotItem,
  type SnapshotMedia,
  type SnapshotRedirect,
  type SnapshotRoute,
} from "@/server/publishing/snapshot";

export interface Selection {
  configRevisionId: string;
  /** itemId -> revisionId to publish. Items absent from the map are not published. */
  items: Record<string, string>;
}

export interface SelectionNote {
  itemId: string;
  title: string;
  kind: ContentKind;
  note: "unapproved_newer_draft" | "excluded_unapproved" | "archived_removed" | "included_approved" | "unchanged";
  latestRevisionId?: string;
  reviewState?: string;
}

export interface MediaAssetRow {
  id: string;
  siteId: string;
  organizationId: string;
  status: "processing" | "ready" | "withdrawn";
  originalKey: string;
  mimeType: string;
  sha256: string;
  width: number;
  height: number;
  byteSize: number;
  title: string | null;
  altText: string | null;
  decorative: boolean;
  attributionText: string | null;
  license: string | null;
  derivatives: Record<string, { key: string; path: string; width: number; height: number; bytes: number; hash: string }>;
}

export interface BuiltManifest {
  manifest: ReleaseSnapshot;
  notes: SelectionNote[];
  mediaRows: Map<string, MediaAssetRow>;
  missingMedia: Array<{ assetId: string; itemId: string | null; field: string }>;
}

/** Review state of a revision = latest review decision on that exact revision. */
async function reviewStates(db: Db, revisionIds: string[]): Promise<Map<string, string>> {
  if (revisionIds.length === 0) return new Map();
  const rows = await db<{ revisionId: string; state: string }[]>`
    select distinct on (revision_id) revision_id, state::text
    from public.reviews where revision_id = any(${revisionIds})
    order by revision_id, created_at desc`;
  return new Map(rows.map((r) => [r.revisionId, r.state]));
}

/**
 * Default selection: the latest revision of each item when it is approved; otherwise the
 * revision already published (if any). Archived items are removed. Unapproved new items are
 * excluded. Never lets an unapproved revision replace an approved one silently.
 */
export async function resolveDefaultSelection(db: Db, siteId: string, base: ReleaseSnapshot | null, configRevisionId: string): Promise<{ selection: Selection; notes: SelectionNote[] }> {
  const items = await db<Array<{ id: string; kind: ContentKind; archivedAt: Date | null; revisionId: string; title: string }>>`
    select i.id, i.kind, i.archived_at, r.id as revision_id, r.title
    from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${siteId}
    order by i.created_at`;
  const states = await reviewStates(
    db,
    items.map((i) => i.revisionId),
  );
  const selection: Selection = { configRevisionId, items: {} };
  const notes: SelectionNote[] = [];
  for (const it of items) {
    const published = base?.items[it.id];
    if (it.archivedAt) {
      if (published) notes.push({ itemId: it.id, title: it.title, kind: it.kind, note: "archived_removed" });
      continue;
    }
    const state = states.get(it.revisionId) ?? "unsubmitted";
    if (state === "approved") {
      selection.items[it.id] = it.revisionId;
      notes.push({ itemId: it.id, title: it.title, kind: it.kind, note: published?.revisionId === it.revisionId ? "unchanged" : "included_approved", reviewState: state });
    } else if (published) {
      selection.items[it.id] = published.revisionId;
      if (published.revisionId !== it.revisionId) {
        notes.push({ itemId: it.id, title: it.title, kind: it.kind, note: "unapproved_newer_draft", latestRevisionId: it.revisionId, reviewState: state });
      } else {
        notes.push({ itemId: it.id, title: it.title, kind: it.kind, note: "unchanged", reviewState: state });
      }
    } else {
      notes.push({ itemId: it.id, title: it.title, kind: it.kind, note: "excluded_unapproved", latestRevisionId: it.revisionId, reviewState: state });
    }
  }
  return { selection, notes };
}

function collectAssetRefs(kind: ContentKind, payload: Record<string, unknown>): Array<{ assetId: string; field: string }> {
  const refs: Array<{ assetId: string; field: string }> = [];
  const featured = payload.featuredImageAssetId;
  if (typeof featured === "string") refs.push({ assetId: featured, field: "featuredImageAssetId" });
  const body = payload.body as Block[] | undefined;
  if (Array.isArray(body)) for (const id of collectImageAssetIds(body)) refs.push({ assetId: id, field: "body" });
  if (kind === "page") {
    const sections = (payload.sections as Array<Record<string, unknown>> | undefined) ?? [];
    sections.forEach((s, i) => {
      if (s.type === "image_hero" && typeof s.imageAssetId === "string") refs.push({ assetId: s.imageAssetId, field: `sections.${i}.imageAssetId` });
      if (s.type === "rich_text" && Array.isArray(s.body)) for (const id of collectImageAssetIds(s.body as Block[])) refs.push({ assetId: id, field: `sections.${i}.body` });
    });
  }
  return refs;
}

export function toSnapshotMedia(row: MediaAssetRow): SnapshotMedia {
  const variants: SnapshotMedia["variants"] = {};
  for (const k of ["w480", "w960", "w1600"] as const) {
    const d = row.derivatives[k];
    if (d) variants[k] = { key: d.key, path: d.path, width: d.width, height: d.height, bytes: d.bytes, hash: d.hash };
  }
  return {
    id: row.id,
    hash: row.sha256,
    width: row.width,
    height: row.height,
    alt: row.altText ?? "",
    decorative: row.decorative,
    title: row.title ?? "",
    attribution: row.attributionText ?? "",
    license: row.license ?? "",
    variants,
  };
}

/** Builds a complete frozen manifest for a site from a selection. Reads nothing mutable afterwards. */
export async function buildManifest(db: Db, site: SiteRow, selection: Selection, base: ReleaseSnapshot | null, notes: SelectionNote[]): Promise<BuiltManifest> {
  const configRows = await db<{ id: string; config: unknown }[]>`select id, config from public.site_config_revisions where id = ${selection.configRevisionId} and site_id = ${site.id}`;
  const configRow = configRows[0];
  if (!configRow) throw new Error("configuration revision not found for this site");
  const config: SiteConfig = siteConfigSchema.parse(configRow.config);

  const revisionIds = Object.values(selection.items);
  const revisions = revisionIds.length
    ? await db<RevisionRow[]>`select r.* from public.content_revisions r
        join public.content_items i on i.id = r.item_id
        where r.id = any(${revisionIds}) and r.site_id = ${site.id} and i.site_id = ${site.id}`
    : [];
  const byId = new Map(revisions.map((r) => [r.id, r]));

  const items: Record<string, SnapshotItem> = {};
  const assetRefs: Array<{ assetId: string; itemId: string | null; field: string }> = [];
  for (const [itemId, revisionId] of Object.entries(selection.items)) {
    const rev = byId.get(revisionId);
    if (!rev || rev.itemId !== itemId) throw new Error(`selected revision ${revisionId} does not belong to item ${itemId} in this site`);
    const parsed = kindRegistry[rev.kind].schema.safeParse(rev.payload);
    const payload = (parsed.success ? parsed.data : rev.payload) as Record<string, unknown>;
    items[itemId] = { id: itemId, kind: rev.kind, slug: rev.slug, title: rev.title, revisionId: rev.id, revisionVersion: rev.version, payload };
    for (const ref of collectAssetRefs(rev.kind, payload)) assetRefs.push({ ...ref, itemId });
  }
  if (config.branding.logoAssetId) assetRefs.push({ assetId: config.branding.logoAssetId, itemId: null, field: "branding.logoAssetId" });

  // Routes: pages, enabled module indexes, items of enabled modules, and search.
  const routes: SnapshotRoute[] = [];
  const enabledKinds = new Set<ContentKind>(["page"]);
  for (const kind of Object.keys(kindRegistry) as ContentKind[]) {
    const mod = kindRegistry[kind].module;
    if (mod && config.modules[mod]) enabledKinds.add(kind);
  }
  for (const idx of moduleIndexRoutes) {
    if (config.modules[idx.module]) routes.push({ path: idx.path, kind: "index", module: idx.module });
  }
  routes.push({ path: "/search", kind: "search" });
  for (const item of Object.values(items)) {
    if (!enabledKinds.has(item.kind)) continue;
    routes.push({ path: routeFor(item.kind, item.slug), kind: item.kind, itemId: item.id });
  }

  // Redirects: slug changes since the base release, plus carried-forward redirects.
  const currentPaths = new Map(routes.filter((r) => r.itemId).map((r) => [r.itemId!, r.path]));
  const redirects: SnapshotRedirect[] = [];
  if (base) {
    for (const oldRoute of base.routes) {
      if (!oldRoute.itemId) continue;
      const newPath = currentPaths.get(oldRoute.itemId);
      if (newPath && newPath !== oldRoute.path) redirects.push({ from: oldRoute.path, to: newPath });
    }
    for (const old of base.redirects) {
      const chained = redirects.find((r) => r.from === old.to);
      const to = chained ? chained.to : old.to;
      if (routes.some((r) => r.path === old.from)) continue; // path is a live route again
      if (!routes.some((r) => r.path === to)) continue; // target no longer exists
      if (!redirects.some((r) => r.from === old.from)) redirects.push({ from: old.from, to });
    }
  }

  // Media: only ready assets that belong to this site.
  const assetIds = [...new Set(assetRefs.map((r) => r.assetId))];
  const mediaRowsList = assetIds.length
    ? await db<MediaAssetRow[]>`select * from public.media_assets where id = any(${assetIds}) and site_id = ${site.id}`
    : [];
  const mediaRows = new Map(mediaRowsList.map((m) => [m.id, m]));
  const media: Record<string, SnapshotMedia> = {};
  const missingMedia: BuiltManifest["missingMedia"] = [];
  for (const ref of assetRefs) {
    const row = mediaRows.get(ref.assetId);
    if (!row || row.status !== "ready") {
      missingMedia.push(ref);
      continue;
    }
    media[row.id] = toSnapshotMedia(row);
  }

  const manifest: ReleaseSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    site: {
      id: site.id,
      key: site.key,
      name: site.name,
      preset: site.preset,
      timeZone: site.timeZone,
      mode: site.mode,
      contact: { email: site.contactEmail ?? "", phone: site.contactPhone ?? "", address: site.contactAddress ?? "" },
    },
    configRevisionId: selection.configRevisionId,
    config,
    items,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    redirects: redirects.sort((a, b) => a.from.localeCompare(b.from)),
    media,
  };
  return { manifest, notes, mediaRows, missingMedia };
}
