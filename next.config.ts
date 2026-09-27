import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Browser tests run a second server against the test database with its own build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Local browser tests reach the dev server at 127.0.0.1 while APP_URL uses localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  // An uploaded site's addresses are its own: `/events/` must serve its `/events/index.html`
  // without a hop to `/events` (B9; generators such as Astro emit trailing slashes). The proxy
  // normalises trailing slashes for the platform's pages and structured sites instead.
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["postgres", "sharp"],
  // Public media is served from our own asset routes as pre-sized derivatives; the
  // built-in optimizer is not used, so plain <img> elements with explicit sizes are intended.
  images: { unoptimized: true },
  experimental: {
    // The stylesheets are small (Tailwind, ~9 KB in total); inlining them removes a
    // render-blocking round trip on first visits to the public sites.
    inlineCss: true,
    // The proxy (src/proxy.ts) buffers request bodies on its matched routes, 10 MB by
    // default, which silently truncated an onboarding package or a two-file media upload
    // larger than that (found by the B4 proof build). The import routes accept packages up
    // to 64 MB (MAX_ONBOARDING_BYTES, MAX_PACKAGE_BYTES) and check the size themselves.
    proxyClientMaxBodySize: "64mb",
  },
  async headers() {
    return [
      {
        // Dashboard and preview responses are private and never stored by shared caches.
        source: "/app/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/sign-in",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Self-hosted font files (public/fonts): a replaced file gets a new name, so they can be immutable.
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Local demonstration routes are not canonical customer URLs.
        source: "/demo/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Every response. The platform's frame, referrer and transport-security headers are set
        // by the proxy (src/proxy.ts) on its own pages and on structured customer sites, not here:
        // headers from this file are applied to an uploaded site's files as well and would
        // override the site's own _headers (B9).
        source: "/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
