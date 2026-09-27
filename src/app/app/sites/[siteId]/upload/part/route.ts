import { storeUploadPart } from "@/server/uploaded/sessions";
import { json, withUploadContext } from "@/server/uploaded/route-helpers";

export const dynamic = "force-dynamic";

/** One part of a large upload (B8), sent raw with the session and part number in the query. */
export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const session = url.searchParams.get("session") ?? "";
  const index = Number(url.searchParams.get("index"));
  const bytes = new Uint8Array(await request.arrayBuffer());
  return withUploadContext(request, siteId, async (ctx, userId, db) => json(await storeUploadPart(db, ctx, userId, session, index, bytes)));
}
