import { beginUploadSession } from "@/server/uploaded/sessions";
import { json, withUploadContext } from "@/server/uploaded/route-helpers";

export const dynamic = "force-dynamic";

/** Opens a large upload (B8): the browser learns the part size and count, then sends the parts. */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  let body: { filename?: unknown; size?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  return withUploadContext(request, siteId, async (ctx, userId, db) => {
    const session = await beginUploadSession(db, ctx, userId, { filename: typeof body.filename === "string" ? body.filename : "site.zip", size: Number(body.size) });
    return json(session);
  });
}
