import type { ReactNode } from "react";
import type { ReleaseSnapshot, SnapshotMedia, MediaVariantKey } from "@/server/publishing/snapshot";
import type { ResolvedRoute } from "@/server/publishing/public-site";

export type RenderMode = "live" | "demo" | "preview";

export interface RenderContext {
  snapshot: ReleaseSnapshot;
  /** Prefix for every internal link ("" for live, "/demo/<key>" for demo, preview render path for previews). */
  basePath: string;
  mode: RenderMode;
  now: Date;
  /** Query parameters of the current request (filters, search). */
  query: Record<string, string>;
  /** Current site-relative path (without basePath). */
  path: string;
  /** Resolves an image variant to a URL. */
  assetUrl: (media: SnapshotMedia, variant: MediaVariantKey) => string;
  /** Endpoint for inquiry submissions; null disables the form (previews). */
  inquiryEndpoint: string | null;
  releaseVersion: number;
  publishedAt: Date;
}

export interface Theme {
  key: "guide" | "locations";
  render(ctx: RenderContext, route: ResolvedRoute): ReactNode;
}

export function href(ctx: RenderContext, path: string): string {
  if (path.startsWith("http")) return path;
  const p = path === "/" ? "" : path;
  return `${ctx.basePath}${p}` || "/";
}
