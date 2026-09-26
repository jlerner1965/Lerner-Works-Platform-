import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveDemoRelease, resolveRoute, normalizePublicPath } from "@/server/publishing/public-site";
import { makeRenderContext, queryRecord, publicMetadata } from "@/server/publishing/render";
import { getConfig } from "@/server/config";
import { getTheme } from "@/themes";

export const dynamic = "force-dynamic";

type Params = { siteKey: string; path?: string[] };

/** Local demonstration route: renders only the active published release of a demo site. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { siteKey, path } = await params;
  const release = await resolveDemoRelease(siteKey);
  if (!release) return { title: "Not found", robots: { index: false, follow: false } };
  const route = resolveRoute(release.snapshot, normalizePublicPath(path));
  return publicMetadata(release.snapshot, route, { metadataBase: new URL(getConfig().APP_URL), basePath: `/demo/${siteKey}`, forceNoindex: true });
}

export default async function DemoSitePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { siteKey, path } = await params;
  const query = queryRecord(await searchParams);
  const release = await resolveDemoRelease(siteKey);
  if (!release) notFound();
  const currentPath = normalizePublicPath(path);
  const route = resolveRoute(release.snapshot, currentPath);
  const basePath = `/demo/${siteKey}`;
  if (route.type === "redirect") redirect(`${basePath}${route.to === "/" ? "" : route.to}`);
  if (route.type === "not_found") notFound();
  const ctx = makeRenderContext({
    snapshot: release.snapshot,
    basePath,
    mode: "demo",
    path: currentPath,
    query,
    inquiryEndpoint: `${basePath}/inquiries`,
    releaseVersion: release.releaseVersion,
    publishedAt: release.publishedAt,
  });
  return getTheme(release.snapshot).render(ctx, route);
}
