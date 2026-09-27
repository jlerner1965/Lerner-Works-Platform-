/**
 * Public asset names and their content types (site-building programme B5-1). Publication copies
 * every derivative of a release to a flat, immutable, content-hash name: images as
 * `<sha256>-w<width>.webp`, documents as `<sha256>.pdf`. The public asset route and the
 * publication step share this one definition so nothing else is ever served from the public
 * store.
 */
export const PUBLIC_ASSET_NAME = /^[0-9a-f]{64}(?:-w(?:480|960|1600)\.webp|\.pdf)$/;

export type MediaKind = "image" | "document";

/** Content types a document upload may carry; the file signature decides, not the declared type. */
export const DOCUMENT_MIME_TYPES = ["application/pdf"] as const;
export type DocumentMime = (typeof DOCUMENT_MIME_TYPES)[number];

const extensionFor: Record<DocumentMime, string> = { "application/pdf": "pdf" };

export function documentExtension(mime: DocumentMime): string {
  return extensionFor[mime];
}

/** The content type a public asset name is served with, or null for a name that is not a published derivative. */
export function publicAssetContentType(name: string): string | null {
  if (!PUBLIC_ASSET_NAME.test(name)) return null;
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  return null;
}

/** Response headers for a published derivative: immutable, typed, never sniffed; documents open in the browser under a stable file name. */
export function publicAssetHeaders(name: string, byteLength: number): Record<string, string> | null {
  const type = publicAssetContentType(name);
  if (!type) return null;
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(byteLength),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (type === "application/pdf") headers["Content-Disposition"] = `inline; filename="${name.slice(0, 12)}.pdf"`;
  return headers;
}

/** Whether a link target refers to a document in the media library (`document:<asset id>`). */
export function isDocumentLink(target: string): boolean {
  return /^document:[0-9a-f-]{36}$/i.test(target);
}

export function documentLinkId(target: string): string | null {
  return isDocumentLink(target) ? target.slice(9).toLowerCase() : null;
}

/** Bytes as people read them ("1.2 MB", "340 KB"). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
