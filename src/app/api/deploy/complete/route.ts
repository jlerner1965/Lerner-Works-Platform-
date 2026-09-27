import { previewOrigin } from "@/server/config";
import { withUser } from "@/server/data/db";
import { completeUploadSession } from "@/server/uploaded/sessions";
import { publishCheckedJob } from "@/server/uploaded/publish-job";
import { deployJson, withDeployContext } from "@/server/uploaded/deploy-route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Completes a deploy (B9): the parts are assembled and checked in one transaction, and a
 * clean check is published in a second as the next release, with the commit the CI names on
 * the release. A refused site leaves its check on the site's Upload page.
 */
export async function POST(request: Request) {
  let body: { session?: unknown; root?: unknown; commit?: unknown; ref?: unknown; message?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return deployJson({ ok: false, error: "Send JSON: {\"session\": \"<id>\", \"commit\": \"<sha>\", \"ref\": \"<branch>\"}." }, 400);
  }
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return withDeployContext(request, async (ctx, userId, token) => {
    const check = await withUser(userId, (db) => completeUploadSession(db, ctx, userId, typeof body.session === "string" ? body.session : "", { root: text(body.root, 200) || null }));
    if (!check.ok) return deployJson({ ok: false, error: "The site cannot be published; fix these and deploy again.", errors: check.errors, jobId: check.jobId }, 422);
    const commit = /^[0-9a-f]{7,64}$/i.test(text(body.commit, 64)) ? text(body.commit, 64) : null;
    const ref = text(body.ref, 200) || null;
    const message = text(body.message, 200) || null;
    const reason = `Push to deploy${token.label ? ` (${token.label})` : ""}${ref ? `: ${ref}` : ""}${commit ? ` @ ${commit.slice(0, 7)}` : ""}${message ? `, ${message}` : ""}`.slice(0, 300);
    const published = await withUser(userId, (db) => publishCheckedJob(db, ctx, userId, check.jobId, { reason, deploy: { label: token.label, commit, ref } }));
    if (!published.ok) return deployJson({ ok: false, error: published.error, jobId: check.jobId }, 422);
    const preview = previewOrigin(ctx.site.key);
    return deployJson({ ok: true, version: published.version, releaseId: published.releaseId, files: published.files, totalBytes: published.totalBytes, preview: preview ? `${preview}/` : null, jobId: check.jobId });
  });
}
