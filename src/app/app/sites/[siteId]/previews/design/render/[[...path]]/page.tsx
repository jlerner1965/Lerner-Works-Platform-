import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { loadDesignPreview } from "@/server/publishing/design-preview";
import { resolveRoute, normalizePublicPath } from "@/server/publishing/public-site";
import { defaultAssetUrl, makeRenderContext, queryRecord, routeMetadata, toNextMetadata } from "@/server/publishing/render";
import { getTheme } from "@/themes";
import { capabilitiesFor } from "@/themes/capabilities";

export const dynamic = "force-dynamic";

type Params = { siteId: string; path?: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { siteId, path } = await params;
  const user = await requireUser(`/app/sites/${siteId}/previews/design`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canDesign) return { title: "Not found", robots: { index: false, follow: false } };
  const preview = await withUser(user.id, (db) => loadDesignPreview(db, ctx.site));
  if (!preview) return { title: "Design preview", robots: { index: false, follow: false } };
  const m = routeMetadata(preview.snapshot, resolveRoute(preview.snapshot, normalizePublicPath(path)));
  return toNextMetadata({ ...m, title: `Design preview · ${m.title}` }, { forceNoindex: true });
}

/**
 * Renders the draft configuration over the active release (design programme D2). Access is
 * re-checked on every request; assets a release already carries come from the public path,
 * assets only the draft configuration references come through the dashboard's private route.
 */
export default async function DesignPreviewRenderPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { siteId, path } = await params;
  const user = await requireUser(`/app/sites/${siteId}/previews/design`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canDesign) notFound();
  const preview = await withUser(user.id, (db) => loadDesignPreview(db, ctx.site));
  if (!preview) notFound();
  const basePath = `/app/sites/${siteId}/previews/design/render`;
  const currentPath = normalizePublicPath(path);
  const route = resolveRoute(preview.snapshot, currentPath);
  if (route.type === "redirect") redirect(`${basePath}${route.to === "/" ? "" : route.to}`);
  if (route.type === "not_found") notFound();
  const renderCtx = makeRenderContext({
    snapshot: preview.snapshot,
    basePath,
    mode: "preview",
    path: currentPath,
    query: queryRecord(await searchParams),
    inquiryEndpoint: null,
    releaseVersion: preview.release.version,
    publishedAt: preview.release.createdAt,
    assetUrl: (media, variant) => (preview.unreleasedAssetIds.has(media.id) ? `/app/sites/${siteId}/media/${media.id}/file/${variant}` : defaultAssetUrl(media, variant)),
  });
  const theme = capabilitiesFor(ctx.site.preset, preview.snapshot.config.design);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-warning-soft px-4 py-1.5 text-xs text-warning">
        <strong>Design preview</strong>
        <span>Configuration revision {preview.configVersion} ({theme.label}) over release {preview.release.version} · not the published site</span>
      </div>
      {getTheme(preview.snapshot).render(renderCtx, route)}
    </>
  );
}
