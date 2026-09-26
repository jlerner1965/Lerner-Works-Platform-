"use client";

import { useState, type ReactNode } from "react";

/** Wraps a table in a form with a live selection count and a bulk action. */
export function BulkSelectionForm({ action, siteId, mode, canEdit, total, children }: { action: (formData: FormData) => void | Promise<void>; siteId: string; mode: "archive" | "restore"; canEdit: boolean; total: number; children: ReactNode }) {
  const [count, setCount] = useState(0);
  return (
    <form action={action} onChange={(e) => setCount(e.currentTarget.querySelectorAll('input[name="itemId"]:checked').length)} className="rounded border border-line bg-surface p-3">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="mode" value={mode} />
      {canEdit ? (
        <div className="mb-2 flex items-center gap-3 text-sm">
          <span aria-live="polite">{count} of {total} selected</span>
          <button type="submit" disabled={count === 0} className="rounded border border-line-strong px-2 py-1 disabled:opacity-50">
            {mode === "archive" ? "Archive selected" : "Restore selected"}
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </form>
  );
}
