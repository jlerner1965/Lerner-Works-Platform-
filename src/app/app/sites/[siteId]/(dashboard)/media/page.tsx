import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { UploadForm } from "@/components/admin/upload-form";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/media`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  const assets = await withUser(user.id, (db) => db<Array<{ id: string; title: string | null; altText: string | null; decorative: boolean; license: string | null; width: number; height: number; byteSize: number; status: string; derivatives: Record<string, { key: string }>; createdAt: Date }>>`
    select id, title, alt_text, decorative, license, width, height, byte_size, status::text, derivatives, created_at from public.media_assets where site_id = ${siteId} order by created_at desc limit 200`);
  const base = `/app/sites/${siteId}/media`;
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="Media" description="Uploads stay private until a release that references them is activated; publication copies the web derivatives to public, immutable content-hash addresses. Do not upload confidential images." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {assets.length === 0 ? (
            <EmptyState title="No images yet" description="Upload JPEG, PNG or WebP images up to 10 MB. Each image needs alternative text (or a decorative designation) and a recorded license before it can be published." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((a) => (
                <li key={a.id} className="rounded border border-line bg-surface">
                  <Link href={`${base}/${a.id}`} className="block">
                    {a.derivatives.w480 && a.status !== "withdrawn" ? (
                      <img src={`${base}/${a.id}/file/w480`} alt={a.altText ?? ""} width={a.width} height={a.height} className="aspect-[4/3] w-full rounded-t object-cover" loading="lazy" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center rounded-t bg-surface-raised text-sm text-ink-subtle">{a.status === "withdrawn" ? "Withdrawn" : "Processing"}</div>
                    )}
                    <div className="p-2 text-sm">
                      <p className="truncate font-medium">{a.title || a.id.slice(0, 8)}</p>
                      <p className="text-xs text-ink-subtle">{a.width}×{a.height} · {Math.round(a.byteSize / 1024)} KB</p>
                      <p className="mt-1 flex flex-wrap gap-1">
                        {a.decorative ? <Badge tone="neutral">decorative</Badge> : a.altText ? <Badge tone="success">alt text</Badge> : <Badge tone="warning">no alt text</Badge>}
                        {a.license ? <Badge tone="success">licensed</Badge> : <Badge tone="warning">no license</Badge>}
                        {a.status === "withdrawn" ? <Badge tone="danger">withdrawn</Badge> : null}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card title="Upload an image">
          <UploadForm siteId={siteId} />
        </Card>
      </div>
    </>
  );
}
