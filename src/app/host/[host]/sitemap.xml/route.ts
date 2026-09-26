import { resolveLiveRelease } from "@/server/publishing/public-site";

export const dynamic = "force-dynamic";

/** Sitemap for a live canonical host: active, indexable, canonical routes only. */
export async function GET(request: Request, { params }: { params: Promise<{ host: string }> }) {
  if (request.headers.get("x-lw-host-routing") !== "1") return new Response("Not found", { status: 404 });
  const { host } = await params;
  const release = await resolveLiveRelease(host);
  if (!release || !release.isCanonical) return new Response("Not found", { status: 404 });
  const base = `https://${release.canonicalHost ?? host}`;
  const urls = release.snapshot.routes
    .filter((r) => r.kind !== "search")
    .filter((r) => {
      if (!r.itemId) return true;
      const item = release.snapshot.items[r.itemId];
      return item ? (item.payload as { indexable?: boolean }).indexable !== false : false;
    })
    .map((r) => `  <url><loc>${base}${r.path === "/" ? "" : escapeXml(r.path)}</loc><lastmod>${release.publishedAt.toISOString()}</lastmod></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
