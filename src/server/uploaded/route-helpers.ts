import { getSessionUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext, type SiteContext } from "@/server/data/access";
import { assertUploadAllowed } from "./intake";

/**
 * The small JSON endpoints of a large upload (B8) share one guard: a signed-in person, a
 * same-origin request, a site they may publish, of the uploaded kind. Failures answer JSON
 * the uploader shows as they are.
 */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function withUploadContext(request: Request, siteId: string, fn: (ctx: SiteContext, userId: string, db: Parameters<Parameters<typeof withUser>[1]>[0]) => Promise<Response>): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in again to continue." }, 401);
  const origin = request.headers.get("sec-fetch-site");
  if (origin && origin !== "same-origin") return json({ error: "Forbidden" }, 403);
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return json({ error: "The site was not found." }, 404);
  try {
    return await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx) return json({ error: "The site was not found." }, 404);
      assertUploadAllowed(ctx);
      return fn(ctx, user.id, db);
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : describeDbError(err).message }, 400);
  }
}
