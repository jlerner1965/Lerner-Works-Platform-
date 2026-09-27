import { kindRegistry, type ContentKind } from "@/modules/registry";
import { siteConfigSchema, type SiteConfig, type ModuleKey } from "@/modules/site-config";
import type { PresetKey } from "@/modules/presets";

/**
 * Snapshot schema versions:
 * 1 — initial release format.
 * 2 — configuration gained `navigation.showSearch`, `footer.variant`, `indexes`,
 *     `metadata.language`, `metadata.faviconAssetId` and `metadata.shareImageAssetId`
 *     (design programme D0).
 * 3 — configuration gained `design` (header, hero and card styles, radius, density,
 *     container, token overrides); page sections carry `variant` and `appearance`, seven
 *     section types were added, and media may carry a focal point (design programme D1).
 * 4 — configuration gained `design.theme` (the composition, "default" = the preset's
 *     original one), `branding.logoDarkAssetId`, `navigation.cta` and more typography
 *     presets (design programme D2).
 * 5 — page sections gained the types team, logo_strip, image_text and image_band, the hero
 *     treatments offset, collage and statement with `extraImageAssetIds`, a gallery
 *     `lightbox`, a portrait per quotation, and the click-to-load map (`embed`, `latitude`,
 *     `longitude`); rich text gained divider, callout and button blocks (site-building
 *     programme B3). Every addition defaults to the earlier behaviour.
 * 6 — media may be a document (`kind: "document"`, `mime`, one `file` variant served as
 *     `<sha256>.pdf`); items carry `attachments` listed as downloads on their page; pages gained
 *     the `downloads` section; link targets may name a document (`document:<asset id>`)
 *     (site-building programme B5). Older snapshots have none of it and render unchanged.
 * Older snapshots render unchanged: `normalizeSnapshot` fills the schema defaults at read
 * time and never rewrites the stored release (the rendering-hash test proves the output).
 */
export const SNAPSHOT_SCHEMA_VERSION = 6 as const;
export const SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS = [1, 2, 3, 4, 5, 6];

export interface SnapshotItem {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  revisionId: string;
  revisionVersion: number;
  payload: Record<string, unknown>;
}

/** Image widths, and `file` for a document's one published copy (B5-1). */
export type MediaVariantKey = "w480" | "w960" | "w1600" | "file";

export interface SnapshotMediaVariant {
  /** Object key of the private derivative (for previews and export). */
  key: string;
  /** Public content-hash file name, e.g. "<sha256>-w960.webp" or "<sha256>.pdf". */
  path: string;
  /** Pixel dimensions of an image variant; 0 for a document. */
  width: number;
  height: number;
  bytes: number;
  hash: string;
}

export interface SnapshotMedia {
  id: string;
  hash: string;
  /** Pixel dimensions of the original image; 0 for a document. */
  width: number;
  height: number;
  alt: string;
  decorative: boolean;
  title: string;
  attribution: string;
  license: string;
  variants: Partial<Record<MediaVariantKey, SnapshotMediaVariant>>;
  /** Focal point (0–1 from the left and the top) that every crop keeps in view; absent = centre. */
  focal?: { x: number; y: number };
  /** Absent for images (every release before B5); "document" for a file served as uploaded. */
  kind?: "image" | "document";
  /** The document's content type (documents only). */
  mime?: string;
}

/** Whether a media entry is a document with a published copy to link to. */
export function isSnapshotDocument(media: SnapshotMedia | undefined | null): media is SnapshotMedia & { kind: "document" } {
  return Boolean(media && media.kind === "document" && media.variants.file);
}

export interface SnapshotRoute {
  path: string;
  kind: ContentKind | "index" | "search";
  itemId?: string;
  module?: ModuleKey;
}

export interface SnapshotRedirect {
  from: string;
  to: string;
}

export interface ReleaseSnapshot {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  site: {
    id: string;
    key: string;
    name: string;
    preset: PresetKey;
    timeZone: string;
    mode: "demo" | "live";
    contact: { email: string; phone: string; address: string };
  };
  configRevisionId: string;
  config: SiteConfig;
  items: Record<string, SnapshotItem>;
  routes: SnapshotRoute[];
  redirects: SnapshotRedirect[];
  media: Record<string, SnapshotMedia>;
}

export function isSupportedSnapshot(value: unknown): value is ReleaseSnapshot {
  const v = value as Partial<ReleaseSnapshot> | null;
  return Boolean(
    v &&
      typeof v === "object" &&
      SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS.includes(v.schemaVersion as number) &&
      v.site &&
      v.config &&
      v.items &&
      Array.isArray(v.routes),
  );
}

/**
 * A stored snapshot in the shape the current renderer expects: supported version, the
 * configuration parsed through the current schema, and (for snapshots older than version 3)
 * every item payload parsed through its kind's schema, so that fields added by later
 * versions carry their defaults. The stored release itself is never modified.
 */
export function normalizeSnapshot(value: unknown): ReleaseSnapshot | null {
  if (!isSupportedSnapshot(value)) return null;
  const parsedConfig = siteConfigSchema.safeParse(value.config);
  const config = parsedConfig.success ? parsedConfig.data : value.config;
  if (value.schemaVersion >= 3) return { ...value, config };
  const items: Record<string, SnapshotItem> = {};
  for (const [id, item] of Object.entries(value.items)) {
    const parsed = kindRegistry[item.kind]?.schema.safeParse(item.payload);
    items[id] = parsed?.success ? { ...item, payload: parsed.data as Record<string, unknown> } : item;
  }
  return { ...value, config, items };
}

export function itemsOfKind(snapshot: ReleaseSnapshot, kind: ContentKind): SnapshotItem[] {
  return Object.values(snapshot.items).filter((i) => i.kind === kind);
}

export function routeForItem(snapshot: ReleaseSnapshot, itemId: string): string | null {
  const r = snapshot.routes.find((x) => x.itemId === itemId);
  return r ? r.path : null;
}
