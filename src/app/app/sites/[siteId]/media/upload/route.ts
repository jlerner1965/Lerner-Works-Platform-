import { getSessionUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { ingestImage, MAX_UPLOAD_BYTES } from "@/server/media/ingest";
import { getConfig } from "@/server/config";

export const dynamic = "force-dynamic";

/** Authenticated multipart image upload into private storage for one site. */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return json({ error: "Sign in to upload." }, 401);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return json({ error: "Cross-site uploads are not accepted." }, 403);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      const appHost = new URL(getConfig().APP_URL).host;
      if (o.host !== appHost && o.hostname !== "localhost" && o.hostname !== "127.0.0.1") return json({ error: "Cross-site uploads are not accepted." }, 403);
    } catch {
      return json({ error: "Invalid origin." }, 403);
    }
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: "The upload is larger than 10 MB." }, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The upload could not be read." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose an image file." }, 422);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "The file is larger than 10 MB." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const result = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx || !ctx.capabilities.canEdit) return { status: 404, body: { error: "Site not found." } };
      const ingested = await ingestImage(db, {
        siteId,
        organizationId: ctx.site.organizationId,
        userId: user.id,
        bytes,
        filename: file.name,
        declaredMime: file.type,
        title: String(form.get("title") ?? ""),
        altText: String(form.get("altText") ?? ""),
        decorative: form.get("decorative") === "on" || form.get("decorative") === "true",
        attributionText: String(form.get("attributionText") ?? ""),
        license: String(form.get("license") ?? ""),
        sourceUrl: String(form.get("sourceUrl") ?? ""),
      });
      if (!ingested.ok) return { status: 422, body: { error: ingested.error, code: ingested.code } };
      return { status: 201, body: { asset: { id: ingested.asset.id, title: ingested.asset.title, width: ingested.asset.width, height: ingested.asset.height } } };
    });
    return json(result.body, result.status);
  } catch (err) {
    const d = describeDbError(err);
    return json({ error: d.code === "forbidden" ? "You cannot upload to this site." : "The upload failed. Nothing was stored." }, d.code === "forbidden" ? 403 : 500);
  }
}
