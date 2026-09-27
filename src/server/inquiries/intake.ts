import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { withAnon, describeDbError } from "@/server/data/db";
import { getConfig } from "@/server/config";

const MAX_BODY_BYTES = 16 * 1024;

const payloadSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Name must be 120 characters or fewer."),
  email: z.string().trim().min(1, "Enter your email address.").max(254).pipe(z.email("Enter a valid email address.")),
  phone: z.string().trim().max(40, "Phone must be 40 characters or fewer.").default(""),
  message: z.string().trim().min(1, "Enter a message.").max(4000, "Message must be 4000 characters or fewer."),
  locationId: z.uuid().nullable().default(null),
  sourcePath: z.string().max(500).regex(/^\/[^\s]*$/).default("/"),
  consentVersion: z.string().max(40).default(""),
  idempotencyKey: z.string().min(8).max(80),
  website: z.string().max(200).default(""),
});

export interface IntakeTarget {
  siteKey?: string;
  host?: string;
  /** Hostnames besides the application's and the target's own that may post: an uploaded site's preview hostname (B7). */
  allowedHosts?: string[];
}

export interface IntakeOptions {
  /** Uploaded sites (B7): the site's own HTML form posts here; the answer is a redirect back into the site, or a plain page naming what to correct. */
  form?: boolean;
}

/** Short-retention requester hash: IP + daily salt derived from the server secret. */
export function requesterHash(request: Request): string {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${getConfig().SESSION_SECRET}:${day}:${ip}`).digest("hex");
}

function originAllowed(request: Request, target: IntakeTarget): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts from older browsers omit it; Sec-Fetch-Site is checked below
  try {
    const o = new URL(origin);
    const appHost = new URL(getConfig().APP_URL).host;
    if (o.host === appHost || o.hostname === "localhost" || o.hostname === "127.0.0.1") return true;
    if (target.host && o.hostname === target.host) return true;
    if (target.allowedHosts?.includes(o.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

const SITE_PATH = /^\/[^\s]*$/;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** A plain, unstyled answer for a form post that cannot be redirected: what to correct, and the way back. */
function formPage(status: number, title: string, lines: string[], backTo: string | null): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#222}h1{font-size:1.4rem}ul{padding-left:1.2rem}a{color:#1d4ed8}</style></head><body><h1>${escapeHtml(title)}</h1>${lines.length ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : ""}${backTo ? `<p><a href="${escapeHtml(backTo)}">Go back to the form</a></p>` : ""}</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

/** Reads an HTML form post: the fields the snippet names, where to go afterwards, and where the form was. */
async function readFormSubmission(request: Request): Promise<{ data: Record<string, unknown>; next: string; back: string | null }> {
  const form = await request.formData();
  const field = (k: string): string => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  let back: string | null = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      back = `${u.pathname}${u.search}`;
    } catch {
      back = null;
    }
  }
  const next = SITE_PATH.test(field("next")) ? field("next") : (back ?? "/");
  const sourcePath = SITE_PATH.test(field("sourcePath")) ? field("sourcePath") : back && SITE_PATH.test(back) ? back.split("?")[0]! : "/";
  const token = field("token");
  return {
    data: { name: field("name"), email: field("email"), phone: field("phone"), message: field("message"), website: field("website"), sourcePath, consentVersion: field("consentVersion"), locationId: null, idempotencyKey: token.length >= 8 ? token.slice(0, 80) : randomUUID() },
    next,
    back,
  };
}

/**
 * Handles a public inquiry submission for a site resolved from trusted routing. Rejects
 * oversized bodies, cross-site origins, honeypot hits and invalid fields before the
 * transactional SQL function stores the inquiry and its delivery job. JSON in, JSON out for
 * the platform's own forms; for an uploaded site's HTML form (`form: true`) the fields come
 * URL-encoded and the answer is a redirect back into the site with the receipt.
 */
export async function handleInquirySubmission(request: Request, target: IntakeTarget, options: IntakeOptions = {}): Promise<Response> {
  const isForm = Boolean(options.form);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  let back: string | null = null;
  let next = "/";
  const fail = (status: number, message: string, lines: string[] = []) => (isForm ? formPage(status, message, lines, back) : json({ error: message, ...(lines.length ? { fieldErrors: Object.fromEntries(lines.map((l, i) => [String(i), l])) } : {}) }, status));
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return fail(403, "Cross-site submissions are not accepted.");
  if (!originAllowed(request, target)) return fail(403, "Cross-site submissions are not accepted.");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return fail(413, "The submission is too large.");
  let data: unknown;
  if (isForm) {
    try {
      const read = await readFormSubmission(request);
      data = read.data;
      next = read.next;
      back = read.back;
    } catch {
      return fail(400, "The submission could not be read.");
    }
  } else {
    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return json({ error: "The submission could not be read." }, 400);
    }
    if (raw.length > MAX_BODY_BYTES) return json({ error: "The submission is too large." }, 413);
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: "The submission was not valid JSON." }, 400);
    }
  }
  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    if (isForm) return formPage(422, "Please correct the form", Object.values(fieldErrors), back);
    return json({ error: "Please correct the highlighted fields.", fieldErrors }, 422);
  }
  if (parsed.data.website.trim() !== "") return fail(400, "The submission was rejected.");

  const payload = {
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
    locationId: parsed.data.locationId,
    sourcePath: parsed.data.sourcePath,
    consentVersion: parsed.data.consentVersion,
  };
  try {
    const rows = await withAnon((db) => db<{ inquiryId: string; receiptCode: string; outcome: string }[]>`
      select inquiry_id, receipt_code, outcome from public.submit_inquiry(${target.siteKey ?? null}, ${target.host ?? null}, ${db.json(payload)}, ${requesterHash(request)}, ${parsed.data.idempotencyKey})`);
    const row = rows[0];
    if (!row) return fail(500, "The inquiry could not be stored.");
    if (isForm) {
      const location = `${next}${next.includes("?") ? "&" : "?"}sent=${encodeURIComponent(row.receiptCode)}`;
      return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
    }
    return json({ receipt: row.receiptCode, outcome: row.outcome }, row.outcome === "duplicate" ? 200 : 201);
  } catch (err) {
    const d = describeDbError(err);
    if (d.code === "rate_limited") return fail(429, "Too many submissions from this connection. Please wait a few minutes and try again.");
    if (d.code === "not_found") return fail(404, "This site does not accept inquiries.");
    if (d.code === "invalid") return fail(422, d.message);
    return fail(500, "The inquiry could not be stored. Please try again.");
  }
}
