import type { Db } from "@/server/data/db";
import { kindRegistry, moduleIndexRoutes, routeFor, type ContentKind } from "@/modules/registry";
import { siteConfigSchema, type SiteConfig } from "@/modules/site-config";
import { collectDocumentAssetIds, collectImageAssetIds, type Block } from "@/lib/richtext";
import { documentLinkId, type MediaKind } from "@/server/media/content-types";
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
  /** A picture with WebP derivatives, or a document served as uploaded (B5-1). */
  kind: MediaKind;
  status: "processing" | "ready" | "withdrawn";
  originalKey: string;
  mimeType: string;
  sha256: string;
  /** Pixel dimensions of a picture; null for a document. */
  width: number | null;
  height: number | null;
  byteSize: number;
  title: string | null;
  altText: string | null;
  decorative: boolean;
  attributionText: string | null;
  license: string | null;
  derivatives: Record<string, { key: string; path: string; width: number; height: number; bytes: number; hash: string }>;
  /** Focal point 0–1; `numeric` columns arrive as strings from the driver. null = centre. */
  focalX?: number | string | null;
  focalY?: number | string | null;
}

/** Parses a focal coordinate as stored (numeric string or number) into a number inside 0–1, or null. */
function focalCoordinate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

export interface BuiltManifest {
  manifest: ReleaseSnapshot;
  notes: SelectionNote[];
  mediaRows: Map<string, MediaAssetRow>;
  missingMedia: Array<{ assetId: string; itemId: string | null; field: string }>;
  /** References that name a picture where a document is expected or the reverse (B5); absent in a manifest built from frozen media alone. */
  mediaKindMismatches?: Array<{ assetId: string; itemId: string | null; field: string; expected: MediaKind; actual: MediaKind }>;
}

