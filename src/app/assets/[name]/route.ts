import { getStorage } from "@/server/media/storage";
import { publicAssetHeaders } from "@/server/media/content-types";

export const dynamic = "force-dynamic";

/** Immutable published derivatives addressed by content hash: image variants and documents (B5-1). */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const data = publicAssetHeaders(name, 0) ? await getStorage().getPublic(name) : null;
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as BodyInit, { headers: publicAssetHeaders(name, data.byteLength)! });
}
