import { getSessionUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { buildOnboardingTemplate } from "@/server/import/onboarding";

export const dynamic = "force-dynamic";

/** The onboarding package template for this site's preset (site-building programme B2-2). */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) return new Response("Not found", { status: 404 });
  const zip = buildOnboardingTemplate(ctx.site.preset, ctx.site.name);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="onboarding-${ctx.site.key}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
