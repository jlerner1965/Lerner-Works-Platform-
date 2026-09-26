import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveLiveRelease, resolveRoute, normalizePublicPath, normalizeHost } from "@/server/publishing/public-site";
import { makeRenderContext, queryRecord, publicMetadata } from "@/server/publishing/render";
import { getConfig } from "@/server/config";
import { getTheme } from "@/themes";

export const dynamic = "force-dynamic";

type Params = { host: string; path?: string[] };

async function guard(): Promise<void> {
  const h = await headers();
  if (h.get("x-lw-host-routing") !== "1") notFound();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  await guard();
  const { host, path } = await params;
  const release = await resolveLiveRelease(host);
  if (!release) return { title: "Not found", robots: { index: false, follow: false } };
  const currentPath = normalizePublicPath(path);
  const route = resolveRoute(release.snapshot, currentPath);
  const canonicalHost = release.canonicalHost ?? normalizeHost(host);
  return publicMetadata(release.snapshot, route, {
    metadataBase: new URL(canonicalHost ? `https://${canonicalHost}` : getConfig().APP_URL),
    basePath: "",
    forceNoindex: !release.isCanonical,
    canonical: canonicalHost ? `https://${canonicalHost}${currentPath === "/" ? "" : currentPath}` : undefined,
  });
}

/** Live customer site resolved from an exact, verified hostname. */
export default async function LiveSitePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guard();
  const { host, path } = await params;
  const release = await resolveLiveRelease(host);
  if (!release) notFound();
  const currentPath = normalizePublicPath(path);
  if (!release.isCanonical && release.canonicalHost) {
    permanentRedirect(`https://${release.canonicalHost}${currentPath === "/" ? "" : currentPath}`);
  }
  const route = resolveRoute(release.snapshot, currentPath);
  if (route.type === "redirect") permanentRedirect(route.to);
  if (route.type === "not_found") notFound();
  const ctx = makeRenderContext({
    snapshot: release.snapshot,
    basePath: "",
    mode: "live",
    path: currentPath,
    query: queryRecord(await searchParams),
    inquiryEndpoint: "/inquiries",
    releaseVersion: release.releaseVersion,
    publishedAt: release.publishedAt,
  });
  return getTheme(release.snapshot).render(ctx, route);
}
