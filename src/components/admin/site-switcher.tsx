"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";

export function SiteSwitcher({
  sites,
  currentSiteId,
  onDark = true,
}: {
  sites: Array<{ id: string; name: string; organizationName: string }>;
  currentSiteId?: string;
  onDark?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const cls = onDark
    ? "w-full rounded border border-white/20 bg-navy-raised px-2 py-1.5 text-sm text-white"
    : "w-full rounded border border-line-strong bg-surface px-2 py-1.5 text-sm";
  return (
    <div>
      <label htmlFor={id} className={`mb-1 block text-[11px] font-semibold uppercase tracking-wider ${onDark ? "text-white/50" : "text-ink-subtle"}`}>
        Site
      </label>
      <select
        id={id}
        className={cls}
        value={currentSiteId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/app/sites/${v}` : "/app");
        }}
      >
        <option value="">All organizations</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {s.organizationName}
          </option>
        ))}
      </select>
    </div>
  );
}
