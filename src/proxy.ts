import { NextResponse, type NextRequest } from "next/server";

/**
 * Host routing. The dashboard, local demo routes and previews are served only on the
 * configured application host (and loopback hosts for local testing). Any other hostname is
 * resolved through the verified domain registry by rewriting to the internal /host/<name>
 * route, which returns a neutral 404 for unknown or unverified hosts. Only the Host header is
 * consulted; forwarded-host headers are not trusted here.
 *
 * Two paths are exempt and answer on every hostname: /healthz, and the scheduled job
 * endpoints under /api/jobs/, which authenticate with the job secret instead of the host.
 * Vercel Cron calls them on the deployment's generated *.vercel.app URL, never on APP_HOST.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalize(host: string | null): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return /^[a-z0-9.-]{1,253}$/.test(h) ? h : null;
}

export function proxy(request: NextRequest) {
  const host = normalize(request.headers.get("host"));
  const appHost = normalize(process.env.APP_HOST ?? "localhost:3000");
  if (!host) return new NextResponse("Not found", { status: 404 });
  if (host === appHost || LOOPBACK.has(host)) {
    // Internal host routes must not be reachable by path on the application host.
    if (request.nextUrl.pathname.startsWith("/host/")) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = `/host/${host}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
  const headers = new Headers(request.headers);
  headers.set("x-lw-host-routing", "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|assets/|favicon.ico|healthz|api/jobs/).*)"],
};
