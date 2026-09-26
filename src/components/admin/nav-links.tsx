"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { NavSection } from "@/components/admin/shell";

/** Sidebar navigation with the current section derived from the URL (path and, for content kinds, the kind query). */
export function NavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const isCurrent = (href: string, exact?: boolean): boolean => {
    const [path, query] = href.split("?");
    const pathMatches = exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
    if (!pathMatches) return false;
    if (!query) return true;
    return query.split("&").every((pair) => {
      const [k, v] = pair.split("=");
      return search.get(k ?? "") === (v ?? "");
    });
  };
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-4">
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title ? <p className="mb-1 truncate px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">{section.title}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const current = isCurrent(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`block rounded px-3 py-1.5 text-sm ${current ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
