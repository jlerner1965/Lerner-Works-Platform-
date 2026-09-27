import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext, type SiteContext } from "@/server/data/access";
import { resolveDeployToken, touchDeployToken, type ResolvedDeployToken } from "./deploy";
import { assertUploadAllowed } from "./intake";

/**
 * The deploy endpoints (B9) share one guard: a deploy token in the Authorization header,
 * resolved to its site and creator; the request then runs as that person, who must still be
 * able to publish the site. Each step of `fn` opens its own transaction (a check that is
 * committed before the publish, so a failed publish leaves the check to look at). Answers
 * are JSON a CI log can show as they are.
 */

export function deployJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function withDeployContext(request: Request, fn: (ctx: SiteContext, userId: string, token: ResolvedDeployToken) => Promise<Response>): Promise<Response> {
  const token = await resolveDeployToken(request.headers.get("authorization")).catch(() => null);
  if (!token) return deployJson({ ok: false, error: "The deploy token is missing, unknown or revoked. Create one on the site's Upload page and send it as Authorization: Bearer <token>." }, 401);
  try {
    const ctx = await withUser(token.createdBy, (db) => loadSiteContext(db, token.siteId));
    if (!ctx) return deployJson({ ok: false, error: "The person who created this token no longer has access to the site, or the site is gone. Create a new token on the site's Upload page." }, 403);
    try {
      assertUploadAllowed(ctx);
    } catch (err) {
      return deployJson({ ok: false, error: `The person who created this token may no longer publish the site: ${err instanceof Error ? err.message : "refused"}` }, 403);
    }
    await touchDeployToken(token.id);
    return await fn(ctx, token.createdBy, token);
  } catch (err) {
    return deployJson({ ok: false, error: err instanceof Error ? err.message : describeDbError(err).message }, 400);
  }
}
