"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteSwitcher } from "@/components/admin/site-switcher";

/** Small-screen navigation drawer with focus management and Escape handling. */
export function MobileNav({
  children,
  sites,
  currentSiteId,
}: {
  children: ReactNode;
  sites: Array<{ id: string; name: string; organizationName: string }>;
  currentSiteId?: string;
}) {
  // The drawer is open only for the path it was opened on; navigation closes it without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();
  const open = openedAt === pathname;
  const setOpen = (v: boolean) => setOpenedAt(v ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a, button, select");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenedAt(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="rounded border border-line-strong px-2 py-1 text-sm"
      >
        Menu
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" aria-label="Close menu" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
          <div ref={panelRef} id={id} className="w-72 max-w-[85vw] overflow-y-auto bg-navy p-3 text-white" role="dialog" aria-modal="true" aria-label="Dashboard navigation">
            <div className="mb-3">
              <SiteSwitcher sites={sites} currentSiteId={currentSiteId} />
            </div>
            {children}
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded border border-white/30 px-3 py-1.5 text-sm">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
