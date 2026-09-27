"use client";

import { useId } from "react";
import Link from "next/link";
import type { AssetOption } from "@/components/admin/editor/types";
import { selectClass } from "@/components/admin/ui";
import { formatBytes } from "@/server/media/content-types";

/** Chooses a picture from the site's media library; documents are offered by `DocumentPicker` instead (B5-1). */
export function MediaPicker({ label, value, onChange, assets, siteId, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; assets: AssetOption[]; siteId: string; hint?: string }) {
  const id = useId();
  const images = assets.filter((a) => a.kind !== "document");
  const selected = images.find((a) => a.id === value) ?? null;
  const chosenDocument = !selected && value ? assets.find((a) => a.id === value && a.kind === "document") : null;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-start gap-3">
        <select id={id} value={selected ? value ?? "" : chosenDocument ? value ?? "" : ""} onChange={(e) => onChange(e.target.value || null)} className={`${selectClass} max-w-sm`}>
          <option value="">No image</option>
          {chosenDocument ? <option value={chosenDocument.id}>{chosenDocument.title || chosenDocument.id.slice(0, 8)} (a document, not a picture)</option> : null}
          {images.map((a) => (
            <option key={a.id} value={a.id}>{a.title || a.id.slice(0, 8)}{a.status !== "ready" ? ` (${a.status})` : ""}{!a.alt ? " · no alt text" : ""}</option>
          ))}
        </select>
        {selected?.thumbUrl ? <img src={selected.thumbUrl} alt={selected.alt || ""} width={Math.round((selected.width / selected.height) * 64)} height={64} className="h-16 w-auto rounded border border-line object-cover" /> : null}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {hint ?? "Choose from this site's media library."} <Link href={`/app/sites/${siteId}/media`} className="text-action underline">Open Media</Link>
        {selected && !selected.alt ? <span className="text-warning"> · This image has no alternative text yet; publication will be blocked until it is added or marked decorative.</span> : null}
        {chosenDocument ? <span className="text-danger"> · A document cannot stand in for a picture; choose an image or publication will be blocked.</span> : null}
      </p>
    </div>
  );
}

/** Chooses a document (PDF) from the site's media library, for downloads and attachments (B5-1). */
export function DocumentPicker({ label, value, onChange, assets, siteId, hint, error }: { label: string; value: string | null; onChange: (v: string | null) => void; assets: AssetOption[]; siteId: string; hint?: string; error?: string }) {
  const id = useId();
  const documents = assets.filter((a) => a.kind === "document");
  const selected = documents.find((a) => a.id === value) ?? null;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <select id={id} value={selected ? value ?? "" : ""} onChange={(e) => onChange(e.target.value || null)} className={`${selectClass} max-w-sm`} aria-invalid={error ? true : undefined}>
        <option value="">No document</option>
        {documents.map((a) => (
          <option key={a.id} value={a.id}>{a.title || a.id.slice(0, 8)} · PDF, {formatBytes(a.bytes)}{a.status !== "ready" ? ` (${a.status})` : ""}</option>
        ))}
      </select>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      <p className="mt-1 text-xs text-ink-subtle">
        {hint ?? (documents.length ? "Documents uploaded to this site's media library." : "No documents yet: upload a PDF in Media first.")} <Link href={`/app/sites/${siteId}/media`} className="text-action underline">Open Media</Link>
      </p>
    </div>
  );
}
