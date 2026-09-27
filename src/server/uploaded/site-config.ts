/**
 * A built site's own hosting configuration (B9, decision D-029): `_redirects` and `_headers`
 * in the Netlify format, which generators and the owner's own build already write. Read at
 * inspection into the release manifest and applied by the file handler; nothing here touches
 * the files themselves. Pure functions.
 */

export type RedirectStatus = 200 | 301 | 302 | 307 | 308 | 404;

export interface UploadedRedirect {
  /** `/old`, `/old/`, or `/blog/*` (a splat). */
  from: string;
  /** A site path or an absolute address; `:splat` stands for what `*` matched. */
  to: string;
  status: RedirectStatus;
}

export interface UploadedHeaderRule {
  /** `/*`, `/_astro/*`, or an exact path. */
  pattern: string;
  headers: Record<string, string>;
}

export const MAX_REDIRECTS = 500;
export const MAX_HEADER_RULES = 200;

/** Headers a site may set on its own responses; the platform's Content-Type, Content-Length, ETag and nosniff stay its own. */
export const ALLOWED_SITE_HEADERS = new Set([
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cache-control",
  "access-control-allow-origin",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cross-origin-embedder-policy",
  "x-robots-tag",
  "link",
  "content-language",
  "vary",
]);

const STATUSES = new Set<number>([200, 301, 302, 307, 308, 404]);

function strip(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export interface ParsedRedirects {
  redirects: UploadedRedirect[];
  ignored: string[];
}

/** Reads a `_redirects` file: `from to [status]` per line, comments with `#`. */
export function parseRedirects(text: string): ParsedRedirects {
  const out: ParsedRedirects = { redirects: [], ignored: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (out.redirects.length >= MAX_REDIRECTS) {
      out.ignored.push(`${line} (more than ${MAX_REDIRECTS} rules)`);
      continue;
    }
    const parts = line.split(/\s+/);
    const [from, to] = parts;
    let status: number = 301;
    const rest = parts.slice(2);
    if (rest.length) {
      const s = rest[0]!.replace(/!$/, "");
      if (!/^\d{3}$/.test(s) || !STATUSES.has(Number(s))) {
        out.ignored.push(line);
        continue;
      }
      status = Number(s);
      if (rest.length > 1) {
        out.ignored.push(line);
        continue;
      }
    }
    if (!from || !to || !from.startsWith("/") || /[?=:]/.test(from) || (from.includes("*") && !from.endsWith("/*")) || from.length > 500 || to.length > 2000) {
      out.ignored.push(line);
      continue;
    }
    if (!(to.startsWith("/") || /^https?:\/\//i.test(to))) {
      out.ignored.push(line);
      continue;
    }
    if (status === 200 && !to.startsWith("/")) {
      out.ignored.push(line);
      continue;
    }
    out.redirects.push({ from, to, status: status as RedirectStatus });
  }
  return out;
}

export interface ParsedHeaders {
  rules: UploadedHeaderRule[];
  ignored: string[];
}

/** Reads a `_headers` file: a path line, then indented `Name: value` lines. */
export function parseHeaders(text: string): ParsedHeaders {
  const out: ParsedHeaders = { rules: [], ignored: [] };
  let current: UploadedHeaderRule | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\S/.test(line)) {
      const pattern = line.trim();
      if (!pattern.startsWith("/") || pattern.includes(":") || (pattern.includes("*") && !pattern.endsWith("*")) || pattern.length > 500) {
        out.ignored.push(pattern);
        current = null;
        continue;
      }
      if (out.rules.length >= MAX_HEADER_RULES) {
        out.ignored.push(`${pattern} (more than ${MAX_HEADER_RULES} rules)`);
        current = null;
        continue;
      }
      current = { pattern, headers: {} };
      out.rules.push(current);
      continue;
    }
    const m = /^\s+([A-Za-z0-9-]{1,80}):\s*(.*)$/.exec(line);
    if (!m || !current) {
      out.ignored.push(line.trim());
      continue;
    }
    const name = m[1]!.toLowerCase();
    const value = m[2]!.replace(/[\r\n\u0000]/g, "").slice(0, 4096);
    if (!ALLOWED_SITE_HEADERS.has(name)) {
      out.ignored.push(`${current.pattern}: ${m[1]}`);
      continue;
    }
    current.headers[name] = value;
  }
  return out;
}

/** Whether a pattern of `_headers` or `_redirects` matches a request path; a splat returns what `*` stood for. */
export function matchPattern(pattern: string, pathname: string): { matched: boolean; splat: string } {
  if (pattern === "/*") return { matched: true, splat: pathname.replace(/^\//, "") };
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    if (pathname.startsWith(prefix)) return { matched: true, splat: pathname.slice(prefix.length) };
    if (strip(pathname) === strip(prefix)) return { matched: true, splat: "" };
    return { matched: false, splat: "" };
  }
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return pathname.startsWith(prefix) ? { matched: true, splat: pathname.slice(prefix.length) } : { matched: false, splat: "" };
  }
  return { matched: strip(pattern) === strip(pathname), splat: "" };
}

/** The first redirect whose `from` matches, with `:splat` filled in; null when none does. */
export function matchRedirect(redirects: UploadedRedirect[] | undefined, pathname: string): { to: string; status: RedirectStatus } | null {
  for (const r of redirects ?? []) {
    const m = matchPattern(r.from, pathname);
    if (!m.matched) continue;
    const to = r.to.replace(/:splat/g, m.splat);
    return { to, status: r.status };
  }
  return null;
}

/**
 * Applies the site's header rules to a response, in order, later rules winning. The
 * platform keeps Content-Type, Content-Length, ETag and nosniff; a preview keeps its
 * no-store and noindex whatever the site says.
 */
export function applyHeaderRules(headers: Headers, rules: UploadedHeaderRule[] | undefined, pathname: string, mode: "preview" | "live"): void {
  for (const rule of rules ?? []) {
    if (!matchPattern(rule.pattern, pathname).matched) continue;
    for (const [name, value] of Object.entries(rule.headers)) {
      if (!ALLOWED_SITE_HEADERS.has(name)) continue;
      if (mode === "preview" && (name === "cache-control" || name === "x-robots-tag")) continue;
      headers.set(name, value);
    }
  }
}
