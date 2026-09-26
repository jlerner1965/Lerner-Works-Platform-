"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, inputClass } from "@/components/admin/ui";

/** Multipart upload with progress, validation errors and a success state. */
export function UploadForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose an image file first.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The file is larger than 10 MB.");
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/app/sites/${siteId}/media/upload`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string; asset?: { title: string } } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setDone(`Uploaded "${body.asset?.title ?? file.name}". Add alternative text and license details if you have not yet.`);
        form.reset();
        router.refresh();
      } else {
        setError(body.error ?? `Upload failed (${xhr.status}). Nothing was stored.`);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("The upload could not reach the server. Nothing was stored; try again.");
    };
    xhr.send(data);
    setProgress(0);
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-3 text-sm" aria-describedby={`${id}-note`}>
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      {done ? <Alert tone="success">{done}</Alert> : null}
      <div>
        <label htmlFor={`${id}-file`} className="mb-1 block font-medium">Image file</label>
        <input id={`${id}-file`} name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
        <p id={`${id}-note`} className="mt-1 text-xs text-ink-subtle">JPEG, PNG or WebP, up to 10 MB. SVG, HTML and archives are rejected. Originals stay private; published derivatives are public.</p>
      </div>
      <div>
        <label htmlFor={`${id}-title`} className="mb-1 block font-medium">Title</label>
        <input id={`${id}-title`} name="title" className={inputClass} maxLength={200} />
      </div>
      <div>
        <label htmlFor={`${id}-alt`} className="mb-1 block font-medium">Alternative text</label>
        <input id={`${id}-alt`} name="altText" className={inputClass} maxLength={500} placeholder="What the image shows, for people who cannot see it" />
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" name="decorative" /> Decorative only (no alternative text needed)</label>
      <div>
        <label htmlFor={`${id}-license`} className="mb-1 block font-medium">License / rights</label>
        <input id={`${id}-license`} name="license" className={inputClass} maxLength={200} placeholder="e.g. Owned by the client, or CC BY 4.0" />
      </div>
      <div>
        <label htmlFor={`${id}-attr`} className="mb-1 block font-medium">Attribution</label>
        <input id={`${id}-attr`} name="attributionText" className={inputClass} maxLength={500} />
      </div>
      <div>
        <label htmlFor={`${id}-src`} className="mb-1 block font-medium">Source URL</label>
        <input id={`${id}-src`} name="sourceUrl" className={inputClass} maxLength={1000} placeholder="https://" />
      </div>
      {progress !== null ? (
        <div>
          <progress value={progress} max={100} className="w-full" aria-label="Upload progress" />
          <p className="text-xs text-ink-subtle">Uploading… {progress}%</p>
        </div>
      ) : null}
      <Button type="submit" disabled={progress !== null}>{progress !== null ? "Uploading…" : "Upload"}</Button>
    </form>
  );
}
