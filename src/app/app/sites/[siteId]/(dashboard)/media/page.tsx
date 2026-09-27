import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { UploadForm } from "@/components/admin/upload-form";
import { formatBytes } from "@/server/media/content-types";

export const dynamic = "force-dynamic";

/**
 * The media library: many files uploaded at once with one alt-text pass (B2-3), then the grid
 * with what each file still needs. Pictures and documents (PDF, B5-1) share the library; a
 * document shows its type and size in place of a thumbnail.
 */
export default async function MediaLibraryPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ needs?: string; kind?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/media`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  const needs = sp.needs === "alt" || sp.needs === "license" ? sp.needs : null;
  const kindFilter = sp.kind === "image" || sp.kind === "document" ? sp.kind : null;
  const assets = await withUser(user.id, (db) => db<Array<{ id: string; title: string | null; altText: string | null; decorative: boolean; license: string | null; width: number | null; height: number | null; byteSize: number; status: string; kind: "image" | "document"; derivatives: Record<string, { key: string }>; createdAt: Date }>>`
    select id, title, alt_text, decorative, license, width, height, byte_size, status::text, kind::text, derivatives, created_at from public.media_assets where site_id = ${siteId} order by created_at desc limit 300`);
  const images = assets.filter((a) => a.kind !== "document");
  const documents = assets.filter((a) => a.kind === "document");
  const needsAlt = images.filter((a) => a.status !== "withdrawn" && !a.decorative && !a.altText);
  const needsLicense = assets.filter((a) => a.status !== "withdrawn" && !a.license);
  const shown = needs === "alt" ? needsAlt : needs === "license" ? needsLicense : kindFilter ? assets.filter((a) => a.kind === kindFilter) : assets;
  const base = `/app/sites/${siteId}/media`;
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="Media" description="Pictures and PDF documents. Uploads stay private until a release that references them is activated; publication copies the web derivatives and documents to public, immutable content-hash addresses. Do not upload confidential files." />
      <Card title="Upload pictures and documents">
        <UploadForm siteId={siteId} />
      </Card>
      <div className="mt-4">
        {assets.length > 0 ? (
          <p className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span>
              {kindFilter === "image" || !documents.length ? count(images.length, "image") : kindFilter === "document" ? count(documents.length, "document") : `${count(images.length, "image")}, ${count(documents.length, "document")}`}.
            </span>
            {documents.length && !kindFilter && !needs ? (
              <>
                <Link href={`${base}?kind=image`} className="text-action underline">Pictures only</Link>
                <Link href={`${base}?kind=document`} className="text-action underline">Documents only</Link>
              </>
            ) : null}
            {needsAlt.length ? <Link href={`${base}?needs=alt`} className="text-action underline">{needsAlt.length} need alternative text</Link> : <span className="text-ink-muted">Every image has alternative text or is decorative.</span>}
            {needsLicense.length ? <Link href={`${base}?needs=license`} className="text-action underline">{needsLicense.length} need a license</Link> : null}
            {needs || kindFilter ? <Link href={base} className="text-action underline">Show all</Link> : null}
          </p>
        ) : null}
        {assets.length === 0 ? (
          <EmptyState title="No files yet" description="Upload JPEG, PNG or WebP pictures up to 10 MB and PDF documents up to 25 MB, many at a time. Each picture needs alternative text (or a decorative designation), and every file needs a recorded license before it can be published." />
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing needs that. <Link href={base} className="text-action underline">Show all files</Link>.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((a) => (
              <li key={a.id} className="rounded border border-line bg-surface">
                <Link href={`${base}/${a.id}`} className="block">
                  {a.kind === "document" ? (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-t bg-surface-raised text-ink-subtle" aria-label="PDF document">
                      <span className="rounded border border-line-strong px-2 py-1 text-sm font-bold uppercase tracking-wider">PDF</span>
                      <span className="text-xs">{a.status === "withdrawn" ? "Withdrawn" : formatBytes(a.byteSize)}</span>
                    </div>
                  ) : a.derivatives.w480 && a.status !== "withdrawn" ? (
                    <img src={`${base}/${a.id}/file/w480`} alt={a.altText ?? ""} width={a.width ?? undefined} height={a.height ?? undefined} className="aspect-[4/3] w-full rounded-t object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-t bg-surface-raised text-sm text-ink-subtle">{a.status === "withdrawn" ? "Withdrawn" : "Processing"}</div>
                  )}
                  <div className="p-2 text-sm">
                    <p className="truncate font-medium">{a.title || a.id.slice(0, 8)}</p>
                    <p className="text-xs text-ink-subtle">{a.kind === "document" ? `PDF · ${formatBytes(a.byteSize)}` : `${a.width}×${a.height} · ${Math.round(a.byteSize / 1024)} KB`}</p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {a.kind === "document" ? <Badge tone="neutral">document</Badge> : a.decorative ? <Badge tone="neutral">decorative</Badge> : a.altText ? <Badge tone="success">alt text</Badge> : <Badge tone="warning">no alt text</Badge>}
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
    </>
  );
}