export interface AssetRef {
  assetId: string;
  field: string;
  /** What the field expects; a reference of the other kind blocks publication. */
  kind: MediaKind;
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

/**
 * Every media asset a payload refers to, with the field that refers to it and the kind the field
 * expects (missing ones become `missing_media` blockers, wrong kinds `media_kind_mismatch`).
 * Documents (B5) are referenced from link targets (`document:<id>` in bodies, buttons and
 * list-item links), from `attachments` and from the downloads section.
 */
export function collectAssetRefs(kind: ContentKind, payload: Record<string, unknown>): AssetRef[] {
  const refs: AssetRef[] = [];
  const image = (assetId: string, field: string) => refs.push({ assetId, field, kind: "image" });
  const document = (assetId: string, field: string) => refs.push({ assetId, field, kind: "document" });
  const scanBody = (blocks: Block[], field: string) => {
    for (const id of collectImageAssetIds(blocks)) image(id, field);
    for (const id of collectDocumentAssetIds(blocks)) document(id, field);
  };
  const scanLink = (value: unknown, field: string) => {
    const id = typeof value === "string" ? documentLinkId(value) : null;
    if (id) document(id, field);
  };
  const featured = payload.featuredImageAssetId;
  if (typeof featured === "string") image(featured, "featuredImageAssetId");
  const body = payload.body as Block[] | undefined;
  if (Array.isArray(body)) scanBody(body, "body");
  ((payload.attachments as Array<{ assetId?: unknown }> | undefined) ?? []).forEach((a, j) => {
    if (typeof a.assetId === "string" && a.assetId) document(a.assetId, `attachments.${j}.assetId`);
  });
  if (kind === "page") {
    const sections = (payload.sections as Array<Record<string, unknown>> | undefined) ?? [];
    sections.forEach((s, i) => {
      if ((s.type === "image_hero" || s.type === "image_band") && typeof s.imageAssetId === "string") image(s.imageAssetId, `sections.${i}.imageAssetId`);
      if (s.type === "image_hero" && Array.isArray(s.extraImageAssetIds)) {
        (s.extraImageAssetIds as unknown[]).forEach((id, j) => {
          if (typeof id === "string" && id) image(id, `sections.${i}.extraImageAssetIds.${j}`);
        });
      }
      if (s.type === "rich_text" && Array.isArray(s.body)) scanBody(s.body as Block[], `sections.${i}.body`);
      if (s.type === "video" && typeof s.posterAssetId === "string") image(s.posterAssetId, `sections.${i}.posterAssetId`);
      scanLink(s.ctaPath, `sections.${i}.ctaPath`);
      scanLink(s.secondaryPath, `sections.${i}.secondaryPath`);
      // Item lists whose entries carry a picture: gallery images, logos, portraits (quotes, team) and image rows.
      if (s.type === "gallery" || s.type === "logo_strip" || s.type === "quotes" || s.type === "team" || s.type === "image_text") {
        ((s.items as Array<{ assetId?: string | null; body?: Block[]; path?: unknown; ctaPath?: unknown }>) ?? []).forEach((it, j) => {
          if (typeof it.assetId === "string" && it.assetId) image(it.assetId, `sections.${i}.items.${j}.assetId`);
          if (Array.isArray(it.body)) scanBody(it.body, `sections.${i}.items.${j}.body`);
          scanLink(it.path, `sections.${i}.items.${j}.path`);
          scanLink(it.ctaPath, `sections.${i}.items.${j}.ctaPath`);
        });
      }
      if (s.type === "downloads") {
        ((s.items as Array<{ assetId?: unknown }>) ?? []).forEach((it, j) => {
          if (typeof it.assetId === "string" && it.assetId) document(it.assetId, `sections.${i}.items.${j}.assetId`);
        });
      }
      if (s.type === "faq") {
        ((s.items as Array<{ answer?: Block[] }>) ?? []).forEach((it, j) => {
          if (Array.isArray(it.answer)) scanBody(it.answer, `sections.${i}.items.${j}.answer`);
        });
      }
    });
  }
  return refs;
}

export function toSnapshotMedia(row: MediaAssetRow): SnapshotMedia {
  const variants: SnapshotMedia["variants"] = {};
  for (const k of ["w480", "w960", "w1600", "file"] as const) {
    const d = row.derivatives[k];
    if (d) variants[k] = { key: d.key, path: d.path, width: d.width, height: d.height, bytes: d.bytes, hash: d.hash };
  }
  const focalX = focalCoordinate(row.focalX);
  const focalY = focalCoordinate(row.focalY);
  return {
    id: row.id,
    hash: row.sha256,
    width: row.width ?? 0,
    height: row.height ?? 0,
    alt: row.altText ?? "",
    decorative: row.decorative,
    title: row.title ?? "",
    attribution: row.attributionText ?? "",
    license: row.license ?? "",
    variants,
    ...(focalX !== null && focalY !== null ? { focal: { x: focalX, y: focalY } } : {}),
    // Pictures keep the shape every earlier release has; only documents say what they are.
    ...(row.kind === "document" ? { kind: "document" as const, mime: row.mimeType } : {}),
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
  const assetRefs: Array<AssetRef & { itemId: string | null }> = [];
  for (const [itemId, revisionId] of Object.entries(selection.items)) {
    const rev = byId.get(revisionId);
    if (!rev || rev.itemId !== itemId) throw new Error(`selected revision ${revisionId} does not belong to item ${itemId} in this site`);
    const parsed = kindRegistry[rev.kind].schema.safeParse(rev.payload);
    const payload = (parsed.success ? parsed.data : rev.payload) as Record<string, unknown>;
    items[itemId] = { id: itemId, kind: rev.kind, slug: rev.slug, title: rev.title, revisionId: rev.id, revisionVersion: rev.version, payload };
    for (const ref of collectAssetRefs(rev.kind, payload)) assetRefs.push({ ...ref, itemId });
  }
  if (config.branding.logoAssetId) assetRefs.push({ assetId: config.branding.logoAssetId, itemId: null, field: "branding.logoAssetId", kind: "image" });
  if (config.branding.logoDarkAssetId) assetRefs.push({ assetId: config.branding.logoDarkAssetId, itemId: null, field: "branding.logoDarkAssetId", kind: "image" });
  if (config.metadata.faviconAssetId) assetRefs.push({ assetId: config.metadata.faviconAssetId, itemId: null, field: "metadata.faviconAssetId", kind: "image" });
  if (config.metadata.shareImageAssetId) assetRefs.push({ assetId: config.metadata.shareImageAssetId, itemId: null, field: "metadata.shareImageAssetId", kind: "image" });

  // Routes: pages, enabled module indexes, items of enabled modules, and search.
  const routes: SnapshotRoute[] = [];
  const enabledKinds = new Set<ContentKind>(["page"]);
  for (const kind of Object.keys(kindRegistry) as ContentKind[]) {
    const mod = kindRegistry[kind].module;
    if (mod && config.modules[mod]) enabledKinds.add(kind);
  }
  for (const idx of moduleIndexRoutes) {
    if (!config.modules[idx.module]) continue;
    // The listing of outside links (B5-2) is left out until there is a link to list (D-021 applied to a listing page).
    if (idx.module === "links" && !Object.values(items).some((i) => i.kind === "link")) continue;
    routes.push({ path: idx.path, kind: "index", module: idx.module });
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
  const mediaKindMismatches: BuiltManifest["mediaKindMismatches"] = [];
  for (const ref of assetRefs) {
    const row = mediaRows.get(ref.assetId);
    if (!row || row.status !== "ready") {
      missingMedia.push({ assetId: ref.assetId, itemId: ref.itemId, field: ref.field });
      continue;
    }
    if ((row.kind ?? "image") !== ref.kind) {
      mediaKindMismatches.push({ assetId: ref.assetId, itemId: ref.itemId, field: ref.field, expected: ref.kind, actual: row.kind ?? "image" });
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
  return { manifest, notes, mediaRows, missingMedia, mediaKindMismatches };
}
