import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import type { Db } from "@/server/data/db";
import { getStorage } from "@/server/media/storage";
import type { MediaAssetRow } from "@/server/publishing/manifest";
import { documentExtension, type DocumentMime, type MediaKind } from "@/server/media/content-types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Documents (B5-1) may be larger than pictures: a brochure or a report with its own pictures inside. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
const VARIANT_WIDTHS = [480, 960, 1600] as const;

export type SniffedType = "image/jpeg" | "image/png" | "image/webp";

/** Detects a document type from its file signature; only PDF is accepted (B5-1). */
export function sniffDocumentType(bytes: Uint8Array): DocumentMime | null {
  if (bytes.length < 8) return null;
  // "%PDF-" at the start; a few producers put a UTF-8 byte order mark or whitespace first.
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  while (start < 8 && (bytes[start] === 0x20 || bytes[start] === 0x0a || bytes[start] === 0x0d || bytes[start] === 0x09)) start++;
  if (bytes[start] === 0x25 && bytes[start + 1] === 0x50 && bytes[start + 2] === 0x44 && bytes[start + 3] === 0x46 && bytes[start + 4] === 0x2d) return "application/pdf";
  return null;
}

/** What an uploaded file is by its signature: a picture, a document, or neither. */
export function sniffUploadKind(bytes: Uint8Array): MediaKind | null {
  if (sniffDocumentType(bytes)) return "document";
  const image = sniffImageType(bytes);
  return image ? "image" : null;
}

/** Detects the real image type from file signatures; declared names and MIME types are not trusted. */
export function sniffImageType(bytes: Uint8Array): SniffedType | "image/svg+xml" | "image/avif" | "image/gif" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  const ascii = (start: number, len: number) => String.fromCharCode(...bytes.subarray(start, start + len));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (ascii(4, 4) === "ftyp" && /avi[fs]/.test(ascii(8, 4))) return "image/avif";
  const head = ascii(0, Math.min(bytes.length, 256)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return null;
}

export interface IngestInput {
  siteId: string;
  organizationId: string;
  userId: string;
  bytes: Uint8Array;
  filename: string;
  declaredMime: string;
  title?: string;
  altText?: string;
  decorative?: boolean;
  attributionText?: string;
  license?: string;
  sourceUrl?: string;
}

export type IngestResult = { ok: true; asset: MediaAssetRow } | { ok: false; code: "unsupported_type" | "too_large" | "too_many_pixels" | "mismatch" | "corrupt"; error: string };

