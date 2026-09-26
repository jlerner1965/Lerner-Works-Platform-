import Link from "next/link";
import type { ChangeSummary } from "@/server/publishing/diff";
import { kindRegistry, type ContentKind } from "@/modules/registry";
import { Badge } from "@/components/admin/ui";

/** The human-readable change summary of a candidate or a candidate preview, shared by the Publish page and the candidate page. */
export function ChangeSummaryList({ summary, mediaTitle }: { summary: ChangeSummary; mediaTitle: (assetId: string) => string }) {
  const s = summary;
  const empty = !s.firstRelease && s.added.length + s.changed.length + s.removed.length + s.configFields.length + s.mediaAdded.length + (s.mediaChanged?.length ?? 0) + s.mediaRemoved.length === 0 && !s.navigationChanged;
  return (
    <div>
      {s.firstRelease ? <p className="mb-2 text-sm"><Badge tone="info">First release</Badge> Everything below is new.</p> : null}
      <SummaryList title="Added" items={s.added.map((a) => `${kindLabel(a.kind)}: ${a.title}${a.path ? ` (${a.path})` : " (no public route)"}`)} />
      <SummaryList title="Changed" items={s.changed.map((c) => `${kindLabel(c.kind)}: ${c.title} — ${c.fields.length ? c.fields.join(", ") : "no field changes"}`)} />
      <SummaryList title="Removed" items={s.removed.map((r) => `${kindLabel(r.kind)}: ${r.title}${r.path ? ` (${r.path})` : ""}`)} />
      <SummaryList title="Removed routes" items={s.removedRoutes} />
      <SummaryList title="New redirects" items={s.newRedirects.map((r) => `${r.from} → ${r.to}`)} />
      {s.navigationChanged ? (
        <div className="mb-3 text-sm">
          <p className="font-medium">Navigation changed</p>
          <p className="text-ink-muted">Before: {s.navigationChanged.before.join(" · ") || "none"}</p>
          <p className="text-ink-muted">After: {s.navigationChanged.after.join(" · ") || "none"}</p>
        </div>
      ) : null}
      <SummaryList title="Configuration changed" items={s.configFields} />
      <SummaryList title="Media added" items={s.mediaAdded.map(mediaTitle)} />
      <SummaryList title="Media changed (focal point or details)" items={(s.mediaChanged ?? []).map(mediaTitle)} />
      <SummaryList title="Media removed" items={s.mediaRemoved.map(mediaTitle)} />
      {empty ? <p className="text-sm text-ink-muted">No differences from the active release.</p> : null}
    </div>
  );
}

function kindLabel(kind: string): string {
  return (kindRegistry as Record<string, { label: string }>)[kind as ContentKind]?.label ?? kind;
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 text-sm">
      <p className="font-medium">{title} ({items.length})</p>
      <ul className="list-disc pl-5 text-ink-muted">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>
    </div>
  );
}

/** Items whose latest work is not approved and therefore not part of the next release. */
export function ExcludedList({ siteId, notes }: { siteId: string; notes: Array<{ itemId: string; title: string; kind: string; note: string }> }) {
  const excluded = notes.filter((n) => n.note === "excluded_unapproved" || n.note === "unapproved_newer_draft");
  if (excluded.length === 0) return null;
  return (
    <div className="mt-3 rounded border border-warning/40 bg-warning-soft p-3 text-sm">
      <p className="font-medium">Waiting for approval, not included ({excluded.length})</p>
      <ul className="mt-1 list-disc pl-5">
        {excluded.map((n) => (
          <li key={n.itemId}>
            {kindLabel(n.kind)}: <Link href={`/app/sites/${siteId}/content/${n.itemId}`} className="underline">{n.title}</Link> — {n.note === "excluded_unapproved" ? "new item whose latest version is not approved" : "the published version stays; the newer draft is not approved"}
          </li>
        ))}
      </ul>
    </div>
  );
}
