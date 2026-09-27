import { completeUploadSession } from "@/server/uploaded/sessions";
import { json, withUploadContext } from "@/server/uploaded/route-helpers";

export const dynamic = "force-dynamic";

/** Completes a large upload (B8): the parts are assembled and checked; the answer names the page to open. */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  let body: { session?: unknown; root?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  return withUploadContext(request, siteId, async (ctx, userId, db) => {
    const result = await completeUploadSession(db, ctx, userId, typeof body.session === "string" ? body.session : "", { root: typeof body.root === "string" ? body.root : null });
    return json({ jobId: result.jobId, ok: result.ok, redirect: `/app/sites/${siteId}/upload/${result.jobId}` });
  });
}
