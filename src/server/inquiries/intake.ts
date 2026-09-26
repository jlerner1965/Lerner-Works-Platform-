import { createHash } from "node:crypto";
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
    return false;
  } catch {
    return false;
  }
}

/**
 * Handles a public inquiry submission for a site resolved from trusted routing. Rejects
 * oversized bodies, cross-site origins, honeypot hits and invalid fields before the
 * transactional SQL function stores the inquiry and its delivery job.
 */
export async function handleInquirySubmission(request: Request, target: IntakeTarget): Promise<Response> {
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return json({ error: "Cross-site submissions are not accepted." }, 403);
  if (!originAllowed(request, target)) return json({ error: "Cross-site submissions are not accepted." }, 403);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return json({ error: "The submission is too large." }, 413);
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ error: "The submission could not be read." }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) return json({ error: "The submission is too large." }, 413);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "The submission was not valid JSON." }, 400);
  }
  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return json({ error: "Please correct the highlighted fields.", fieldErrors }, 422);
  }
  if (parsed.data.website.trim() !== "") return json({ error: "The submission was rejected." }, 400);

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
    if (!row) return json({ error: "The inquiry could not be stored." }, 500);
    return json({ receipt: row.receiptCode, outcome: row.outcome }, row.outcome === "duplicate" ? 200 : 201);
  } catch (err) {
    const d = describeDbError(err);
    if (d.code === "rate_limited") return json({ error: "Too many submissions from this connection. Please wait a few minutes and try again." }, 429);
    if (d.code === "not_found") return json({ error: "This site does not accept inquiries." }, 404);
    if (d.code === "invalid") return json({ error: d.message }, 422);
    return json({ error: "The inquiry could not be stored. Please try again." }, 500);
  }
}
