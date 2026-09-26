import type { Metadata } from "next";
import type { RenderContext, RenderMode } from "@/themes/shared/types";
import type { ReleaseSnapshot, SnapshotMedia, MediaVariantKey } from "@/server/publishing/snapshot";
import type { ResolvedRoute } from "@/server/publishing/public-site";
import { kindRegistry } from "@/modules/registry";

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

export function makeRenderContext(input: {
  snapshot: ReleaseSnapshot;
  basePath: string;
  mode: RenderMode;
  path: string;
  query: Record<string, string>;
  inquiryEndpoint: string | null;
  releaseVersion: number;
  publishedAt: Date;
  assetUrl?: (media: SnapshotMedia, variant: MediaVariantKey) => string;
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
    assetUrl: input.assetUrl ?? ((media, variant) => `/assets/${media.variants[variant]?.path ?? ""}`),
  };
}

/** Title/description for a resolved route from the frozen snapshot only. */
export function routeMetadata(snapshot: ReleaseSnapshot, route: ResolvedRoute): { title: string; description: string; indexable: boolean } {
  const { metadata } = snapshot.config;
  const suffix = metadata.titleSuffix ? ` · ${metadata.titleSuffix}` : "";
  if (route.type === "page" || route.type === "detail") {
    const p = route.item.payload as Record<string, unknown>;
    const isHome = route.type === "page" && route.item.slug === "home";
    const base = (p.metaTitle as string) || (isHome ? metadata.defaultTitle : route.item.title);
    return {
      title: isHome && !(p.metaTitle as string) ? base : `${base}${suffix}`,
      description: (p.metaDescription as string) || (p.summary as string) || metadata.defaultDescription,
      indexable: p.indexable !== false,
    };
  }
  if (route.type === "index") return { title: `${kindRegistry[route.kind].plural}${suffix}`, description: metadata.defaultDescription, indexable: true };
  if (route.type === "search") return { title: `Search${suffix}`, description: "", indexable: false };
  return { title: metadata.defaultTitle, description: metadata.defaultDescription, indexable: false };
}

export function toNextMetadata(m: { title: string; description: string; indexable: boolean }, opts: { canonical?: string; forceNoindex: boolean }): Metadata {
  return {
    title: m.title,
    description: m.description || undefined,
    robots: opts.forceNoindex || !m.indexable ? { index: false, follow: false } : { index: true, follow: true },
    ...(opts.canonical ? { alternates: { canonical: opts.canonical } } : {}),
  };
}
