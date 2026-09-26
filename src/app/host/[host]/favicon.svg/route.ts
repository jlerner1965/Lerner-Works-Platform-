import { resolveLiveRelease, normalizeHost } from "@/server/publishing/public-site";
import { monogramFaviconSvg } from "@/server/publishing/render";

export const dynamic = "force-dynamic";

/** Generated monogram favicon for a live site without an uploaded favicon (served at /favicon.svg on the customer domain). */
export async function GET(request: Request, { params }: { params: Promise<{ host: string }> }) {
  if (request.headers.get("x-lw-host-routing") !== "1") return new Response("Not found", { status: 404 });
  const { host } = await params;
  const normalized = normalizeHost(host);
  const release = normalized ? await resolveLiveRelease(normalized) : null;
  if (!release) return new Response("Not found", { status: 404 });
  return new Response(monogramFaviconSvg(release.snapshot), {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
