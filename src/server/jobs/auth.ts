import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/server/config";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function equalSecrets(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Guards the scheduled job endpoints. The caller (Vercel Cron or any scheduler) must send
 * `Authorization: Bearer <JOB_TRIGGER_SECRET>`; Vercel supplies its CRON_SECRET the same way.
 * Returns a response to send when the request is not authorized, otherwise null.
 */
export function authorizeJobRequest(request: Request): Response | null {
  const secret = getConfig().jobTriggerSecret;
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, error: "scheduled jobs are not configured: set JOB_TRIGGER_SECRET" }), { status: 503, headers: JSON_HEADERS });
  }
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const supplied = match?.[1]?.trim() ?? "";
  if (!supplied || !equalSecrets(supplied, secret)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
  }
  return null;
}

export function jobResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
