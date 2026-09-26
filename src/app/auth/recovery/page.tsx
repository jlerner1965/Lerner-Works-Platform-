import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/server/config";
import { RecoveryForm } from "@/components/admin/recovery-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Landing page of the identity provider's recovery email (PKCE code in the query string). */
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ code?: string; token_hash?: string; type?: string; error?: string; error_description?: string }> }) {
  const params = await searchParams;
  const cfg = getConfig();
  const code = typeof params.code === "string" ? params.code : "";
  const tokenHash = typeof params.token_hash === "string" && params.type === "recovery" ? params.token_hash : "";
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Lerner Works Platform</p>
          <h1 className="mt-1 text-2xl font-semibold">Choose a new password</h1>
        </div>
        {cfg.AUTH_PROVIDER !== "supabase" ? (
          <p className="rounded border border-line bg-surface p-6 text-sm">Password recovery is not available in this environment.</p>
        ) : params.error ? (
          <p className="rounded border border-line bg-surface p-6 text-sm">The recovery link could not be used ({params.error_description ?? params.error}). <Link href="/forgot-password" className="text-action underline">Request a new link</Link>.</p>
        ) : code || tokenHash ? (
          <RecoveryForm code={code} tokenHash={tokenHash} />
        ) : (
          <p className="rounded border border-line bg-surface p-6 text-sm">This page expects the link from the recovery email. <Link href="/forgot-password" className="text-action underline">Request a new link</Link>.</p>
        )}
      </div>
    </main>
  );
}
