import { getSessionUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { buildOnboardingWorkbook } from "@/server/import/onboarding";

export const dynamic = "force-dynamic";

/** The onboarding workbook for this site's preset (site-building programme B5-3): the package's sheets as one Excel file. */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) return new Response("Not found", { status: 404 });
  const workbook = buildOnboardingWorkbook(ctx.site.preset, ctx.site.name);
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="onboarding-${ctx.site.key}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
