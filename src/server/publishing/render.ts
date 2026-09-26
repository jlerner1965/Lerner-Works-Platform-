import type { Metadata } from "next";
import type { RenderContext, RenderMode } from "@/themes/shared/types";
import type { ReleaseSnapshot, SnapshotMedia, MediaVariantKey } from "@/server/publishing/snapshot";
import type { ResolvedRoute } from "@/server/publishing/public-site";
import { kindRegistry } from "@/modules/registry";
import type { IndexModuleKey } from "@/modules/site-config";
import { deriveBrandTokens } from "@/lib/brand-tokens";

export type AssetUrl = (media: SnapshotMedia, variant: MediaVariantKey) => string;

export function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function queryRecord(searchParams: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    const s = firstString(v);
    if (s !== undefined && s.length <= 200) out[k] = s;
  }
  return out;
}

/** Public derivative URL (served from /assets on every hostname). */
export const defaultAssetUrl: AssetUrl = (media, variant) => `/assets/${media.variants[variant]?.path ?? ""}`;

export function makeRenderContext(input: {
  snapshot: ReleaseSnapshot;
  basePath: string;
  mode: RenderMode;
  path: string;
  query: Record<string, string>;
  inquiryEndpoint: string | null;
  releaseVersion: number;
  publishedAt: Date;
  assetUrl?: AssetUrl;
  now?: Date;
}): RenderContext {
  return {
    snapshot: input.snapshot,
    basePath: input.basePath,
    mode: input.mode,
    now: input.now ?? new Date(),
    query: input.query,
    path: input.path,
    inquiryEndpoint: input.inquiryEndpoint,
    releaseVersion: input.releaseVersion,
    publishedAt: input.publishedAt,
    assetUrl: input.assetUrl ?? defaultAssetUrl,
  };
}

export interface RouteMeta {
  title: string;
  description: string;
  indexable: boolean;
  /** Share image: the route's own featured image, else the site's share image, else none. */
  image: SnapshotMedia | null;
}

function mediaWithVariants(snapshot: ReleaseSnapshot, id: unknown): SnapshotMedia | null {
  if (typeof id !== "string") return null;
  const media = snapshot.media[id];
  return media && Object.keys(media.variants).length > 0 ? media : null;
}

/** Title/description for a resolved route from the frozen snapshot only. */
export function routeMetadata(snapshot: ReleaseSnapshot, route: ResolvedRoute): RouteMeta {
  const { metadata, indexes } = snapshot.config;
  const suffix = metadata.titleSuffix ? ` · ${metadata.titleSuffix}` : "";
  const siteImage = mediaWithVariants(snapshot, metadata.shareImageAssetId);
  if (route.type === "page" || route.type === "detail") {
    const p = route.item.payload as Record<string, unknown>;
    const isHome = route.type === "page" && route.item.slug === "home";
    const base = (p.metaTitle as string) || (isHome ? metadata.defaultTitle : route.item.title);
    return {
      title: isHome && !(p.metaTitle as string) ? base : `${base}${suffix}`,
      description: (p.metaDescription as string) || (p.summary as string) || metadata.defaultDescription,
      indexable: p.indexable !== false,
      image: mediaWithVariants(snapshot, p.featuredImageAssetId) ?? siteImage,
    };
  }
  if (route.type === "index") {
    const copy = indexes?.[route.module as IndexModuleKey];
    const title = copy?.title?.trim() || kindRegistry[route.kind].plural;
    return { title: `${title}${suffix}`, description: copy?.intro?.trim() || metadata.defaultDescription, indexable: true, image: siteImage };
  }
  if (route.type === "search") return { title: `Search${suffix}`, description: "", indexable: false, image: siteImage };
  return { title: metadata.defaultTitle, description: metadata.defaultDescription, indexable: false, image: siteImage };
}

/** Metadata for dashboard previews: platform title template applies, nothing is indexable. */
export function toNextMetadata(m: { title: string; description: string; indexable: boolean }, opts: { canonical?: string; forceNoindex: boolean }): Metadata {
  return {
    title: m.title,
    description: m.description || undefined,
    robots: opts.forceNoindex || !m.indexable ? { index: false, follow: false } : { index: true, follow: true },
    ...(opts.canonical ? { alternates: { canonical: opts.canonical } } : {}),
  };
}

function largestVariant(media: SnapshotMedia): { key: MediaVariantKey; width: number; height: number } | null {
  for (const key of ["w1600", "w960", "w480"] as const) {
    const v = media.variants[key];
    if (v) return { key, width: v.width, height: v.height };
  }
  return null;
}

/**
 * Metadata for a public page of a customer site: the site's own title (no platform suffix),
 * its favicon (uploaded image, or a monogram generated from the brand colours), the share
 * image, canonical link and indexability, all from the release snapshot.
 */
export function publicMetadata(
  snapshot: ReleaseSnapshot,
  route: ResolvedRoute,
  opts: { metadataBase: URL; basePath: string; canonical?: string; forceNoindex: boolean; assetUrl?: AssetUrl },
): Metadata {
  const m = routeMetadata(snapshot, route);
  const assetUrl = opts.assetUrl ?? defaultAssetUrl;
  const { branding, metadata } = snapshot.config;
  const favicon = mediaWithVariants(snapshot, metadata.faviconAssetId);
  const faviconKey: MediaVariantKey | undefined = favicon ? (favicon.variants.w480 ? "w480" : largestVariant(favicon)?.key) : undefined;
  const faviconVariant = favicon && faviconKey ? favicon.variants[faviconKey] : undefined;
  const icon = favicon && faviconKey && faviconVariant
    ? { url: assetUrl(favicon, faviconKey), type: "image/webp", sizes: `${faviconVariant.width}x${faviconVariant.height}` }
    : { url: `${opts.basePath}/favicon.svg`, type: "image/svg+xml" };
  const shareVariant = m.image ? largestVariant(m.image) : null;
  const images = m.image && shareVariant ? [{ url: assetUrl(m.image, shareVariant.key), width: shareVariant.width, height: shareVariant.height, alt: m.image.decorative ? "" : m.image.alt }] : undefined;
  return {
    metadataBase: opts.metadataBase,
    title: { absolute: m.title },
    description: m.description || undefined,
    robots: opts.forceNoindex || !m.indexable ? { index: false, follow: false } : { index: true, follow: true },
    ...(opts.canonical ? { alternates: { canonical: opts.canonical } } : {}),
    icons: { icon: [icon], ...(favicon && faviconVariant ? { apple: [icon] } : {}) },
    openGraph: {
      type: "website",
      siteName: branding.wordmark,
      title: m.title,
      description: m.description || undefined,
      ...(opts.canonical ? { url: opts.canonical } : {}),
      ...(images ? { images } : {}),
    },
    twitter: { card: images ? "summary_large_image" : "summary" },
  };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

/**
 * Default favicon for a site without an uploaded one: a monogram of the wordmark's first
 * character on the primary colour, in the typography preset's generic family.
 */
export function monogramFaviconSvg(snapshot: ReleaseSnapshot): string {
  const { branding } = snapshot.config;
  const tokens = deriveBrandTokens(branding.colors);
  const first = [...branding.wordmark.trim()][0] ?? "•";
  const family = branding.typography === "editorial-serif" ? "Georgia, 'Times New Roman', serif" : "system-ui, 'Segoe UI', Helvetica, Arial, sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="12" fill="${tokens.primary}"/><text x="32" y="45" text-anchor="middle" font-family="${family}" font-size="38" font-weight="700" fill="${tokens.onPrimary}">${escapeXml(first.toUpperCase())}</text></svg>`;
}
