import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

/**
 * Uploaded sites (site-building programme B7, decision D-026): what a ZIP of a finished site
 * may contain, and how it is read. Everything here is pure: bytes in, an inspection out. The
 * rules are the ones a static host applies: files a browser can be served, safe paths, an
 * index page at the root, sizes a release can hold.
 */

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 160 * 1024 * 1024;
export const MAX_FILES = 2000;
export const MAX_PATH_LENGTH = 255;
export const MAX_DEPTH = 12;

/** Content types by extension: what a website serves. Anything else is refused or skipped. */
export const SERVED_TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  map: "application/json; charset=utf-8",
  json: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  ics: "text/calendar; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  zip: "application/zip",
  wasm: "application/wasm",
};

/** Files that belong to a server or an editor, never to a finished site; naming them is an error. */
const SERVER_SIDE = /\.(php|phtml|asp|aspx|jsp|cgi|pl|py|rb|sh|bat|cmd|exe|dll|so|htaccess|htpasswd)$/i;
/** Operating-system and editor droppings are skipped without a word. */
const DROPPINGS = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|\.gitkeep)$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._ ~()!@$&+,;=-]{0,254}$/;

export interface ArchiveFile {
  /** Site path, absolute and forward-slashed: `/index.html`, `/css/site.css`. */
  path: string;
  bytes: number;
  sha256: string;
  type: string;
  data: Uint8Array;
}

export interface ArchiveInspection {
  files: ArchiveFile[];
  totalBytes: number;
  /** A single top-level folder every file sat under, stripped from the paths. */
  strippedFolder: string | null;
  hasIndex: boolean;
  hasNotFoundPage: boolean;
  warnings: string[];
  errors: string[];
}

export function extensionOf(path: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return m ? m[1]!.toLowerCase() : "";
}

export function contentTypeFor(path: string): string | null {
  return SERVED_TYPES[extensionOf(path)] ?? null;
}

/** Public storage name of a file: its content hash and its extension, flat. */
export function publicNameFor(sha256: string, path: string): string {
  return `${sha256}.${extensionOf(path) || "bin"}`;
}

