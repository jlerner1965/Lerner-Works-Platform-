import { cache } from "react";
import { withAnon } from "@/server/data/db";
import { kindRegistry, type ContentKind } from "@/modules/registry";
import type { ModuleKey } from "@/modules/site-config";
import { normalizeSnapshot, type ReleaseSnapshot, type SnapshotItem } from "@/server/publishing/snapshot";

export interface PublicRelease {
  siteId: string;
  releaseId: string;
  releaseVersion: number;
  snapshot: ReleaseSnapshot;
  publishedAt: Date;
}

/**
 * Active demo release by registry key, through the anon-callable read function only.
 * Memoised per request (React `cache`) so the document language in the root layout, the
 * route metadata and the page body share one lookup.
 */
export const resolveDemoRelease = cache(async function resolveDemoRelease(siteKey: string): Promise<PublicRelease | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(siteKey)) return null;
  const rows = await withAnon((db) => db<{ siteId: string; releaseId: string; releaseVersion: number; snapshot: unknown; publishedAt: Date }[]>`
    select site_id, release_id, release_version, snapshot, published_at from public.get_demo_release(${siteKey})`);
  const row = rows[0];
  const snapshot = row ? normalizeSnapshot(row.snapshot) : null;
  if (!row || !snapshot) return null;
  return { siteId: row.siteId, releaseId: row.releaseId, releaseVersion: row.releaseVersion, snapshot, publishedAt: row.publishedAt };
});

export interface LiveRelease extends PublicRelease {
  isCanonical: boolean;
  canonicalHost: string | null;
}

/** Active live release for an exact verified hostname. Unknown hosts yield null. Memoised per request. */
export const resolveLiveRelease = cache(async function resolveLiveRelease(host: string): Promise<LiveRelease | null> {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  const rows = await withAnon((db) => db<{ siteId: string; releaseId: string; releaseVersion: number; snapshot: unknown; publishedAt: Date; isCanonical: boolean; canonicalHost: string | null }[]>`
    select site_id, release_id, release_version, snapshot, published_at, is_canonical, canonical_host from public.get_live_release(${normalized})`);
  const row = rows[0];
  const snapshot = row ? normalizeSnapshot(row.snapshot) : null;
  if (!row || !snapshot) return null;
  return { siteId: row.siteId, releaseId: row.releaseId, releaseVersion: row.releaseVersion, snapshot, publishedAt: row.publishedAt, isCanonical: row.isCanonical, canonicalHost: row.canonicalHost };
});

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(h) || h.length > 253) return null;
  return h;
}

export type ResolvedRoute =
  | { type: "page"; item: SnapshotItem }
  | { type: "detail"; kind: ContentKind; item: SnapshotItem }
  | { type: "index"; module: ModuleKey; kind: ContentKind }
  | { type: "search" }
  | { type: "redirect"; to: string }
  | { type: "not_found" };

export function normalizePublicPath(segments: string[] | undefined): string {
  const joined = "/" + (segments ?? []).map((s) => decodeURIComponentSafe(s)).filter(Boolean).join("/");
  return joined.length > 1 && joined.endsWith("/") ? joined.slice(0, -1) : joined;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const kindByModule: Record<ModuleKey, ContentKind | null> = { places: "place", events: "event", articles: "article", stores: "store", services: "service", inquiries: null, links: "link" };

export function resolveRoute(snapshot: ReleaseSnapshot, path: string): ResolvedRoute {
  const route = snapshot.routes.find((r) => r.path === path);
  if (route) {
    if (route.kind === "search") return { type: "search" };
    if (route.kind === "index" && route.module) {
      const kind = kindByModule[route.module];
      if (kind) return { type: "index", module: route.module, kind };
    }
    if (route.itemId) {
      const item = snapshot.items[route.itemId];
      if (item) return item.kind === "page" ? { type: "page", item } : { type: "detail", kind: item.kind, item };
    }
  }
  const redirect = snapshot.redirects.find((r) => r.from === path);
  if (redirect) return { type: "redirect", to: redirect.to };
  return { type: "not_found" };
}

export function kindLabel(kind: ContentKind): string {
  return kindRegistry[kind].label;
}
