import { handleInquirySubmission } from "@/server/inquiries/intake";
import { normalizeHost } from "@/server/publishing/public-site";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ host: string }> }) {
  if (request.headers.get("x-lw-host-routing") !== "1") return new Response("Not found", { status: 404 });
  const { host } = await params;
  const normalized = normalizeHost(host);
  if (!normalized) return new Response("Not found", { status: 404 });
  return handleInquirySubmission(request, { host: normalized });
}
