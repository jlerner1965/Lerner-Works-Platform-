"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveItemAction, reviewAction, type SaveState, type ReviewActionState } from "@/server/actions/content";
import type { EditorContext, Issues, Payload } from "@/components/admin/editor/types";
import { KindFields, CommonFields } from "@/components/admin/editor/kind-fields";
import { Alert, Badge, Button, LinkButton, formatDateTime } from "@/components/admin/ui";
import type { ContentKind } from "@/modules/registry";

export interface ItemEditorProps {
  siteId: string;
  preset: "community_guide" | "location_business";
  kindLabel: string;
  item: { id: string; kind: ContentKind; archivedAt: string | null };
  revision: { id: string; version: number; createdAt: string; payload: Payload };
  reviewState: "unsubmitted" | "submitted" | "comment" | "changes_requested" | "approved";
  reviews: Array<{ id: string; state: string; comment: string | null; actorEmail: string; createdAt: string; revisionVersion: number }>;
  publishedRevisionId: string | null;
  capabilities: { canEdit: boolean; canReview: boolean; canPublish: boolean };
  ctx: EditorContext;
  timeZone: string;
  isOwnRevision: boolean;
}

export function ItemEditor(props: ItemEditorProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload>(props.revision.payload);
  const [base, setBase] = useState(props.revision);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [issues, setIssues] = useState<Issues>({});
  const [changeNote, setChangeNote] = useState("");
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLDivElement>(null);

  const set = useCallback((patch: Payload) => {
    setPayload((p) => ({ ...p, ...patch }));
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = () => {
    startTransition(async () => {
      const result = await saveItemAction({ itemId: props.item.id, baseRevisionId: base.id, payload, changeNote });
      setState(result);
      if (result.status === "saved" && result.revisionId && result.version && result.savedAt) {
        setBase({ id: result.revisionId, version: result.version, createdAt: result.savedAt, payload });
        setDirty(false);
        setIssues({});
        setChangeNote("");
        router.refresh();
      } else if (result.status === "invalid") {
        const map: Issues = {};
        for (const i of result.issues ?? []) map[i.path] ??= i.message;
        setIssues(map);
      }
      statusRef.current?.focus();
    });
  };

  const adoptLatest = () => {
    if (!state.latest) return;
    setBase({ id: state.latest.revisionId, version: state.latest.version, createdAt: state.latest.createdAt, payload: state.latest.payload });
    setState({ status: "idle", message: `Now editing on top of version ${state.latest.version}. Your unsaved input is still in the form; save again to store it.` });
    setDirty(true);
  };

  const reviewTone = props.reviewState === "approved" ? "success" : props.reviewState === "submitted" ? "info" : props.reviewState === "changes_requested" ? "warning" : "neutral";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <div ref={statusRef} tabIndex={-1} aria-live="polite" className="mb-4 space-y-2 outline-none">
          {state.status === "saved" ? <Alert tone="success">Saved version {base.version} at {formatDateTime(base.createdAt, props.timeZone)}. The public page is unchanged until a release includes this revision.</Alert> : null}
          {state.status === "conflict" ? (
            <Alert tone="warning" title="Save conflict" role="alert">
              <p>{state.message}</p>
              {state.latest ? (
                <div className="mt-2 text-sm">
                  <p>Newest saved version: v{state.latest.version} at {formatDateTime(state.latest.createdAt, props.timeZone)}.</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer underline">Compare fields</summary>
                    <ConflictDiff mine={payload} theirs={state.latest.payload} />
                  </details>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={adoptLatest}>Keep my input and save on top of v{state.latest.version}</Button>
                    <Button type="button" variant="secondary" onClick={() => { setPayload(state.latest!.payload); setBase({ id: state.latest!.revisionId, version: state.latest!.version, createdAt: state.latest!.createdAt, payload: state.latest!.payload }); setDirty(false); setState({ status: "idle" }); router.refresh(); }}>Discard my input and load v{state.latest.version}</Button>
                  </div>
                </div>
              ) : null}
            </Alert>
          ) : null}
          {state.status === "invalid" ? <Alert tone="danger" title="Not saved">{state.message} {Object.keys(issues).length ? `Fields: ${Object.keys(issues).join(", ")}.` : ""}</Alert> : null}
          {state.status === "error" ? (
            <Alert tone="danger" title="Save failed">
              <p>{state.message}</p>
              <Button type="button" variant="secondary" className="mt-2" onClick={save} disabled={pending}>Retry</Button>
            </Alert>
          ) : null}
          {state.status === "idle" && state.message ? <Alert tone="info">{state.message}</Alert> : null}
        </div>
        <CommonFields payload={payload} set={set} ctx={props.ctx} issues={issues} kind={props.item.kind} />
        <KindFields kind={props.item.kind} preset={props.preset} payload={payload} set={set} ctx={props.ctx} issues={issues} />
      </div>
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Working revision</p>
          <p className="mt-1 text-sm">v{base.version} · {formatDateTime(base.createdAt, props.timeZone)}</p>
          <p className="mt-1 text-sm">{dirty ? <Badge tone="warning">Unsaved changes</Badge> : <Badge tone="success">All changes saved</Badge>}</p>
          <p className="mt-2 text-sm">Review: <Badge tone={reviewTone}>{props.reviewState.replace("_", " ")}</Badge></p>
          <p className="mt-1 text-sm">Published: {props.publishedRevisionId ? (props.publishedRevisionId === base.id ? <Badge tone="success">this version is live</Badge> : <Badge tone="warning">an older version is live</Badge>) : <Badge tone="neutral">not published</Badge>}</p>
          {props.item.archivedAt ? <p className="mt-2 text-sm text-warning">Archived — it will be removed from the next release.</p> : null}
          {props.capabilities.canEdit ? (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-ink-subtle" htmlFor="change-note">Change note (optional)</label>
              <input id="change-note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className="w-full rounded border border-line-strong px-2 py-1 text-sm" maxLength={300} />
              <Button type="button" onClick={save} disabled={pending || !dirty} className="w-full">{pending ? "Saving…" : "Save draft"}</Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-subtle">You can view but not edit this item.</p>
          )}
          <div className="mt-3 space-y-2">
            <LinkButton variant="secondary" href={`/app/sites/${props.siteId}/content/${props.item.id}/preview`} className="w-full">Preview draft</LinkButton>
            {dirty ? <p className="text-xs text-ink-subtle">Preview shows the last saved version; save first to preview these changes.</p> : null}
          </div>
        </div>
        <ReviewPanel {...props} baseRevisionId={base.id} baseVersion={base.version} dirty={dirty} />
      </aside>
    </div>
  );
}

function ReviewPanel(props: ItemEditorProps & { baseRevisionId: string; baseVersion: number; dirty: boolean }) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(reviewAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state.message) router.refresh();
  }, [state.message, router]);
  const cap = props.capabilities;
  const canSubmit = cap.canEdit && props.reviewState !== "submitted" && props.reviewState !== "approved";
  const canApprove = cap.canPublish && props.reviewState !== "approved";
  const canRequest = cap.canReview && props.reviewState !== "changes_requested";
  return (
    <div className="mt-4 rounded border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Review</p>
      {props.dirty ? <p className="mt-2 text-xs text-warning">Save your changes before submitting or approving; review decisions are tied to a saved version.</p> : null}
      {state.message ? <p role="status" className="mt-2 text-sm text-success">{state.message}</p> : null}
      {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="revisionId" value={props.baseRevisionId} />
        <input type="hidden" name="itemId" value={props.item.id} />
        <label htmlFor="review-comment" className="block text-xs font-medium text-ink-subtle">Comment</label>
        <textarea id="review-comment" name="comment" rows={3} className="w-full rounded border border-line-strong px-2 py-1 text-sm" />
        <div className="flex flex-wrap gap-2">
          {canSubmit ? <Button type="submit" name="state" value="submitted" variant="secondary" disabled={pending || props.dirty}>Request review</Button> : null}
          {cap.canReview || cap.canEdit ? <Button type="submit" name="state" value="comment" variant="ghost" disabled={pending}>Add comment</Button> : null}
          {canRequest ? <Button type="submit" name="state" value="changes_requested" variant="secondary" disabled={pending}>Request changes</Button> : null}
          {canApprove ? <Button type="submit" name="state" value="approved" disabled={pending || props.dirty}>{props.isOwnRevision ? "Approve (own work, audited)" : "Approve v" + props.baseVersion}</Button> : null}
        </div>
      </form>
      {props.reviews.length ? (
        <ol className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
          {props.reviews.map((r) => (
            <li key={r.id}>
              <p><Badge tone={r.state === "approved" ? "success" : r.state === "changes_requested" ? "warning" : "info"}>{r.state.replace("_", " ")}</Badge> <span className="text-ink-subtle">v{r.revisionVersion} · {r.actorEmail} · {formatDateTime(r.createdAt, props.timeZone)}</span></p>
              {r.comment ? <p className="mt-0.5 whitespace-pre-wrap">{r.comment}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      <p className="mt-3 text-xs"><Link href={`/app/sites/${props.siteId}/content/${props.item.id}/history`} className="text-action underline">Revision history</Link></p>
    </div>
  );
}

function ConflictDiff({ mine, theirs }: { mine: Payload; theirs: Payload }) {
  const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((k) => JSON.stringify(mine[k]) !== JSON.stringify(theirs[k]));
  if (keys.length === 0) return <p className="mt-1 text-xs">No field differences between your input and the newest version.</p>;
  return (
    <table className="mt-2 w-full text-xs">
      <thead><tr className="text-left"><th className="pr-2">Field</th><th className="pr-2">Your input</th><th>Newest saved</th></tr></thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="border-t border-line align-top">
            <td className="py-1 pr-2 font-medium">{k}</td>
            <td className="py-1 pr-2"><code className="whitespace-pre-wrap break-all">{JSON.stringify(mine[k])?.slice(0, 300)}</code></td>
            <td className="py-1"><code className="whitespace-pre-wrap break-all">{JSON.stringify(theirs[k])?.slice(0, 300)}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
