import { withAnon } from "@/server/data/db";
import { getConfig } from "@/server/config";
import { getStorage } from "@/server/media/storage";
import { normalizeHost } from "@/server/publishing/public-site";
import { handleInquirySubmission } from "@/server/inquiries/intake";
import { isUploadedSnapshot, resolveUploadedPath, type UploadedSnapshot } from "./archive";

/**
 * Serving an uploaded site (B7). The proxy rewrites a preview hostname
 * (`<key>.<PREVIEW_DOMAIN>`) or a live hostname of an uploaded site to `/uploaded/<mode>/…`
 * with a routing header no client can set; this module resolves the active release through
 * the anon-callable read functions, finds the file the path names (a page without its
 * extension, a folder's index, the site's own 404 page) and answers with its type, its
 * content hash as the ETag and caching the CDN can use. Previews are never indexed.
 */

export const UPLOADED_ROUTING_HEADER = "x-lw-uploaded-routing";

export interface UploadedRelease {
  siteId: string;
  releaseId: string;
  version: number;
  publishedAt: Date;
  snapshot: UploadedSnapshot;
  mode: "preview" | "live";
  isCanonical: boolean;
  canonicalHost: string | null;
}

interface ReleaseRow {
  siteId: string;
  releaseId: string;
  releaseVersion: number;
  snapshot: unknown;
  publishedAt: Date;
  isCanonical?: boolean;
  canonicalHost?: string | null;
}

/** The active release of an uploaded site in demonstration mode, by its key; null for any other site. */
export async function resolveUploadedPreview(siteKey: string): Promise<UploadedRelease | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(siteKey)) return null;
  const rows = await withAnon((db) => db<ReleaseRow[]>`select site_id, release_id, release_version, snapshot, published_at from public.get_demo_release(${siteKey})`);
  const row = rows[0];
  if (!row || !isUploadedSnapshot(row.snapshot)) return null;
  return { siteId: row.siteId, releaseId: row.releaseId, version: row.releaseVersion, publishedAt: row.publishedAt, snapshot: row.snapshot, mode: "preview", isCanonical: true, canonicalHost: null };
}

/** The active release of a live uploaded site on an exact verified hostname; null for any other host. */
export async function resolveUploadedLive(host: string): Promise<UploadedRelease | null> {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  const rows = await withAnon((db) => db<ReleaseRow[]>`select site_id, release_id, release_version, snapshot, published_at, is_canonical, canonical_host from public.get_live_release(${normalized})`);
  const row = rows[0];
  if (!row || !isUploadedSnapshot(row.snapshot)) return null;
  return { siteId: row.siteId, releaseId: row.releaseId, version: row.releaseVersion, publishedAt: row.publishedAt, snapshot: row.snapshot, mode: "live", isCanonical: row.isCanonical ?? true, canonicalHost: row.canonicalHost ?? null };
}

function plain(status: number, text: string, extra: Record<string, string> = {}): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}

export interface UploadedRouteParams {
  mode: string;
  target: string;
  path?: string[];
}

function pathOf(params: UploadedRouteParams): string {
  return `/${(params.path ?? []).filter(Boolean).join("/")}`;
}

/** Headers every file of an uploaded site is served with. */
export function uploadedFileHeaders(file: { type: string; sha256: string; bytes: number }, mode: "preview" | "live"): Headers {
  const headers = new Headers({
    "Content-Type": file.type,
    "Content-Length": String(file.bytes),
    ETag: `"${file.sha256}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": mode === "preview" ? "no-store" : "public, max-age=0, s-maxage=60, must-revalidate",
  });
  if (mode === "preview") headers.set("X-Robots-Tag", "noindex, nofollow");
  return headers;
}

export async function resolveUploadedRelease(params: UploadedRouteParams): Promise<UploadedRelease | null> {
  if (params.mode === "preview") return resolveUploadedPreview(params.target);
  if (params.mode === "host") return resolveUploadedLive(params.target);
  return null;
}

/** GET and HEAD for a path of an uploaded site. */
export async function serveUploaded(request: Request, params: UploadedRouteParams): Promise<Response> {
  if (request.headers.get(UPLOADED_ROUTING_HEADER) !== "1") return plain(404, "Not found");
  const release = await resolveUploadedRelease(params);
  if (!release) return plain(404, "Not found");
  const pathname = pathOf(params);
  if (release.mode === "live" && !release.isCanonical && release.canonicalHost) {
    return Response.redirect(`https://${release.canonicalHost}${pathname === "/" ? "" : pathname}`, 308);
  }
  if (release.mode === "preview" && pathname === "/robots.txt") return plain(200, "User-agent: *\nDisallow: /\n", { "X-Robots-Tag": "noindex, nofollow" });
  const hit = resolveUploadedPath(release.snapshot, pathname);
  const file = hit?.file ?? release.snapshot.files["/404.html"] ?? null;
  if (!file) return plain(404, "Not found");
  const status = hit ? 200 : 404;
  const headers = uploadedFileHeaders(file, release.mode);
  if (status === 200 && request.headers.get("if-none-match") === headers.get("ETag")) {
    headers.delete("Content-Length");
    return new Response(null, { status: 304, headers });
  }
  const data = await getStorage().getPublic(file.name);
  if (!data) return plain(404, "Not found");
  return new Response(request.method === "HEAD" ? null : (data as unknown as BodyInit), { status, headers });
}

/** The contact form of an uploaded site posts here (`/_lw/inquiry`) and is redirected back into the site. */
export async function handleUploadedInquiry(request: Request, params: { mode: string; target: string }): Promise<Response> {
  if (request.headers.get(UPLOADED_ROUTING_HEADER) !== "1") return plain(404, "Not found");
  if (params.mode === "preview") {
    if (!/^[a-z0-9-]{1,60}$/.test(params.target)) return plain(404, "Not found");
    const previewDomain = getConfig().PREVIEW_DOMAIN;
    return handleInquirySubmission(request, { siteKey: params.target, allowedHosts: previewDomain ? [`${params.target}.${previewDomain}`] : [] }, { form: true });
  }
  if (params.mode === "host") {
    const host = normalizeHost(params.target);
    if (!host) return plain(404, "Not found");
    return handleInquirySubmission(request, { host }, { form: true });
  }
  return plain(404, "Not found");
}