/** A path inside the archive, normalised, or null when it is not a path a site may hold. */
function normalisePath(raw: string): { path: string; reason?: string } {
  let p = raw.replace(/\\/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  while (p.startsWith("/")) p = p.slice(1);
  if (!p || p.endsWith("/")) return { path: "" };
  if ([...p].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return { path: "", reason: "control characters in the name" };
  const segments = p.split("/");
  if (segments.some((s) => s === "." || s === "..")) return { path: "", reason: "a . or .. segment" };
  if (segments.length > MAX_DEPTH) return { path: "", reason: `deeper than ${MAX_DEPTH} folders` };
  if (p.length > MAX_PATH_LENGTH) return { path: "", reason: `longer than ${MAX_PATH_LENGTH} characters` };
  return { path: `/${segments.join("/")}` };
}

/**
 * Reads a ZIP of a finished site. Folders and droppings are skipped; a single top-level
 * folder (the way a zipped folder arrives) is stripped; server-side files and unknown file
 * types are errors, hidden files are skipped with a warning; an index page at the root is
 * required. Limits: 64 MB archive, 25 MB per file, 160 MB in all, 2,000 files.
 */
export function inspectSiteArchive(bytes: Uint8Array): ArchiveInspection {
  const out: ArchiveInspection = { files: [], totalBytes: 0, strippedFolder: null, hasIndex: false, hasNotFoundPage: false, warnings: [], errors: [] };
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
    out.errors.push(`The ZIP is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
    return out;
  }
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0;
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        total += f.originalSize;
        if (total > MAX_TOTAL_BYTES) throw new Error(`the files unpack to more than ${MAX_TOTAL_BYTES / 1024 / 1024} MB`);
        return true;
      },
    });
  } catch (err) {
    out.errors.push(`The file is not a ZIP a site can be read from: ${(err as Error).message}.`);
    return out;
  }
  const raw = Object.entries(entries).filter(([name]) => !/(^|\/)__MACOSX\//.test(name) && !DROPPINGS.test(name));
  const normalised: Array<{ path: string; data: Uint8Array }> = [];
  for (const [name, data] of raw) {
    const n = normalisePath(name);
    if (!n.path) {
      if (n.reason) out.errors.push(`"${name}" cannot be served: ${n.reason}.`);
      continue;
    }
    normalised.push({ path: n.path, data });
  }
  // A zipped folder: every file under one top-level folder, which is not part of the site.
  const tops = new Set(normalised.map((f) => f.path.split("/")[1]!));
  if (tops.size === 1 && normalised.length > 0 && !normalised.some((f) => f.path.split("/").length === 2)) {
    const folder = [...tops][0]!;
    out.strippedFolder = folder;
    for (const f of normalised) f.path = f.path.slice(folder.length + 1);
  }
  if (normalised.length > MAX_FILES) {
    out.errors.push(`The ZIP holds ${normalised.length} files; the limit is ${MAX_FILES}.`);
    return out;
  }
  const seen = new Set<string>();
  for (const f of normalised) {
    const segments = f.path.slice(1).split("/");
    const base = segments[segments.length - 1]!;
    if (segments.some((s) => s.startsWith("."))) {
      out.warnings.push(`Hidden file "${f.path}" skipped.`);
      continue;
    }
    if (SERVER_SIDE.test(base)) {
      out.errors.push(`"${f.path}" is a server-side file; this hosts finished HTML, CSS, JavaScript and media only.`);
      continue;
    }
    if (segments.some((s) => !SAFE_SEGMENT.test(s))) {
      out.errors.push(`"${f.path}" has characters a web address cannot carry; rename it to letters, digits, dots, dashes and underscores.`);
      continue;
    }
    const type = contentTypeFor(f.path);
    if (!type) {
      out.errors.push(`"${f.path}" is not a kind of file a website serves (.${extensionOf(f.path) || "?"}).`);
      continue;
    }
    if (f.data.byteLength > MAX_FILE_BYTES) {
      out.errors.push(`"${f.path}" is ${(f.data.byteLength / 1024 / 1024).toFixed(1)} MB; a file may be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
      continue;
    }
    const lower = f.path.toLowerCase();
    if (seen.has(lower)) {
      out.errors.push(`"${f.path}" appears twice with different letter cases; web addresses do not tell them apart.`);
      continue;
    }
    seen.add(lower);
    const sha256 = createHash("sha256").update(f.data).digest("hex");
    out.files.push({ path: f.path, bytes: f.data.byteLength, sha256, type, data: f.data });
    out.totalBytes += f.data.byteLength;
  }
  out.files.sort((a, b) => a.path.localeCompare(b.path));
  out.hasIndex = out.files.some((f) => f.path === "/index.html");
  out.hasNotFoundPage = out.files.some((f) => f.path === "/404.html");
  if (out.files.length === 0 && out.errors.length === 0) out.errors.push("The ZIP holds no files a website serves.");
  else if (!out.hasIndex && out.errors.length === 0) out.errors.push("No index.html at the top level of the ZIP: the site needs a home page there (a zipped folder is fine; its name is dropped).");
  if (out.files.length && !out.hasNotFoundPage) out.warnings.push("No 404.html: visitors who mistype an address get a plain not-found page.");
  const formNote = out.files.filter((f) => f.type.startsWith("text/html")).some((f) => /<form\b/i.test(latin(f.data)) && !/_lw\/inquiry/i.test(latin(f.data)));
  if (formNote) out.warnings.push("A form in the site does not post to the platform's inquiry endpoint; see the contact form snippet on the site's overview.");
  return out;
}

function latin(data: Uint8Array): string {
  // Enough to spot markup; the bytes are not interpreted beyond that.
  return Buffer.from(data.subarray(0, 512 * 1024)).toString("latin1");
}

export interface UploadedSnapshotFile {
  /** Public storage name (`<sha256>.<ext>`). */
  name: string;
  bytes: number;
  type: string;
  sha256: string;
}

/** The release snapshot of an uploaded site: schema series 101 of `releases.schema_version`. */
export interface UploadedSnapshot {
  schemaVersion: 1;
  kind: "uploaded";
  files: Record<string, UploadedSnapshotFile>;
  source: { filename: string; archiveBytes: number; files: number; totalBytes: number; strippedFolder: string | null };
}

export const UPLOADED_SCHEMA_VERSION = 101;

export function toUploadedSnapshot(inspection: ArchiveInspection, source: { filename: string; archiveBytes: number }): UploadedSnapshot {
  const files: Record<string, UploadedSnapshotFile> = {};
  for (const f of inspection.files) files[f.path] = { name: publicNameFor(f.sha256, f.path), bytes: f.bytes, type: f.type, sha256: f.sha256 };
  return {
    schemaVersion: 1,
    kind: "uploaded",
    files,
    source: { filename: source.filename.slice(0, 200), archiveBytes: source.archiveBytes, files: inspection.files.length, totalBytes: inspection.totalBytes, strippedFolder: inspection.strippedFolder },
  };
}

export function isUploadedSnapshot(value: unknown): value is UploadedSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === "uploaded" && typeof v.files === "object" && v.files !== null && typeof (v.files as Record<string, unknown>)["/index.html"] === "object";
}

/** The site path a request resolves to: the file itself, a page without its extension, or a folder's index. */
export function resolveUploadedPath(snapshot: UploadedSnapshot, pathname: string): { path: string; file: UploadedSnapshotFile } | null {
  let p = pathname || "/";
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  const candidates = p.endsWith("/") ? [`${p}index.html`] : [p, `${p}.html`, `${p}/index.html`];
  for (const c of candidates) {
    const file = snapshot.files[c];
    if (file) return { path: c, file };
  }
  return null;
}
