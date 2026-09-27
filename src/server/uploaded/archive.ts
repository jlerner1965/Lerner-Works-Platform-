import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

/**
 * Uploaded sites (site-building programme B7, decision D-026; tolerant reading B8, D-027):
 * what a ZIP of a finished site may contain, and how it is read. Everything here is pure:
 * bytes in, an inspection out. The rules are the ones a static host applies: files a browser
 * can be served are kept, everything else is left out and listed, an index page at the root
 * is required, sizes a release can hold are enforced. A repository download (README, LICENSE,
 * source files, a build script) therefore reads as the site it holds, not as a refusal.
 */

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 160 * 1024 * 1024;
export const MAX_FILES = 2000;
export const MAX_ENTRIES = 20000;
export const MAX_PATH_LENGTH = 255;
export const MAX_DEPTH = 12;

/** Content types by extension: what a website serves. Anything else is left out. */
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

/** Files that belong to a server or an editor, never to a finished site; left out with a warning of their own. */
const SERVER_SIDE = /\.(php|phtml|asp|aspx|jsp|cgi|pl|py|rb|sh|bat|cmd|exe|dll|so|htaccess|htpasswd)$/i;
/** Operating-system and editor droppings are skipped without a word. */
const DROPPINGS = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|\.gitkeep)$/i;
/** Repository housekeeping at the top level of a project: read by people and build tools, never by visitors. */
const HOUSEKEEPING =
  /^(readme|license|licence|changelog|contributing|code_of_conduct|security|authors|contributors|notice|copying|cname|makefile|dockerfile|procfile|gemfile|gemfile\.lock|_headers|_redirects|composer\.(json|lock)|requirements\.txt|package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|_config\.yml|angular\.json|vercel\.json|netlify\.toml|wrangler\.toml|firebase\.json|docker-compose\.ya?ml|(tsconfig|jsconfig)(\.[a-z0-9-]+)?\.json|(vite|next|astro|tailwind|postcss|eslint|prettier|babel|webpack|rollup|svelte|nuxt|remix|playwright|vitest|jest)\.config\.[cm]?[jt]s|gulpfile\.[cm]?[jt]s|gruntfile\.[cm]?[jt]s)(\.(md|txt|rst|markdown))?$/i;
/** Names a web address can carry: letters and digits of any script, and the usual punctuation. */
const SAFE_SEGMENT = /^[\p{L}\p{N}][\p{L}\p{N}._ ~()!@$&+,;=-]{0,254}$/u;
/** Folders a built site is usually written to; one of them holding index.html is taken as the site when the top level has none. */
export const BUILT_SITE_FOLDERS = ["dist", "build", "out", "public", "_site", "docs", "site", "www", "htdocs", "public_html"] as const;
/** Source files that show a project still has to be built. */
const SOURCE_FILE = /\.(tsx|jsx|ts|vue|svelte|astro|scss|sass|less|mdx)$/i;

export interface ArchiveFile {
  /** Site path, absolute and forward-slashed: `/index.html`, `/css/site.css`. */
  path: string;
  bytes: number;
  sha256: string;
  type: string;
  data: Uint8Array;
}

export type LeftOutReason = "hidden" | "server-side" | "housekeeping" | "not-served" | "unsafe-name" | "outside-root" | "dependencies";

export interface LeftOutFile {
  path: string;
  reason: LeftOutReason;
}

export interface ArchiveInspection {
  files: ArchiveFile[];
  totalBytes: number;
  /** A single top-level folder every file sat under, stripped from the paths. */
  strippedFolder: string | null;
  /** The folder inside the archive taken as the site (after the stripped folder), chosen or detected; null when the site sits at the top. */
  root: string | null;
  rootDetected: boolean;
  /** Files the site does not serve, with why; the warnings summarise them. */
  leftOut: LeftOutFile[];
  hasIndex: boolean;
  hasNotFoundPage: boolean;
  warnings: string[];
  errors: string[];
}

