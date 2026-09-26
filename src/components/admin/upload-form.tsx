"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAltTextBatchAction, type AltTextBatchState } from "@/server/actions/media";
import { Alert, Button, inputClass } from "@/components/admin/ui";

const MAX_FILES = 50;
const MAX_BYTES = 10 * 1024 * 1024;

interface Upload {
  key: string;
  file: File;
  status: "queued" | "uploading" | "done" | "failed";
  progress: number;
  asset?: { id: string; title: string; width: number; height: number };
  error?: string;
}

function uploadOne(siteId: string, file: File, shared: FormData, onProgress: (p: number) => void): Promise<{ ok: true; asset: NonNullable<Upload["asset"]> } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const data = new FormData();
    for (const [k, v] of shared.entries()) data.set(k, v);
    data.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/app/sites/${siteId}/media/upload`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      let body: { error?: string; asset?: NonNullable<Upload["asset"]> } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.asset) resolve({ ok: true, asset: body.asset });
      else resolve({ ok: false, error: body.error ?? `Upload failed (${xhr.status}). Nothing was stored.` });
    };
    xhr.onerror = () => resolve({ ok: false, error: "The upload could not reach the server. Nothing was stored; try again." });
    xhr.send(data);
  });
}

/**
 * Multi-file upload with per-file progress and one shared rights statement, followed by the
 * alternative-text pass: every uploaded image gets its alternative text (or the decorative
 * mark) on one screen before it is used (site-building programme B2-3, SB-05).
 */
export function UploadForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const id = useId();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const patch = (key: string, next: Partial<Upload>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...next } : u)));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    data.delete("file");
    if (files.length === 0) {
      setError("Choose one or more image files first.");
      return;
    }
    if (files.length > MAX_FILES) {
      setError(`Choose at most ${MAX_FILES} files at a time.`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 10 MB.`);
      return;
    }
    const batch: Upload[] = files.map((file, i) => ({ key: `${Date.now()}-${i}`, file, status: "queued", progress: 0 }));
    setUploads((list) => [...list.filter((u) => u.status !== "failed"), ...batch]);
    setRunning(true);
    // Two at a time keeps the server's image processing sensible and the progress readable.
    const queue = [...batch];
    const worker = async () => {
      for (let u = queue.shift(); u; u = queue.shift()) {
        const current = u;
        patch(current.key, { status: "uploading" });
        const result = await uploadOne(siteId, current.file, data, (p) => patch(current.key, { progress: p }));
        if (result.ok) patch(current.key, { status: "done", progress: 100, asset: result.asset });
        else patch(current.key, { status: "failed", error: result.error });
      }
    };
    await Promise.all([worker(), worker()]);
    setRunning(false);
    form.reset();
    router.refresh();
  }

  const done = uploads.filter((u) => u.status === "done" && u.asset);
  const failed = uploads.filter((u) => u.status === "failed");
  const active = uploads.filter((u) => u.status === "queued" || u.status === "uploading");

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3 text-sm" aria-describedby={`${id}-note`}>
        {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <div>
          <label htmlFor={`${id}-file`} className="mb-1 block font-medium">Image files</label>
          <input id={`${id}-file`} name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple required className="block w-full text-sm" />
          <p id={`${id}-note`} className="mt-1 text-xs text-ink-subtle">JPEG, PNG or WebP, up to 10 MB each and {MAX_FILES} files at a time. SVG, HTML and archives are rejected. Originals stay private; published derivatives are public. Titles come from the file names; alternative text is asked for next.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-license`} className="mb-1 block font-medium">License / rights (all files)</label>
            <input id={`${id}-license`} name="license" className={inputClass} maxLength={200} placeholder="e.g. Owned by the client, or CC BY 4.0" />
          </div>
          <div>
            <label htmlFor={`${id}-attr`} className="mb-1 block font-medium">Attribution (all files)</label>
            <input id={`${id}-attr`} name="attributionText" className={inputClass} maxLength={500} />
          </div>
          <div>
            <label htmlFor={`${id}-src`} className="mb-1 block font-medium">Source URL (all files)</label>
            <input id={`${id}-src`} name="sourceUrl" className={inputClass} maxLength={1000} placeholder="https://" />
          </div>
        </div>
        <Button type="submit" disabled={running}>{running ? `Uploading ${active.length} left…` : "Upload"}</Button>
      </form>
      {active.length || failed.length ? (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {[...active, ...failed].map((u) => (
            <li key={u.key} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate">{u.file.name}</span>
              {u.status === "failed" ? <span role="alert" className="text-danger">{u.error}</span> : <progress value={u.progress} max={100} className="w-32" aria-label={`Upload progress for ${u.file.name}`} />}
            </li>
          ))}
        </ul>
      ) : null}
      {done.length && !running ? <AltTextPass siteId={siteId} uploads={done} onSaved={(message) => { setNotice(message); setUploads((list) => list.filter((u) => u.status !== "done")); router.refresh(); }} /> : null}
    </div>
  );
}

/** One screen for the alternative text of every image just uploaded. */
function AltTextPass({ siteId, uploads, onSaved }: { siteId: string; uploads: Upload[]; onSaved: (message: string) => void }) {
  const [state, action, pending] = useActionState<AltTextBatchState, FormData>(updateAltTextBatchAction, {});
  const id = useId();
  useEffect(() => {
    if (state.message && !state.failed?.length) onSaved(state.message);
    // onSaved is stable enough for this purpose: it only clears the finished uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.message, state.failed?.length]);
  const failedFor = (assetId: string) => state.failed?.find((f) => f.assetId === assetId)?.reason;
  return (
    <form action={action} className="rounded border border-line bg-surface-muted p-3 text-sm" aria-labelledby={`${id}-heading`}>
      <input type="hidden" name="siteId" value={siteId} />
      <h3 id={`${id}-heading`} className="font-semibold">Alternative text for {uploads.length} uploaded image{uploads.length === 1 ? "" : "s"}</h3>
      <p className="mb-3 text-xs text-ink-subtle">Say what each image shows, for people who cannot see it. An image that carries no meaning (a texture, a divider) can be marked decorative instead. Publication needs one or the other.</p>
      {state.message ? <Alert tone={state.failed?.length ? "warning" : "success"}>{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <ul className="mt-3 space-y-3">
        {uploads.map((u) => {
          const asset = u.asset!;
          const reason = failedFor(asset.id);
          return (
            <li key={asset.id} className="grid gap-2 sm:grid-cols-[6rem_1fr_auto] sm:items-start">
              <input type="hidden" name="assetId" value={asset.id} />
              <img src={`/app/sites/${siteId}/media/${asset.id}/file/w480`} alt="" width={asset.width} height={asset.height} className="aspect-[4/3] w-24 rounded object-cover" />
              <div>
                <label htmlFor={`${id}-alt-${asset.id}`} className="mb-1 block text-xs font-medium">{asset.title}</label>
                <input id={`${id}-alt-${asset.id}`} name={`alt_${asset.id}`} className={inputClass} maxLength={500} placeholder="What the image shows" aria-invalid={reason ? true : undefined} aria-describedby={reason ? `${id}-err-${asset.id}` : undefined} />
                {reason ? <p id={`${id}-err-${asset.id}`} className="mt-1 text-xs text-danger">{reason}</p> : null}
              </div>
              <label className="flex items-center gap-2 text-xs sm:pt-6"><input type="checkbox" name={`decorative_${asset.id}`} /> Decorative</label>
            </li>
          );
        })}
      </ul>
      <Button type="submit" className="mt-3" disabled={pending}>{pending ? "Saving…" : `Save alternative text for ${uploads.length} image${uploads.length === 1 ? "" : "s"}`}</Button>
    </form>
  );
}
