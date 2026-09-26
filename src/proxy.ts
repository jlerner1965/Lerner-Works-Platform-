import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_SITE_HEADER } from "@/lib/public-site-header";

/**
 * Host routing. The dashboard, local demo routes and previews are served only on the
 * configured application host (and loopback hosts for local testing). Any other hostname is
 * resolved through the verified domain registry by rewriting to the internal /host/<name>
 * route, which returns a neutral 404 for unknown or unverified hosts. Only the Host header is
 * consulted; forwarded-host headers are not trusted here.
 *
 * Two request headers are owned by the proxy and never accepted from clients:
 * `x-lw-host-routing` marks a rewritten customer-domain request, and `x-lw-public-site`
 * names the public site a request renders (`demo:<key>` or `host:<hostname>`) so the root
 * layout can set the document language without a second lookup.
 *
 * Two paths are exempt and answer on every hostname: /healthz, and the scheduled job
 * endpoints under /api/jobs/, which authenticate with the job secret instead of the host.
 * Vercel Cron calls them on the deployment's generated *.vercel.app URL, never on APP_HOST.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DEMO_PATH = /^\/demo\/([a-z0-9-]{1,60})(?:\/|$)/;

function normalize(host: string | null): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return /^[a-z0-9.-]{1,253}$/.test(h) ? h : null;
}

export function proxy(request: NextRequest) {
  const host = normalize(request.headers.get("host"));
  const appHost = normalize(process.env.APP_HOST ?? "localhost:3000");
  if (!host) return new NextResponse("Not found", { status: 404 });
  const headers = new Headers(request.headers);
  headers.delete("x-lw-host-routing");
  headers.delete(PUBLIC_SITE_HEADER);
  if (host === appHost || LOOPBACK.has(host)) {
    // Internal host routes must not be reachable by path on the application host.
    if (request.nextUrl.pathname.startsWith("/host/")) return new NextResponse("Not found", { status: 404 });
    const demo = DEMO_PATH.exec(request.nextUrl.pathname);
    if (demo) headers.set(PUBLIC_SITE_HEADER, `demo:${demo[1]}`);
    return NextResponse.next({ request: { headers } });
  }
  const url = request.nextUrl.clone();
  url.pathname = `/host/${host}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
  headers.set("x-lw-host-routing", "1");
  headers.set(PUBLIC_SITE_HEADER, `host:${host}`);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|assets/|favicon.ico|healthz|api/jobs/).*)"],
};
