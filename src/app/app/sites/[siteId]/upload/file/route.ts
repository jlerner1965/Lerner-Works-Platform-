import { getSessionUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { MAX_ARCHIVE_BYTES } from "@/server/uploaded/archive";
import { assertUploadAllowed, registerUploadedArchive } from "@/server/uploaded/intake";

export const dynamic = "force-dynamic";

function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}

/**
 * Uploads a site's ZIP in one request (B7): the path a browser without script takes, and the
 * one for small files. A hosted function accepts at most 4.5 MB this way; the uploader on
 * the page sends larger files in parts (B8, `upload/begin`, `upload/part`, `upload/complete`).
 * The archive is inspected without writing anything to the site, the inspection is stored on
 * an upload job, the archive is kept privately until the job is published or dropped, and the
 * browser lands on the job page.
 */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return redirectTo(`/sign-in?next=${encodeURIComponent(`/app/sites/${siteId}/upload`)}`);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const root = String(form.get("root") ?? "").trim() || null;
  const back = (msg: string) => redirectTo(`/app/sites/${siteId}/upload?error=${encodeURIComponent(msg)}`);
  if (!(file instanceof File) || file.size === 0) return back("Choose the ZIP of the site to upload.");
  if (file.size > MAX_ARCHIVE_BYTES) return back(`The ZIP is larger than ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
  try {
    const jobId = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      assertUploadAllowed(ctx);
      const bytes = new Uint8Array(await file.arrayBuffer());
      return (await registerUploadedArchive(db, ctx, user.id, { filename: file.name, bytes, root })).jobId;
    });
    return redirectTo(`/app/sites/${siteId}/upload/${jobId}`);
  } catch (err) {
    return back(err instanceof Error ? err.message : describeDbError(err).message);
  }
}
