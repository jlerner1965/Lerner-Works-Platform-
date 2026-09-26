import { getStorage } from "@/server/media/storage";

export const dynamic = "force-dynamic";

const NAME = /^[0-9a-f]{64}-w(480|960|1600)\.webp$/;

/** Immutable published derivatives addressed by content hash. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME.test(name)) return new Response("Not found", { status: 404 });
  const data = await getStorage().getPublic(name);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
