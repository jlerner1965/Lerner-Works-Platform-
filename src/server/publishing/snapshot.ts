import type { ContentKind } from "@/modules/registry";
import { siteConfigSchema, type SiteConfig, type ModuleKey } from "@/modules/site-config";
import type { PresetKey } from "@/modules/presets";

/**
 * Snapshot schema versions:
 * 1 — initial release format.
 * 2 — configuration gained `navigation.showSearch`, `footer.variant`, `indexes`,
 *     `metadata.language`, `metadata.faviconAssetId` and `metadata.shareImageAssetId`
 *     (design programme D0). Version 1 snapshots render unchanged: `normalizeSnapshot`
 *     fills the schema defaults at read time and never rewrites the stored release.
 */
export const SNAPSHOT_SCHEMA_VERSION = 2 as const;
export const SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS = [1, 2];

export interface SnapshotItem {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  revisionId: string;
  revisionVersion: number;
  payload: Record<string, unknown>;
}

export type MediaVariantKey = "w480" | "w960" | "w1600";

export interface SnapshotMediaVariant {
  /** Object key of the private derivative (for previews and export). */
  key: string;
  /** Public content-hash file name, e.g. "<sha256>-w960.webp". */
  path: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
}

export interface SnapshotMedia {
  id: string;
  hash: string;
  width: number;
  height: number;
  alt: string;
  decorative: boolean;
  title: string;
  attribution: string;
  license: string;
  variants: Partial<Record<MediaVariantKey, SnapshotMediaVariant>>;
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
  schemaVersion: 1 | 2;
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
 * A stored snapshot in the shape the current renderer expects: supported version, and the
 * configuration parsed through the current schema so that fields added by later versions
 * carry their defaults. The stored release itself is never modified.
 */
export function normalizeSnapshot(value: unknown): ReleaseSnapshot | null {
  if (!isSupportedSnapshot(value)) return null;
  const parsed = siteConfigSchema.safeParse(value.config);
  return parsed.success ? { ...value, config: parsed.data } : value;
}

export function itemsOfKind(snapshot: ReleaseSnapshot, kind: ContentKind): SnapshotItem[] {
  return Object.values(snapshot.items).filter((i) => i.kind === kind);
}

export function routeForItem(snapshot: ReleaseSnapshot, itemId: string): string | null {
  const r = snapshot.routes.find((x) => x.itemId === itemId);
  return r ? r.path : null;
}
