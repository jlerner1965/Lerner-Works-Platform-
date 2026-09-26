"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The server records a redacted diagnostic; the digest is the reference code.
  }, [error]);
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-ink-muted">The request could not be completed. Nothing was saved.</p>
      {error.digest ? <p className="mt-2 text-sm text-ink-subtle">Reference code: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="mt-6 rounded bg-action px-4 py-2 text-white">
        Try again
      </button>
    </main>
  );
}
