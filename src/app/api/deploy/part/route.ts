import { withUser } from "@/server/data/db";
import { storeUploadPart } from "@/server/uploaded/sessions";
import { deployJson, withDeployContext } from "@/server/uploaded/deploy-route";

export const dynamic = "force-dynamic";

/** One part of a deploy (B9), sent raw with the session and part number in the query. */
export async function PUT(request: Request) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session") ?? "";
  const index = Number(url.searchParams.get("index"));
  const bytes = new Uint8Array(await request.arrayBuffer());
  return withDeployContext(request, async (ctx, userId) => deployJson({ ok: true, ...(await withUser(userId, (db) => storeUploadPart(db, ctx, userId, session, index, bytes))) }));
}
