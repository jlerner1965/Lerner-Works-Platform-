import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/server/auth/actions";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { MobileNav } from "@/components/admin/mobile-nav";
import { NavLinks } from "@/components/admin/nav-links";

export interface NavItem {
  label: string;
  href: string;
  /** Match only the exact path (for overview links). */
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface Crumb {
  label: string;
  href?: string;
}

export function AdminShell({
  user,
  sites,
  currentSiteId,
  sections,
  breadcrumbs,
  children,
}: {
  user: { email: string };
  sites: Array<{ id: string; name: string; organizationName: string }>;
  currentSiteId?: string;
  sections: NavSection[];
  breadcrumbs?: Crumb[];
  children: ReactNode;
}) {
  const nav = <NavLinks sections={sections} />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="hidden bg-navy text-white lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-4 py-3">
          <Link href="/app" className="block text-sm font-semibold tracking-tight text-white">
            Lerner Works
          </Link>
          <p className="text-[11px] text-white/60">Platform dashboard</p>
        </div>
        <div className="px-2 py-3">
          <SiteSwitcher sites={sites} currentSiteId={currentSiteId} />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">{nav}</div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
          <MobileNav sites={sites} currentSiteId={currentSiteId}>
            {nav}
          </MobileNav>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1 text-sm text-ink-muted">
              {(breadcrumbs ?? [{ label: "Dashboard" }]).map((crumb, i, arr) => (
                <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                  {crumb.href && i < arr.length - 1 ? (
                    <Link href={crumb.href} className="truncate hover:text-ink hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${i === arr.length - 1 ? "font-medium text-ink" : ""}`} aria-current={i === arr.length - 1 ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                  {i < arr.length - 1 ? <span aria-hidden="true">/</span> : null}
                </li>
              ))}
            </ol>
          </nav>
          <span className="hidden truncate text-sm text-ink-subtle sm:inline">{user.email}</span>
          <form action={signOutAction}>
            <button type="submit" className="rounded border border-line-strong px-2 py-1 text-xs hover:bg-surface-muted">
              Sign out
            </button>
          </form>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
