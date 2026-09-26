import { resolveLiveRelease } from "@/server/publishing/public-site";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ host: string }> }) {
  if (request.headers.get("x-lw-host-routing") !== "1") return new Response("Not found", { status: 404 });
  const { host } = await params;
  const release = await resolveLiveRelease(host);
  if (!release) return new Response("Not found", { status: 404 });
  const body = release.isCanonical
    ? `User-agent: *\nAllow: /\nDisallow: /search\nSitemap: https://${release.canonicalHost ?? host}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
