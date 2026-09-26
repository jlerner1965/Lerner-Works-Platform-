"use client";

import { useId, useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import { setFocalPointAction, type MediaActionState } from "@/server/actions/media";
import { Alert, Button } from "@/components/admin/ui";

/**
 * Focal point editor (design programme D1, DES-07): click or use the arrow keys on the
 * picture to place the point every crop keeps in view; three live crops show the result.
 * Saving is explicit; the value reaches the public site with the next release.
 */
export function FocalPointEditor({ siteId, assetId, src, width, height, alt, initial, disabled }: { siteId: string; assetId: string; src: string; width: number; height: number; alt: string; initial: { x: number; y: number } | null; disabled: boolean }) {
  const [focal, setFocal] = useState<{ x: number; y: number } | null>(initial);
  const [saved, setSaved] = useState<{ x: number; y: number } | null>(initial);
  const [state, setState] = useState<MediaActionState>({});
  const [pending, startTransition] = useTransition();
  const id = useId();
  const point = focal ?? { x: 0.5, y: 0.5 };
  const position = `${Math.round(point.x * 100)}% ${Math.round(point.y * 100)}%`;
  const dirty = JSON.stringify(focal) !== JSON.stringify(saved);

  const place = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setFocal({ x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) });
  };
  const nudge = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setFocal({ x: clamp(point.x + m[0]), y: clamp(point.y + m[1]) });
  };
  const save = () => {
    startTransition(async () => {
      const result = await setFocalPointAction({ siteId, assetId, focal });
      setState(result);
      if (result.message) setSaved(focal);
    });
  };

  return (
    <div className="space-y-3 text-sm">
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <p id={`${id}-help`} className="text-xs text-ink-subtle">Click the picture where the important part is, or focus it and use the arrow keys (Shift for fine steps). Every crop on the public site keeps that point in view.</p>
      <button type="button" onClick={place} onKeyDown={nudge} disabled={disabled} aria-describedby={`${id}-help`} aria-label={`Focal point: ${Math.round(point.x * 100)}% from the left, ${Math.round(point.y * 100)}% from the top. Use the arrow keys to move it.`} className="relative block w-full max-w-md cursor-crosshair rounded border border-line bg-surface p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-action">
        <img src={src} alt={alt} width={width} height={height} className="block h-auto w-full" draggable={false} />
        <span aria-hidden="true" className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-action/80 shadow" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
      </button>
      <div className="grid grid-cols-3 gap-2" aria-label="Crop previews">
        {[{ label: "Square", cls: "aspect-square" }, { label: "Landscape", cls: "aspect-[4/3]" }, { label: "Wide", cls: "aspect-[21/9]" }].map((c) => (
          <figure key={c.label}>
            <img src={src} alt="" width={width} height={height} className={`${c.cls} w-full rounded border border-line object-cover`} style={{ objectPosition: position }} />
            <figcaption className="mt-1 text-xs text-ink-subtle">{c.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-xs text-ink-muted">Focal point: {focal ? `${Math.round(focal.x * 100)}% across, ${Math.round(focal.y * 100)}% down` : "centre (not set)"}{dirty ? " · unsaved" : ""}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={pending || disabled || !dirty}>{pending ? "Saving…" : "Save focal point"}</Button>
        <Button type="button" variant="secondary" onClick={() => setFocal(null)} disabled={pending || disabled || focal === null}>Use the centre</Button>
      </div>
    </div>
  );
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));
}
