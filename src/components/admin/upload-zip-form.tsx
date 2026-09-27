"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, inputClass } from "@/components/admin/ui";

/**
 * The ZIP uploader (B7, B8). With script, the file goes up in parts, each request small
 * enough for a hosted function, with a progress bar; the parts are assembled and checked on
 * the server, and the browser lands on the check. Without script the form posts the file in
 * one request, which serves small files.
 */
export function UploadZipForm({ siteId, maxMegabytes, maxFiles }: { siteId: string; maxMegabytes: number; maxFiles: number }) {
  const id = useId();
  const base = `/app/sites/${siteId}/upload`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "checking">("idle");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [root, setRoot] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || file.size === 0) {
      setError("Choose the ZIP of the site to upload.");
      return;
    }
    if (file.size > maxMegabytes * 1024 * 1024) {
      setError(`The ZIP is larger than ${maxMegabytes} MB.`);
      return;
    }
    setError(null);
    setPhase("uploading");
    setProgress({ sent: 0, total: file.size });
    try {
      const begin = await fetch(`${base}/begin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size }) });
      const session = (await begin.json()) as { id?: string; partBytes?: number; parts?: number; error?: string };
      if (!begin.ok || !session.id || !session.partBytes || !session.parts) throw new Error(session.error ?? "The upload could not start.");
      for (let index = 0; index < session.parts; index++) {
        const start = index * session.partBytes;
        const chunk = file.slice(start, Math.min(start + session.partBytes, file.size));
        let attempt = 0;
        for (;;) {
          try {
            const res = await fetch(`${base}/part?session=${encodeURIComponent(session.id)}&index=${index}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(body.error ?? `Part ${index + 1} was not accepted (${res.status}).`);
            }
            break;
          } catch (err) {
            if (++attempt >= 3) throw err;
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
        setProgress({ sent: Math.min(start + session.partBytes, file.size), total: file.size });
      }
      setPhase("checking");
      const complete = await fetch(`${base}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.id, root: root.trim() || null }) });
      const done = (await complete.json()) as { redirect?: string; error?: string };
      if (!complete.ok || !done.redirect) throw new Error(done.error ?? "The upload could not be checked.");
      window.location.assign(done.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed.");
      setPhase("idle");
      setProgress(null);
    }
  }

  const mb = (n: number) => (n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1);
  const busy = phase !== "idle";
  return (
    <form method="post" action={`${base}/file`} encType="multipart/form-data" onSubmit={onSubmit} className="space-y-3 text-sm">
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      <label htmlFor={`${id}-file`} className="block">
        <span className="font-medium">ZIP of the site</span>
        <input ref={fileRef} id={`${id}-file`} type="file" name="file" accept=".zip,application/zip" required disabled={busy} className="mt-1 block w-full text-sm" />
      </label>
      <label htmlFor={`${id}-root`} className="block">
        <span className="font-medium">Folder inside the ZIP that is the site (optional)</span>
        <input id={`${id}-root`} name="root" value={root} onChange={(e) => setRoot(e.target.value)} disabled={busy} className={`${inputClass} mt-1 max-w-xs`} placeholder="dist, build, docs…" maxLength={200} />
        <span className="mt-1 block text-xs text-ink-subtle">Leave empty when index.html is at the top. The usual build folders are found on their own.</span>
      </label>
      <p className="text-xs text-ink-subtle">Up to {maxMegabytes} MB and {maxFiles.toLocaleString()} files kept: HTML, CSS, JavaScript, images, fonts, PDFs, video and audio. Anything else in the ZIP (a README, source files, server-side code) is left out and listed.</p>
      {progress ? (
        <div aria-live="polite">
          <progress className="block w-full" max={progress.total} value={progress.sent} />
          <p className="mt-1 text-xs text-ink-muted">{phase === "checking" ? "Uploaded. Checking the ZIP…" : `Uploading ${mb(progress.sent)} of ${mb(progress.total)} MB…`}</p>
        </div>
      ) : null}
      <Button type="submit" disabled={busy}>{phase === "uploading" ? "Uploading…" : phase === "checking" ? "Checking…" : "Upload and check"}</Button>
    </form>
  );
}
