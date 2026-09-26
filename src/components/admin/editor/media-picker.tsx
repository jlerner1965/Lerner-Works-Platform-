"use client";

import { useId } from "react";
import Link from "next/link";
import type { AssetOption } from "@/components/admin/editor/types";
import { selectClass } from "@/components/admin/ui";

export function MediaPicker({ label, value, onChange, assets, siteId, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; assets: AssetOption[]; siteId: string; hint?: string }) {
  const id = useId();
  const selected = assets.find((a) => a.id === value) ?? null;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-start gap-3">
        <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${selectClass} max-w-sm`}>
          <option value="">No image</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.title || a.id.slice(0, 8)}{a.status !== "ready" ? ` (${a.status})` : ""}{!a.alt ? " · no alt text" : ""}</option>
          ))}
        </select>
        {selected?.thumbUrl ? <img src={selected.thumbUrl} alt={selected.alt || ""} width={Math.round((selected.width / selected.height) * 64)} height={64} className="h-16 w-auto rounded border border-line object-cover" /> : null}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {hint ?? "Choose from this site's media library."} <Link href={`/app/sites/${siteId}/media`} className="text-action underline">Open Media</Link>
        {selected && !selected.alt ? <span className="text-warning"> · This image has no alternative text yet; publication will be blocked until it is added or marked decorative.</span> : null}
      </p>
    </div>
  );
}
