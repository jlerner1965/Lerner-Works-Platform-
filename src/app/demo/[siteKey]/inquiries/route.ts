import { handleInquirySubmission } from "@/server/inquiries/intake";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  return handleInquirySubmission(request, { siteKey });
}
