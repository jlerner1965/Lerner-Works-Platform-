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
import { ChangeSummaryList, ExcludedList } from "@/components/admin/publish-summary";

export const dynamic = "force-dynamic";

export default async function CandidatePage({ params }: { params: Promise<{ siteId: string; candidateId: string }> }) {
  const { siteId, candidateId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/publishing/candidates/${candidateId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canPublish) notFound();
  const cand = await withUser(user.id, (db) => getCandidate(db, candidateId));
  if (!cand || cand.siteId !== siteId) notFound();
  const idempotencyKey = crypto.randomUUID();
  const notes = cand.selection.notes ?? [];
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
          <ChangeSummaryList summary={cand.summary} mediaTitle={(id) => cand.manifest.media[id]?.title || id.slice(0, 8)} />
          <ExcludedList siteId={siteId} notes={notes} />
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
