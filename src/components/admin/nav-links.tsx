"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/components/admin/shell";

/** Sidebar navigation with the current section derived from the URL. */
export function NavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-4">
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title ? <p className="mb-1 truncate px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">{section.title}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const current = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
