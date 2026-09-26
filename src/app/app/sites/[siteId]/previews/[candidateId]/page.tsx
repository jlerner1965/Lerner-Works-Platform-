import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCandidate } from "@/server/publishing/candidates";
import { formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const WIDTHS = [390, 768, 1440] as const;

/** Frozen candidate preview with viewport controls. The frame renders the exact manifest. */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ siteId: string; candidateId: string }>; searchParams: Promise<{ w?: string; path?: string }> }) {
  const { siteId, candidateId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/previews/${candidateId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx) notFound();
  const cand = await withUser(user.id, (db) => getCandidate(db, candidateId));
  if (!cand || cand.siteId !== siteId) notFound();
  const width = WIDTHS.find((w) => String(w) === sp.w) ?? 1440;
  const path = sp.path && /^\/[^\s]*$/.test(sp.path) ? sp.path : "/";
  const renderBase = `/app/sites/${siteId}/previews/${candidateId}/render`;
  const frameSrc = `${renderBase}${path === "/" ? "" : path}`;
  return (
    <div className="flex min-h-screen flex-col bg-surface-raised">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm">
        <Link href={`/app/sites/${siteId}/publishing/candidates/${candidateId}`} className="text-action underline">← Candidate</Link>
        <span className="font-medium">Preview of candidate {candidateId.slice(0, 8)}</span>
        <span className="text-ink-subtle">built {formatDateTime(cand.createdAt, ctx.site.timeZone)} · manifest {cand.manifestHash.slice(0, 12)} · {cand.state}</span>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Viewport width">
          {WIDTHS.map((w) => (
            <Link key={w} href={`?w=${w}&path=${encodeURIComponent(path)}`} aria-current={w === width ? "true" : undefined} className={`rounded border px-2 py-1 ${w === width ? "border-action bg-action-soft text-action" : "border-line-strong hover:bg-surface-muted"}`}>
              {w}px
            </Link>
          ))}
        </div>
        <a href={frameSrc} target="_blank" rel="noreferrer" className="text-action underline">Open frame in new tab</a>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <iframe
          title={`Candidate preview at ${width} pixels`}
          src={frameSrc}
          style={{ width: `${width}px`, maxWidth: "100%", height: "calc(100vh - 80px)" }}
          className="mx-auto block border border-line bg-white"
        />
      </div>
    </div>
  );
}
