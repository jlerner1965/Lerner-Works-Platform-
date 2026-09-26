import crypto from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCandidate, isWaived } from "@/server/publishing/candidates";
import { discardCandidateAction } from "@/server/actions/publishing";
import { Alert, Badge, Button, Card, LinkButton, PageHeader, formatDateTime } from "@/components/admin/ui";
import { ActivateForm, WaiveForm } from "@/components/admin/publishing-forms";
import { kindRegistry, type ContentKind } from "@/modules/registry";

export const dynamic = "force-dynamic";

export default async function CandidatePage({ params }: { params: Promise<{ siteId: string; candidateId: string }> }) {
  const { siteId, candidateId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/publishing/candidates/${candidateId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canPublish) notFound();
  const cand = await withUser(user.id, (db) => getCandidate(db, candidateId));
  if (!cand || cand.siteId !== siteId) notFound();
  const idempotencyKey = crypto.randomUUID();
  const s = cand.summary;
  const notes = cand.selection.notes ?? [];
  const excluded = notes.filter((n) => n.note === "excluded_unapproved" || n.note === "unapproved_newer_draft");
  const isOpen = cand.state === "ready" || cand.state === "blocked";
  const base = `/app/sites/${siteId}`;
  return (
    <>
      <PageHeader
        eyebrow={`${ctx.site.name} · Publishing`}
        title={`Candidate ${cand.id.slice(0, 8)}`}
        description={<span><Link href={`${base}/publishing`} className="text-action underline">← Publishing</Link> · built {formatDateTime(cand.createdAt, ctx.site.timeZone)} · manifest hash <code>{cand.manifestHash.slice(0, 16)}</code> · base {cand.baseReleaseId ? `release ${cand.baseReleaseId.slice(0, 8)}` : "none (first release)"}</span>}
        actions={
          <>
            <LinkButton variant="secondary" href={`${base}/previews/${cand.id}`}>Preview frozen candidate</LinkButton>
            {isOpen ? (
              <form action={discardCandidateAction}>
                <input type="hidden" name="candidateId" value={cand.id} />
                <input type="hidden" name="siteId" value={siteId} />
                <Button type="submit" variant="danger">Discard</Button>
              </form>
            ) : null}
          </>
        }
      />
      <div className="mb-4">
        {cand.state === "ready" ? <Alert tone="success">Ready to activate. {cand.validation.warnings.length ? `${cand.validation.warnings.length} warning(s) below can be waived with a reason.` : "No warnings."}</Alert> : null}
        {cand.state === "blocked" ? <Alert tone="danger" title="Blocked">Fix the blockers below, then build a new candidate. Blockers cannot be waived.</Alert> : null}
        {cand.state === "activated" ? (
          <Alert tone="success" title="Release activated">
            Activated as release {cand.activatedReleaseId?.slice(0, 8)} at {formatDateTime(cand.activatedAt, ctx.site.timeZone)}.{" "}
            {ctx.site.mode === "demo" ? <a href={`/demo/${ctx.site.key}`} target="_blank" rel="noreferrer" className="underline">Open the published site</a> : "The live domain serves it now."}{" "}
            <Link href={`${base}/publishing/releases/${cand.activatedReleaseId}`} className="underline">Release details</Link>
          </Alert>
        ) : null}
        {cand.state === "superseded" ? <Alert tone="warning">Superseded: another release was activated after this candidate was built. Build a new candidate to publish current approved changes.</Alert> : null}
        {cand.state === "discarded" ? <Alert tone="neutral">Discarded.</Alert> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Change summary">
          {s.firstRelease ? <p className="mb-2 text-sm"><Badge tone="info">First release</Badge> Everything below is new.</p> : null}
          <SummaryList title="Added" items={s.added.map((a) => `${a.kind}: ${a.title}${a.path ? ` (${a.path})` : " (no public route)"}`)} />
          <SummaryList title="Changed" items={s.changed.map((c) => `${c.kind}: ${c.title} — ${c.fields.length ? c.fields.join(", ") : "no field changes"}`)} />
          <SummaryList title="Removed" items={s.removed.map((r) => `${r.kind}: ${r.title}${r.path ? ` (${r.path})` : ""}`)} />
          <SummaryList title="Removed routes" items={s.removedRoutes} />
          <SummaryList title="New redirects" items={s.newRedirects.map((r) => `${r.from} → ${r.to}`)} />
          {s.navigationChanged ? <div className="mb-3 text-sm"><p className="font-medium">Navigation changed</p><p className="text-ink-muted">Before: {s.navigationChanged.before.join(" · ") || "none"}</p><p className="text-ink-muted">After: {s.navigationChanged.after.join(" · ") || "none"}</p></div> : null}
          <SummaryList title="Configuration changed" items={s.configFields} />
          <SummaryList title="Media added" items={s.mediaAdded.map((id) => cand.manifest.media[id]?.title || id.slice(0, 8))} />
          <SummaryList title="Media changed (focal point or details)" items={(s.mediaChanged ?? []).map((id) => cand.manifest.media[id]?.title || id.slice(0, 8))} />
          {!s.firstRelease && s.added.length + s.changed.length + s.removed.length + s.configFields.length + s.mediaAdded.length + (s.mediaChanged?.length ?? 0) === 0 && !s.navigationChanged ? <p className="text-sm text-ink-muted">No differences from the active release.</p> : null}
          {excluded.length ? (
            <div className="mt-3 rounded border border-warning/40 bg-warning-soft p-3 text-sm">
              <p className="font-medium">Not included (unapproved)</p>
              <ul className="mt-1 list-disc pl-5">
                {excluded.map((n) => (
                  <li key={n.itemId}>{kindRegistry[n.kind as ContentKind].label}: <Link href={`${base}/content/${n.itemId}`} className="underline">{n.title}</Link> — {n.note === "excluded_unapproved" ? "new item whose latest revision is not approved" : "the published version stays; the newer draft is not approved"}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
        <Card title="Findings">
          {cand.validation.blockers.length === 0 && cand.validation.warnings.length === 0 ? <p className="text-sm text-ink-muted">No findings.</p> : null}
          {cand.validation.blockers.length ? (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-danger">Blockers ({cand.validation.blockers.length})</p>
              <ul className="space-y-2 text-sm">
                {cand.validation.blockers.map((f, i) => (
                  <li key={i} className="rounded border border-danger/40 bg-danger-soft p-2">
                    <p>{f.message}</p>
                    <p className="text-xs text-ink-muted">{f.itemTitle ? `${f.itemTitle} · ` : ""}{f.field ? `field ${f.field} · ` : ""}<Link href={f.href} className="text-action underline">Fix</Link></p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {cand.validation.warnings.length ? (
            <div>
              <p className="mb-1 text-sm font-semibold text-warning">Warnings ({cand.validation.warnings.length})</p>
              <ul className="space-y-2 text-sm">
                {cand.validation.warnings.map((f, i) => {
                  const waived = isWaived(cand, f);
                  return (
                    <li key={i} className={`rounded border p-2 ${waived ? "border-line bg-surface-muted" : "border-warning/40 bg-warning-soft"}`}>
                      <p>{f.message}{waived ? <Badge tone="neutral"> waived</Badge> : null}</p>
                      <p className="text-xs text-ink-muted">{f.itemTitle ? `${f.itemTitle} · ` : ""}{f.field ? `field ${f.field} · ` : ""}<Link href={f.href} className="text-action underline">Fix</Link></p>
                      {waived ? <p className="text-xs text-ink-subtle">Reason: {cand.waivers.find((w) => w.code === f.code && w.itemId === f.itemId && w.field === f.field)?.reason}</p> : isOpen ? <WaiveForm candidateId={cand.id} finding={{ code: f.code, itemId: f.itemId, field: f.field }} /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
      {cand.state === "ready" ? (
        <Card title="Activate" className="mt-4">
          <ActivateForm siteId={siteId} candidateId={cand.id} idempotencyKey={idempotencyKey} demoUrl={ctx.site.mode === "demo" ? `/demo/${ctx.site.key}` : null} unwaived={cand.validation.warnings.filter((w) => !isWaived(cand, w)).length} />
        </Card>
      ) : null}
      <Card title="Frozen manifest" className="mt-4">
        <p className="text-sm text-ink-muted">{Object.keys(cand.manifest.items).length} items · {cand.manifest.routes.length} routes · {cand.manifest.redirects.length} redirects · {Object.keys(cand.manifest.media).length} media assets · schema v{cand.schemaVersion}</p>
        <details className="mt-2 text-sm"><summary className="cursor-pointer text-action underline">Routes</summary><ul className="mt-1 columns-2 text-xs">{cand.manifest.routes.map((r) => <li key={r.path}>{r.path}</li>)}</ul></details>
      </Card>
    </>
  );
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
