import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-sm font-medium text-ink-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-ink-muted">The address does not match anything on this server.</p>
      <Link href="/" className="mt-6 inline-block text-action underline">
        Go to the start page
      </Link>
    </main>
  );
}
