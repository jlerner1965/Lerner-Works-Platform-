import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { findAssetUsage } from "@/server/media/ingest";
import { Badge, Card, DescriptionList, PageHeader, formatDateTime } from "@/components/admin/ui";
import { MediaMetadataForm, WithdrawForm } from "@/components/admin/media-forms";

export const dynamic = "force-dynamic";

export default async function MediaAssetPage({ params }: { params: Promise<{ siteId: string; assetId: string }> }) {
  const { siteId, assetId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/media/${assetId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) notFound();
  const data = await withUser(user.id, async (db) => {
    const [asset] = await db<Array<{ id: string; title: string | null; altText: string | null; decorative: boolean; attributionText: string | null; license: string | null; sourceUrl: string | null; width: number; height: number; byteSize: number; mimeType: string; sha256: string; status: string; withdrawnReason: string | null; derivatives: Record<string, { width: number; height: number; bytes: number }>; createdAt: Date }>>`
      select id, title, alt_text, decorative, attribution_text, license, source_url, width, height, byte_size, mime_type, sha256, status::text, withdrawn_reason, derivatives, created_at
      from public.media_assets where id = ${assetId} and site_id = ${siteId}`;
    if (!asset) return null;
    const usage = await findAssetUsage(db, siteId, assetId);
    const releases = await db<{ version: number }[]>`select version from public.releases where site_id = ${siteId} and (snapshot->'media') ? ${assetId} order by version desc limit 20`;
    return { asset, usage, releases };
  });
  if (!data) notFound();
  const { asset } = data;
  const base = `/app/sites/${siteId}/media`;
  return (
    <>
      <PageHeader eyebrow={`${ctx.site.name} · Media`} title={asset.title || asset.id.slice(0, 8)} description={<Link href={base} className="text-action underline">← Media library</Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {asset.status !== "withdrawn" && asset.derivatives.w960 ? (
            <img src={`${base}/${asset.id}/file/w960`} alt={asset.altText ?? ""} width={asset.width} height={asset.height} className="w-full rounded border border-line bg-surface" />
          ) : (
            <div className="rounded border border-line bg-surface p-6 text-sm text-ink-muted">{asset.status === "withdrawn" ? `Withdrawn: ${asset.withdrawnReason}` : "No preview available."}</div>
          )}
          <Card title="Facts" className="mt-4">
            <DescriptionList
              items={[
                { term: "Status", value: <Badge tone={asset.status === "ready" ? "success" : asset.status === "withdrawn" ? "danger" : "neutral"}>{asset.status}</Badge> },
                { term: "Original", value: `${asset.mimeType} · ${asset.width}×${asset.height} · ${Math.round(asset.byteSize / 1024)} KB (private)` },
                { term: "Derivatives", value: Object.entries(asset.derivatives).map(([k, v]) => `${k}: ${v.width}×${v.height} (${Math.round(v.bytes / 1024)} KB)`).join(" · ") || "none" },
                { term: "SHA-256", value: <code className="text-xs">{asset.sha256.slice(0, 24)}…</code> },
                { term: "Uploaded", value: formatDateTime(asset.createdAt, ctx.site.timeZone) },
                { term: "Used by working drafts", value: data.usage.length ? data.usage.map((u) => <span key={u.itemId}><Link href={`/app/sites/${siteId}/content/${u.itemId}`} className="text-action underline">{u.title}</Link> ({u.kind}) </span>) : "not referenced" },
                { term: "In releases", value: data.releases.length ? data.releases.map((r) => `v${r.version}`).join(", ") : "none" },
              ]}
            />
          </Card>
        </div>
        <div>
          <Card title="Metadata">
            <MediaMetadataForm siteId={siteId} assetId={asset.id} values={{ title: asset.title ?? "", altText: asset.altText ?? "", decorative: asset.decorative, attributionText: asset.attributionText ?? "", license: asset.license ?? "", sourceUrl: asset.sourceUrl ?? "" }} disabled={asset.status === "withdrawn"} />
          </Card>
          {ctx.capabilities.isOwner && asset.status !== "withdrawn" ? (
            <Card title="Withdraw (rights or privacy)" className="mt-4">
              <p className="mb-2 text-sm text-ink-muted">Withdrawing marks the asset unusable for new releases and blocks restoration of releases that contain it. Public derivatives already published stay until a new release replaces them.</p>
              <WithdrawForm siteId={siteId} assetId={asset.id} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
