import { resolveDemoRelease } from "@/server/publishing/public-site";
import { monogramFaviconSvg } from "@/server/publishing/render";

export const dynamic = "force-dynamic";

/** Generated monogram favicon for a demonstration site without an uploaded favicon. */
export async function GET(_request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  const release = await resolveDemoRelease(siteKey);
  if (!release) return new Response("Not found", { status: 404 });
  return new Response(monogramFaviconSvg(release.snapshot), {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
