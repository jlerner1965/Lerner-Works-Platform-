"use client";

import { useId, type ReactNode } from "react";
import { inputClass, selectClass, textareaClass } from "@/components/admin/ui";

export function TextInput({ label, value, onChange, hint, error, required, type = "text", placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; error?: string; required?: boolean; type?: string; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true" className="text-danger"> *</span> : null}
      </label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} placeholder={placeholder} maxLength={maxLength} />
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      {error ? <p id={`${id}-err`} className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function TextArea({ label, value, onChange, hint, error, rows = 4, mono = false }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; error?: string; rows?: number; mono?: boolean }) {
  const id = useId();
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={mono ? textareaClass : `${inputClass} min-h-24`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} />
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      {error ? <p id={`${id}-err`} className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function SelectInput({ label, value, onChange, options, hint, error }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-invalid={error ? true : undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="mb-3 flex items-start gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <label htmlFor={id} className="text-sm">
        {label}
        {hint ? <span className="block text-xs text-ink-subtle">{hint}</span> : null}
      </label>
    </div>
  );
}

export function MultiSelect({ label, values, onChange, options, hint, error }: { label: string; values: string[]; onChange: (v: string[]) => void; options: Array<{ value: string; label: string }>; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {options.length === 0 ? <p className="text-xs text-ink-subtle">Nothing to choose from yet.</p> : (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-line p-2 text-sm">
          {options.map((o) => {
            const cid = `${id}-${o.value}`;
            const checked = values.includes(o.value);
            return (
              <li key={o.value} className="flex items-center gap-2">
                <input id={cid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value))} />
                <label htmlFor={cid}>{o.label}</label>
              </li>
            );
          })}
        </ul>
      )}
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

export function Fieldset({ legend, children, description }: { legend: string; children: ReactNode; description?: ReactNode }) {
  return (
    <fieldset className="mb-6 rounded border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      {description ? <p className="mb-3 text-xs text-ink-subtle">{description}</p> : null}
      {children}
    </fieldset>
  );
}
