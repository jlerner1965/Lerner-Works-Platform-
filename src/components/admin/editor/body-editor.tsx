"use client";

import { useId, useState } from "react";
import { parseStructuredText, serializeStructuredText, type Block } from "@/lib/richtext";
import { textareaClass } from "@/components/admin/ui";

/** Structured-text editor: the textarea markup is parsed into validated blocks on every change. */
export function BodyEditor({ label = "Body", blocks, onChange, error, rows = 12 }: { label?: string; blocks: Block[]; onChange: (blocks: Block[]) => void; error?: string; rows?: number }) {
  const id = useId();
  const [text, setText] = useState(() => serializeStructuredText(blocks));
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <button type="button" className="text-xs text-action underline" aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? "Hide formatting help" : "Formatting help"}
        </button>
      </div>
      {showHelp ? (
        <div className="mb-2 rounded border border-line bg-surface-muted p-3 text-xs leading-relaxed">
          <p>Blank lines separate paragraphs. Lines starting with <code>## </code> or <code>### </code> are headings. <code>- </code> starts a bullet list, <code>1. </code> a numbered list, <code>&gt; </code> a quote.</p>
          <p className="mt-1">Emphasis: <code>**bold**</code> and <code>*italic*</code>. Links: <code>[label](/about)</code> for a page on this site, <code>[label](item:ID)</code> for a stable item reference, or <code>[label](https://…)</code>. Images: <code>!image ASSET-ID | caption</code>. HTML is not supported and is shown as plain text.</p>
        </div>
      ) : null}
      <textarea
        id={id}
        value={text}
        rows={rows}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseStructuredText(e.target.value));
        }}
        className={textareaClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        spellCheck
      />
      {error ? <p id={`${id}-err`} className="mt-1 text-sm text-danger">{error}</p> : null}
      <p className="mt-1 text-xs text-ink-subtle">{blocks.length} block{blocks.length === 1 ? "" : "s"}</p>
    </div>
  );
}
