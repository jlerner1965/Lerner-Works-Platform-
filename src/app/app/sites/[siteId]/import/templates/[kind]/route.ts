import { getSessionUser } from "@/server/auth/session";
import { templateCsv, isImportableKind } from "@/server/import/csv-spec";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; kind: string }> }) {
  const { kind } = await params;
  if (!(await getSessionUser())) return new Response("Unauthorized", { status: 401 });
  if (!isImportableKind(kind)) return new Response("Not found", { status: 404 });
  return new Response(templateCsv(kind), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-import-template.csv"`, "Cache-Control": "private, no-store" } });
}
