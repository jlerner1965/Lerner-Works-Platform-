import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { loadSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getItem } from "@/server/data/content";
import { buildManifest, resolveDefaultSelection } from "@/server/publishing/manifest";
import { getActiveRelease } from "@/server/publishing/candidates";
import { isSupportedSnapshot } from "@/server/publishing/snapshot";
import { resolveRoute, normalizePublicPath } from "@/server/publishing/public-site";
import { makeRenderContext, queryRecord, routeMetadata, toNextMetadata } from "@/server/publishing/render";
import { routeFor } from "@/modules/registry";
import { getTheme } from "@/themes";

export const dynamic = "force-dynamic";

type Params = { siteId: string; itemId: string; path?: string[] };

/**
 * Draft preview: the current working revision of one item rendered inside a transient
 * manifest (active release plus this revision). Nothing is stored; nothing is a candidate.
 */
async function build(userId: string, siteId: string, itemId: string) {
  return withUser(userId, async (db) => {
    const ctx = await loadSiteContext(db, siteId);
    if (!ctx) return null;
    const found = await getItem(db, itemId);
    if (!found || found.item.siteId !== siteId || !ctx.site.currentConfigRevisionId) return null;
    const baseRelease = await getActiveRelease(db, ctx.site);
    const base = baseRelease && isSupportedSnapshot(baseRelease.snapshot) ? baseRelease.snapshot : null;
    const { selection } = await resolveDefaultSelection(db, siteId, base, ctx.site.currentConfigRevisionId);
    selection.items[itemId] = found.revision.id;
    const built = await buildManifest(db, ctx.site, selection, base, []);
    return { ctx, found, manifest: built.manifest };
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { siteId, itemId, path } = await params;
  const user = await requireUser();
  const data = await build(user.id, siteId, itemId);
  if (!data) return { title: "Not found", robots: { index: false, follow: false } };
  const route = resolveRoute(data.manifest, normalizePublicPath(path));
  const m = routeMetadata(data.manifest, route);
  return toNextMetadata({ ...m, title: `Draft preview · ${m.title}` }, { forceNoindex: true });
}

export default async function DraftPreviewPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { siteId, itemId, path } = await params;
  const user = await requireUser(`/app/sites/${siteId}/content/${itemId}/preview`);
  const data = await build(user.id, siteId, itemId);
  if (!data) notFound();
  const basePath = `/app/sites/${siteId}/content/${itemId}/preview`;
  const itemRoute = routeFor(data.found.item.kind, data.found.revision.slug);
  const currentPath = path && path.length ? normalizePublicPath(path) : itemRoute;
  const route = resolveRoute(data.manifest, currentPath);
  if (route.type === "redirect") redirect(`${basePath}${route.to === "/" ? "" : route.to}`);
  const ctx = makeRenderContext({
    snapshot: data.manifest,
    basePath,
    mode: "preview",
    path: currentPath,
    query: queryRecord(await searchParams),
    inquiryEndpoint: null,
    releaseVersion: 0,
    publishedAt: new Date(),
    assetUrl: (media, variant) => `/app/sites/${siteId}/media/${media.id}/file/${variant}`,
  });
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-warning-soft px-4 py-1.5 text-xs text-warning">
        <strong>Draft preview</strong>
        <span>{data.found.revision.title} v{data.found.revision.version} on top of the current site. Not a candidate; not published.</span>
        <Link href={`/app/sites/${siteId}/content/${itemId}`} className="ml-auto underline">Back to editor</Link>
      </div>
      {route.type === "not_found" ? (
        <main className="mx-auto max-w-lg px-4 py-24 text-center"><h1 className="text-2xl font-semibold">Not part of this preview</h1><p className="mt-2 text-sm">This item&apos;s kind may belong to a disabled module, so it has no public route.</p></main>
      ) : (
        getTheme(data.manifest.site.preset).render(ctx, route)
      )}
    </>
  );
}