export interface ArchiveOptions {
  /** A folder inside the archive that holds the site (`dist`, `build`, `docs/site`); detected among the usual names when absent. */
  root?: string | null;
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

/** A folder path given by a person, normalised to `a/b` form, or null when empty; throws on a path that leaves the archive. */
export function normaliseRoot(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!raw) return null;
  const segments = raw.split("/").filter(Boolean);
  if (segments.some((s) => s === "." || s === "..") || segments.length > MAX_DEPTH || raw.length > 200) throw new Error("The folder must be a plain path inside the ZIP, such as dist or docs/site.");
  return segments.join("/");
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

function listSome(paths: string[], max = 5): string {
  const shown = paths.slice(0, max).join(", ");
  return paths.length > max ? `${shown} and ${paths.length - max} more` : shown;
}

/**
 * Reads a ZIP of a finished site. Folders and droppings are skipped; a single top-level
 * folder (the way a zipped folder arrives) is stripped; a folder holding the built site
 * (`dist`, `build`, `out`, `public`, `_site`, `docs`…) is taken as the site when the top level
 * has no index page, or the caller names one; hidden files, server-side code, repository
 * housekeeping, dependencies and files a website does not serve are left out and listed. An
 * index page at the root is required. Limits: 64 MB archive, 25 MB per file, 160 MB in all,
 * 2,000 files kept.
 */
export function inspectSiteArchive(bytes: Uint8Array, options: ArchiveOptions = {}): ArchiveInspection {
  const out: ArchiveInspection = { files: [], totalBytes: 0, strippedFolder: null, root: null, rootDetected: false, leftOut: [], hasIndex: false, hasNotFoundPage: false, warnings: [], errors: [] };
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
    out.errors.push(`The ZIP is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
    return out;
  }
  let requestedRoot: string | null = null;
  try {
    requestedRoot = normaliseRoot(options.root);
  } catch (err) {
    out.errors.push((err as Error).message);
    return out;
  }
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0;
    let count = 0;
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        if (++count > MAX_ENTRIES) throw new Error(`the ZIP holds more than ${MAX_ENTRIES.toLocaleString()} entries`);
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
  // The site may sit in a folder of the archive: named by the caller, or detected among the usual build outputs.
  const has = (p: string) => normalised.some((f) => f.path.toLowerCase() === p.toLowerCase());
  let root: string | null = null;
  if (requestedRoot) {
    if (!has(`/${requestedRoot}/index.html`)) {
      out.errors.push(`No index.html in the folder "${requestedRoot}" of the ZIP.`);
      return out;
    }
    root = requestedRoot;
  } else if (!has("/index.html")) {
    const candidates = BUILT_SITE_FOLDERS.filter((c) => has(`/${c}/index.html`));
    if (candidates.length === 1) {
      root = candidates[0]!;
      out.rootDetected = true;
    } else if (candidates.length > 1) {
      out.errors.push(`No index.html at the top level, and more than one folder holds one (${candidates.join(", ")}): name the folder that is the site.`);
      return out;
    }
  }
  if (root) {
    out.root = root;
    const prefix = `/${root}/`;
    let outside = 0;
    const kept: typeof normalised = [];
    for (const f of normalised) {
      if (f.path.toLowerCase().startsWith(prefix.toLowerCase())) kept.push({ path: f.path.slice(prefix.length - 1), data: f.data });
      else outside++;
    }
    normalised.length = 0;
    normalised.push(...kept);
    if (outside) out.leftOut.push({ path: `${outside} file${outside === 1 ? "" : "s"} outside "${root}"`, reason: "outside-root" });
    out.warnings.push(out.rootDetected ? `The site was taken from the folder "${root}" of the ZIP; the ${outside} file${outside === 1 ? "" : "s"} outside it ${outside === 1 ? "was" : "were"} left out.` : `The site was taken from the folder "${root}"; ${outside} file${outside === 1 ? "" : "s"} outside it ${outside === 1 ? "was" : "were"} left out.`);
  }
  const seen = new Set<string>();
  const leftOut = (path: string, reason: LeftOutReason) => out.leftOut.push({ path, reason });
  let dependencies = 0;
  let sourceFiles = 0;
  let housekeepingSeen = false;
  for (const f of normalised) {
    const segments = f.path.slice(1).split("/");
    const base = segments[segments.length - 1]!;
    if (segments.some((s) => s === "node_modules")) {
      dependencies++;
      continue;
    }
    if (segments.some((s) => s.startsWith("."))) {
      leftOut(f.path, "hidden");
      continue;
    }
    if (segments.length === 1 && HOUSEKEEPING.test(base)) {
      housekeepingSeen = true;
      leftOut(f.path, "housekeeping");
      continue;
    }
    if (SERVER_SIDE.test(base)) {
      leftOut(f.path, "server-side");
      continue;
    }
    if (segments.some((s) => !SAFE_SEGMENT.test(s))) {
      leftOut(f.path, "unsafe-name");
      continue;
    }
    const type = contentTypeFor(f.path);
    if (!type) {
      if (SOURCE_FILE.test(base)) sourceFiles++;
      leftOut(f.path, "not-served");
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
  if (dependencies) out.leftOut.push({ path: `${dependencies} file${dependencies === 1 ? "" : "s"} under node_modules`, reason: "dependencies" });
  if (out.files.length > MAX_FILES) {
    out.errors.push(`The site holds ${out.files.length.toLocaleString()} files; the limit is ${MAX_FILES.toLocaleString()}.`);
    out.files = [];
    out.totalBytes = 0;
    return out;
  }
  out.files.sort((a, b) => a.path.localeCompare(b.path));
  out.hasIndex = out.files.some((f) => f.path === "/index.html");
  out.hasNotFoundPage = out.files.some((f) => f.path === "/404.html");
  // The left-out groups, each in one line.
  const group = (reason: LeftOutReason) => out.leftOut.filter((l) => l.reason === reason).map((l) => l.path);
  const serverSide = group("server-side");
  if (serverSide.length) out.warnings.push(`Left out as server-side code: ${listSome(serverSide)}. A page or form that depends on it will not work here.`);
  const notServed = group("not-served");
  if (notServed.length) out.warnings.push(`Left out, not a kind of file a website serves: ${listSome(notServed)}.`);
  const housekeeping = group("housekeeping");
  if (housekeeping.length) out.warnings.push(`Left out, repository housekeeping: ${listSome(housekeeping)}.`);
  const hidden = group("hidden");
  if (hidden.length) out.warnings.push(`Left out, hidden: ${listSome(hidden)}.`);
  const unsafe = group("unsafe-name");
  if (unsafe.length) out.warnings.push(`Left out, names a web address cannot carry: ${listSome(unsafe)}. Rename them to letters, digits, dots, dashes and underscores.`);
  if (dependencies) out.warnings.push(`Left out: ${dependencies.toLocaleString()} file${dependencies === 1 ? "" : "s"} under node_modules.`);
  if (out.files.length === 0 && out.errors.length === 0) {
    out.errors.push(out.leftOut.length ? "The ZIP holds no files a website serves; everything in it was left out (see the notes)." : "The ZIP holds no files a website serves.");
  } else if (!out.hasIndex && out.errors.length === 0) {
    out.errors.push(
      housekeepingSeen || sourceFiles
        ? "No index.html at the top level, and this looks like a project that has to be built first (package.json, source files). Build it, then zip the output folder (often dist, build, out or public), or name that folder when uploading."
        : "No index.html at the top level of the ZIP: the site needs a home page there (a zipped folder is fine; its name is dropped).",
    );
  }
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

/** Where a release's files came from when they were fetched from GitHub rather than uploaded (B8). */
export interface GithubSourceRef {
  repository: string;
  branch: string;
  commit: string;
  root: string | null;
}

/** The release snapshot of an uploaded site: schema series 101 of `releases.schema_version`. */
export interface UploadedSnapshot {
  schemaVersion: 1;
  kind: "uploaded";
  files: Record<string, UploadedSnapshotFile>;
  source: {
    filename: string;
    archiveBytes: number;
    files: number;
    totalBytes: number;
    strippedFolder: string | null;
    root?: string | null;
    leftOut?: number;
    github?: GithubSourceRef | null;
  };
}

export const UPLOADED_SCHEMA_VERSION = 101;

export function toUploadedSnapshot(inspection: ArchiveInspection, source: { filename: string; archiveBytes: number; github?: GithubSourceRef | null }): UploadedSnapshot {
  const files: Record<string, UploadedSnapshotFile> = {};
  for (const f of inspection.files) files[f.path] = { name: publicNameFor(f.sha256, f.path), bytes: f.bytes, type: f.type, sha256: f.sha256 };
  return {
    schemaVersion: 1,
    kind: "uploaded",
    files,
    source: {
      filename: source.filename.slice(0, 200),
      archiveBytes: source.archiveBytes,
      files: inspection.files.length,
      totalBytes: inspection.totalBytes,
      strippedFolder: inspection.strippedFolder,
      root: inspection.root,
      leftOut: inspection.leftOut.length,
      github: source.github ?? null,
    },
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