function extFor(type: SniffedType): string {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

/**
 * Validates and stores an uploaded image: signature check, size and pixel limits, private
 * original, stripped WebP derivatives at fixed widths (never upscaled), and a media_assets
 * row created under the caller's row-level-security context.
 */
export async function ingestImage(db: Db, input: IngestInput): Promise<IngestResult> {
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, code: "too_large", error: `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const sniffed = sniffImageType(input.bytes);
  if (!sniffed || sniffed === "image/svg+xml" || sniffed === "image/avif" || sniffed === "image/gif") {
    const label = sniffed === "image/svg+xml" ? "SVG" : sniffed === "image/avif" ? "AVIF" : sniffed === "image/gif" ? "GIF" : "this file type";
    return { ok: false, code: "unsupported_type", error: `${label} is not accepted. Upload a JPEG, PNG or WebP image.` };
  }
  const declared = input.declaredMime.toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== sniffed && !(declared === "image/jpg" && sniffed === "image/jpeg")) {
    return { ok: false, code: "mismatch", error: `The file's content (${sniffed}) does not match its declared type (${declared}).` };
  }
  const extMatch = /\.([a-z0-9]+)$/i.exec(input.filename);
  const ext = extMatch?.[1]?.toLowerCase();
  if (ext && !["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return { ok: false, code: "mismatch", error: `The file name extension .${ext} does not match an accepted image type.` };
  }
  let meta: Metadata;
  try {
    // Header-only read; the pixel limit is enforced explicitly below and again when decoding.
    meta = await sharp(input.bytes, { limitInputPixels: false }).metadata();
  } catch {
    return { ok: false, code: "corrupt", error: "The image could not be decoded." };
  }
  if (!meta.width || !meta.height) return { ok: false, code: "corrupt", error: "The image has no readable dimensions." };
  if (meta.width * meta.height > MAX_PIXELS) return { ok: false, code: "too_many_pixels", error: "The image has more than 40 megapixels; resize it before uploading." };

  const storage = getStorage();
  const assetId = crypto.randomUUID();
  const prefix = `${input.organizationId}/${input.siteId}/${assetId}`;
  const originalKey = `${prefix}/original.${extFor(sniffed)}`;
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const derivatives: MediaAssetRow["derivatives"] = {};
  try {
    await storage.putPrivate(originalKey, input.bytes, sniffed);
    for (const width of VARIANT_WIDTHS) {
      if (width > 480 && meta.width <= (width === 960 ? 480 : 960)) continue; // never upscale beyond the previous step
      const buffer = await sharp(input.bytes, { limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize({ width: Math.min(width, meta.width), withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      const key = `${prefix}/w${width}.webp`;
      const hash = createHash("sha256").update(buffer.data).digest("hex");
      await storage.putPrivate(key, buffer.data, "image/webp");
      derivatives[`w${width}`] = { key, path: `${hash}-w${width}.webp`, width: buffer.info.width, height: buffer.info.height, bytes: buffer.info.size, hash };
    }
  } catch (err) {
    await storage.deletePrivatePrefix(prefix).catch(() => {});
    throw err;
  }
  const rows = await db<MediaAssetRow[]>`
    insert into public.media_assets (id, organization_id, site_id, kind, status, original_key, mime_type, byte_size, sha256, width, height, derivatives, title, alt_text, decorative, attribution_text, license, source_url, created_by)
    values (${assetId}, ${input.organizationId}, ${input.siteId}, 'image', 'ready', ${originalKey}, ${sniffed}, ${input.bytes.byteLength}, ${sha256}, ${meta.width}, ${meta.height}, ${db.json(derivatives as never)},
      ${input.title?.slice(0, 200) || input.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 200)}, ${input.altText?.slice(0, 500) || null}, ${input.decorative ?? false},
      ${input.attributionText?.slice(0, 500) || null}, ${input.license?.slice(0, 200) || null}, ${input.sourceUrl?.slice(0, 1000) || null}, ${input.userId})
    returning *`;
  const asset = rows[0];
  if (!asset) {
    await storage.deletePrivatePrefix(prefix).catch(() => {});
    throw new Error("media insert returned no row");
  }
  return { ok: true, asset };
}

export type DocumentIngestInput = Omit<IngestInput, "altText" | "decorative">;

/**
 * Validates and stores an uploaded document (site-building programme B5-1): signature check
 * (PDF only), size limit, private original, and one `file` derivative pointing at the same
 * bytes under the public content-hash name `<sha256>.pdf`. Documents are served as uploaded
 * (nothing is re-encoded), so the row records the exact bytes and their hash. A document has no
 * alternative text: its link text names it. Rights are recorded as for pictures.
 */
export async function ingestDocument(db: Db, input: DocumentIngestInput): Promise<IngestResult> {
  if (input.bytes.byteLength > MAX_DOCUMENT_BYTES) return { ok: false, code: "too_large", error: `The file is larger than ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.` };
  const sniffed = sniffDocumentType(input.bytes);
  if (!sniffed) return { ok: false, code: "unsupported_type", error: "This file type is not accepted. Upload a PDF document." };
  const declared = input.declaredMime.toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== sniffed && declared !== "application/x-pdf") {
    return { ok: false, code: "mismatch", error: `The file's content (${sniffed}) does not match its declared type (${declared}).` };
  }
  const extMatch = /\.([a-z0-9]+)$/i.exec(input.filename);
  const ext = extMatch?.[1]?.toLowerCase();
  if (ext && ext !== documentExtension(sniffed)) return { ok: false, code: "mismatch", error: `The file name extension .${ext} does not match a PDF document.` };
  // A PDF ends with %%EOF (trailing whitespace allowed); a truncated upload does not.
  const tail = String.fromCharCode(...input.bytes.subarray(Math.max(0, input.bytes.byteLength - 1024)));
  if (!/%%EOF\s*$/.test(tail)) return { ok: false, code: "corrupt", error: "The PDF is incomplete (its end marker is missing); export it again and upload the new file." };

  const storage = getStorage();
  const assetId = crypto.randomUUID();
  const prefix = `${input.organizationId}/${input.siteId}/${assetId}`;
  const originalKey = `${prefix}/original.${documentExtension(sniffed)}`;
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const derivatives: MediaAssetRow["derivatives"] = { file: { key: originalKey, path: `${sha256}.${documentExtension(sniffed)}`, width: 0, height: 0, bytes: input.bytes.byteLength, hash: sha256 } };
  await storage.putPrivate(originalKey, input.bytes, sniffed);
  const rows = await db<MediaAssetRow[]>`
    insert into public.media_assets (id, organization_id, site_id, kind, status, original_key, mime_type, byte_size, sha256, width, height, derivatives, title, alt_text, decorative, attribution_text, license, source_url, created_by)
    values (${assetId}, ${input.organizationId}, ${input.siteId}, 'document', 'ready', ${originalKey}, ${sniffed}, ${input.bytes.byteLength}, ${sha256}, null, null, ${db.json(derivatives as never)},
      ${input.title?.slice(0, 200) || input.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 200)}, null, false,
      ${input.attributionText?.slice(0, 500) || null}, ${input.license?.slice(0, 200) || null}, ${input.sourceUrl?.slice(0, 1000) || null}, ${input.userId})
    returning *`.catch(async (err: unknown) => {
    await storage.deletePrivatePrefix(prefix).catch(() => {});
    throw err;
  });
  const asset = rows[0];
  if (!asset) {
    await storage.deletePrivatePrefix(prefix).catch(() => {});
    throw new Error("media insert returned no row");
  }
  return { ok: true, asset };
}

/** Stores an upload as a picture or a document, whichever its signature says it is. */
export async function ingestUpload(db: Db, input: IngestInput): Promise<IngestResult> {
  const kind = sniffUploadKind(input.bytes);
  if (kind === "document") return ingestDocument(db, input);
  return ingestImage(db, input);
}

/** Items whose current working revision references an asset (for the usage view). */
export async function findAssetUsage(db: Db, siteId: string, assetId: string): Promise<Array<{ itemId: string; title: string; kind: string }>> {
  return db<Array<{ itemId: string; title: string; kind: string }>>`
    select i.id as item_id, r.title, i.kind::text
    from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${siteId} and i.archived_at is null and r.payload::text like ${"%" + assetId + "%"}
    order by r.title`;
}
