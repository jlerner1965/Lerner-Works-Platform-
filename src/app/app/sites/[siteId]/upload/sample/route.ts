import { getSessionUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { sampleUploadedSiteZip } from "@/server/demo/uploaded-sample";

export const dynamic = "force-dynamic";

/** The sample site's ZIP (B7), for a first upload to try the flow with. */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx?.capabilities.canPublish) return new Response("Not found", { status: 404 });
  return new Response(sampleUploadedSiteZip() as unknown as BodyInit, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="harbor-lane-studio.zip"', "Cache-Control": "no-store" },
  });
}
