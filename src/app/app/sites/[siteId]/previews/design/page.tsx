import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { loadDesignPreview } from "@/server/publishing/design-preview";
import { capabilitiesFor } from "@/themes/capabilities";
import { formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const WIDTHS = [390, 768, 1440] as const;

/**
 * Design preview (D2): the draft configuration rendered over the active release, for the
 * people who may change the design. Nothing here publishes; the public site is untouched
 * until a release is built and activated.
 */
export default async function DesignPreviewPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ w?: string; path?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/previews/design`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canDesign) notFound();
  const preview = await withUser(user.id, (db) => loadDesignPreview(db, ctx.site));
  const width = WIDTHS.find((w) => String(w) === sp.w) ?? 1440;
  const path = sp.path && /^\/[^\s]*$/.test(sp.path) ? sp.path : "/";
  const renderBase = `/app/sites/${siteId}/previews/design/render`;
  const frameSrc = `${renderBase}${path === "/" ? "" : path}`;
  return (
    <div className="flex min-h-screen flex-col bg-surface-raised">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm">
        <Link href={`/app/sites/${siteId}/settings`} className="text-action underline">← Settings</Link>
        <span className="font-medium">Design preview</span>
        {preview ? (
          <span className="text-ink-subtle">
            configuration revision {preview.configVersion} · {capabilitiesFor(ctx.site.preset, preview.snapshot.config.design).label} · over release {preview.release.version} ({formatDateTime(preview.release.createdAt, ctx.site.timeZone)}) · not published
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Viewport width">
          {WIDTHS.map((w) => (
            <Link key={w} href={`?w=${w}&path=${encodeURIComponent(path)}`} aria-current={w === width ? "true" : undefined} className={`rounded border px-2 py-1 ${w === width ? "border-action bg-action-soft text-action" : "border-line-strong hover:bg-surface-muted"}`}>
              {w}px
            </Link>
          ))}
        </div>
        {preview ? <a href={frameSrc} target="_blank" rel="noreferrer" className="text-action underline">Open frame in new tab</a> : null}
      </div>
      {preview ? (
        <div className="flex-1 overflow-auto p-4">
          <iframe
            title={`Design preview at ${width} pixels`}
            src={frameSrc}
            style={{ width: `${width}px`, maxWidth: "100%", height: "calc(100vh - 80px)" }}
            className="mx-auto block border border-line bg-white"
          />
        </div>
      ) : (
        <div className="p-6 text-sm">
          <p className="font-medium">Nothing to preview yet.</p>
          <p className="mt-1 text-ink-muted">The design preview renders the saved configuration over the active release. Publish a first release from <Link href={`/app/sites/${siteId}/publishing`} className="text-action underline">Publishing</Link>, then come back here.</p>
        </div>
      )}
    </div>
  );
}
