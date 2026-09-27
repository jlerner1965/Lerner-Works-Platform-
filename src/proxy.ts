import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_SITE_HEADER } from "@/lib/public-site-header";

/**
 * Host routing. The dashboard, local demo routes and previews of structured sites are served
 * only on the configured application host (and loopback hosts for local testing). A preview
 * hostname of an uploaded site (`<key>.<PREVIEW_DOMAIN>`, B7) is rewritten to the file
 * handler under /uploaded/preview/<key>/files, and its contact form (`/_lw/inquiry`) to
 * /uploaded/preview/<key>/inquiry. Any other hostname is a customer domain: the proxy asks
 * which kind of site it serves (a small per-instance cache, a minute at most) and rewrites
 * to /uploaded/host/<name>/… for an uploaded site or to the internal /host/<name> route for
 * a structured one, which returns a neutral 404 for unknown or unverified hosts. Only the
 * Host header is consulted; forwarded-host headers are not trusted here.
 *
 * Request headers owned by the proxy and never accepted from clients: `x-lw-host-routing`
 * marks a rewritten customer-domain request, `x-lw-uploaded-routing` a request the file
 * handler may answer, `x-lw-public-site` names the public site a request renders (`demo:<key>`
 * or `host:<hostname>`) so the root layout can set the document language without a second
 * lookup, and `x-lw-path` carries the dashboard path for layouts that need it.
 *
 * Paths exempt from host routing answer on every hostname: /healthz, the scheduled job
 * endpoints under /api/jobs/ (they authenticate with the job secret) and the public lookup
 * under /api/public/ that this proxy itself calls.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DEMO_PATH = /^\/demo\/([a-z0-9-]{1,60})(?:\/|$)/;
const HOST_ROUTING_HEADER = "x-lw-host-routing";
const UPLOADED_ROUTING_HEADER = "x-lw-uploaded-routing";
const UPLOADED_INQUIRY_PATH = "/_lw/inquiry";
const PATH_HEADER = "x-lw-path";

function normalize(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return /^[a-z0-9.-]{1,253}$/.test(h) ? h : null;
}

function previewDomain(): string | null {
  const configured = process.env.PREVIEW_DOMAIN?.trim();
  if (configured) return normalize(configured);
  return (process.env.APP_ENV ?? "local") === "local" ? "preview.localhost" : null;
}

const hostTypes = new Map<string, { type: string | null; until: number }>();

/** The kind of site a customer hostname serves, from the application's public lookup, remembered for a minute. */
async function siteTypeForHost(host: string): Promise<string | null> {
  const now = Date.now();
  const known = hostTypes.get(host);
  if (known && known.until > now) return known.type;
  try {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/public/site-type?host=${encodeURIComponent(host)}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { type?: string | null };
    const type = typeof body.type === "string" ? body.type : null;
    hostTypes.set(host, { type, until: now + 60_000 });
    return type;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const host = normalize(request.headers.get("host"));
  const appHost = normalize(process.env.APP_HOST ?? "localhost:3000");
  if (!host) return new NextResponse("Not found", { status: 404 });
  const pathname = request.nextUrl.pathname;
  const headers = new Headers(request.headers);
  headers.delete(HOST_ROUTING_HEADER);
  headers.delete(UPLOADED_ROUTING_HEADER);
  headers.delete(PATH_HEADER);
  headers.delete(PUBLIC_SITE_HEADER);
  if (host === appHost || LOOPBACK.has(host)) {
    // Internal routes must not be reachable by path on the application host.
    if (pathname.startsWith("/host/") || pathname.startsWith("/uploaded/")) return new NextResponse("Not found", { status: 404 });
    const demo = DEMO_PATH.exec(pathname);
    if (demo) headers.set(PUBLIC_SITE_HEADER, `demo:${demo[1]}`);
    if (pathname.startsWith("/app")) headers.set(PATH_HEADER, pathname);
    return NextResponse.next({ request: { headers } });
  }
  const url = request.nextUrl.clone();
  const suffix = pathname === "/" ? "" : pathname;
  // An uploaded site's files live under …/files so that no path of the site can collide with
  // its form endpoint under …/inquiry.
  const uploadedPath = (mode: "preview" | "host", target: string) => (pathname === UPLOADED_INQUIRY_PATH ? `/uploaded/${mode}/${target}/inquiry` : `/uploaded/${mode}/${target}/files${suffix}`);
  const preview = previewDomain();
  if (preview && host.endsWith(`.${preview}`)) {
    const key = host.slice(0, host.length - preview.length - 1);
    if (!/^[a-z0-9-]{1,60}$/.test(key)) return new NextResponse("Not found", { status: 404 });
    url.pathname = uploadedPath("preview", key);
    headers.set(UPLOADED_ROUTING_HEADER, "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if ((await siteTypeForHost(host)) === "uploaded") {
    url.pathname = uploadedPath("host", host);
    headers.set(UPLOADED_ROUTING_HEADER, "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }
  url.pathname = `/host/${host}${suffix}`;
  headers.set(HOST_ROUTING_HEADER, "1");
  headers.set(PUBLIC_SITE_HEADER, `host:${host}`);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|assets/|favicon.ico|healthz|api/jobs/|api/public/).*)"],
};
