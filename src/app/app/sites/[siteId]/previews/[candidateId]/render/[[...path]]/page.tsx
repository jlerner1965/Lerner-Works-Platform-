import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { getCandidate } from "@/server/publishing/candidates";
import { resolveRoute, normalizePublicPath } from "@/server/publishing/public-site";
import { makeRenderContext, queryRecord, routeMetadata, toNextMetadata } from "@/server/publishing/render";
import { getTheme } from "@/themes";
import { formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Params = { siteId: string; candidateId: string; path?: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { siteId, candidateId, path } = await params;
  const user = await requireUser(`/app/sites/${siteId}/previews/${candidateId}`);
  const cand = await withUser(user.id, (db) => getCandidate(db, candidateId));
  if (!cand || cand.siteId !== siteId) return { title: "Not found", robots: { index: false, follow: false } };
  const m = routeMetadata(cand.manifest, resolveRoute(cand.manifest, normalizePublicPath(path)));
  return toNextMetadata({ ...m, title: `Preview · ${m.title}` }, { forceNoindex: true });
}

/** Renders the exact frozen manifest of a candidate. Access is re-checked on every request. */
export default async function PreviewRenderPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { siteId, candidateId, path } = await params;
  const user = await requireUser(`/app/sites/${siteId}/previews/${candidateId}`);
  const cand = await withUser(user.id, (db) => getCandidate(db, candidateId));
  if (!cand || cand.siteId !== siteId) notFound();
  const basePath = `/app/sites/${siteId}/previews/${candidateId}/render`;
  const currentPath = normalizePublicPath(path);
  const route = resolveRoute(cand.manifest, currentPath);
  if (route.type === "redirect") redirect(`${basePath}${route.to === "/" ? "" : route.to}`);
  if (route.type === "not_found") notFound();
  const ctx = makeRenderContext({
    snapshot: cand.manifest,
    basePath,
    mode: "preview",
    path: currentPath,
    query: queryRecord(await searchParams),
    inquiryEndpoint: null,
    releaseVersion: 0,
    publishedAt: cand.createdAt,
    assetUrl: (media, variant) => `/app/sites/${siteId}/previews/${candidateId}/assets/${media.id}/${variant}`,
  });
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-warning-soft px-4 py-1.5 text-xs text-warning">
        <strong>Preview</strong>
        <span>Candidate {candidateId.slice(0, 8)} · frozen {formatDateTime(cand.createdAt)} · not the published site</span>
      </div>
      {getTheme(cand.manifest).render(ctx, route)}
    </>
  );
}
