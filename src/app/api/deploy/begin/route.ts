import { withUser } from "@/server/data/db";
import { beginUploadSession } from "@/server/uploaded/sessions";
import { deployJson, withDeployContext } from "@/server/uploaded/deploy-route";

export const dynamic = "force-dynamic";

/** Opens a deploy (B9): the CI learns the part size and count, then sends the parts. */
export async function POST(request: Request) {
  let body: { filename?: unknown; size?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return deployJson({ ok: false, error: "Send JSON: {\"filename\": \"site.zip\", \"size\": <bytes>}." }, 400);
  }
  return withDeployContext(request, async (ctx, userId) => {
    const session = await withUser(userId, (db) => beginUploadSession(db, ctx, userId, { filename: typeof body.filename === "string" ? body.filename : "site.zip", size: Number(body.size) }));
    return deployJson({ ok: true, session: session.id, partBytes: session.partBytes, parts: session.parts });
  });
}
