import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-action text-white hover:bg-action-hover border border-transparent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-muted",
  danger: "bg-surface text-danger border border-danger/50 hover:bg-danger-soft",
  ghost: "bg-transparent text-action hover:bg-action-soft border border-transparent",
};

const base = "inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`${base} ${variantClasses[variant]} ${className}`} />;
}

export function LinkButton({ variant = "primary", className = "", href, children }: { variant?: Variant; className?: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${base} ${variantClasses[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{eyebrow}</p> : null}
        <h1 className="text-xl font-semibold leading-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded border border-line bg-surface ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-raised text-ink-muted",
  info: "bg-action-soft text-action",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>{children}</span>;
}

export function Alert({ tone = "info", title, children, role }: { tone?: Tone; title?: string; children?: ReactNode; role?: "alert" | "status" }) {
  const border: Record<Tone, string> = {
    neutral: "border-line",
    info: "border-action/40",
    success: "border-success/40",
    warning: "border-warning/40",
    danger: "border-danger/40",
  };
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={`rounded border ${border[tone]} ${toneClasses[tone]} px-3 py-2 text-sm`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-line-strong px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true" className="text-danger"> *</span> : <span className="ml-1 text-xs font-normal text-ink-subtle">(optional)</span>}
      </label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = "w-full rounded border border-line-strong bg-surface px-3 py-2 text-base text-ink focus:border-action";
export const selectClass = inputClass;
export const textareaClass = `${inputClass} min-h-32 font-mono text-sm leading-relaxed`;

export function StatTile({ label, value, href, hint }: { label: string; value: number | string; href?: string; hint?: string }) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
    </>
  );
  const cls = "block rounded border border-line bg-surface px-4 py-3";
  return href ? (
    <Link href={href} className={`${cls} hover:border-action`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function DescriptionList({ items }: { items: Array<{ term: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {items.map((it) => (
        <div key={it.term} className="contents">
          <dt className="text-ink-subtle">{it.term}</dt>
          <dd className="min-w-0 break-words">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function formatDateTime(value: Date | string | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone ?? "UTC",
  }).format(d) + (timeZone ? "" : " UTC");
}
