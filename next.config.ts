import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Browser tests run a second server against the test database with its own build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Local browser tests reach the dev server at 127.0.0.1 while APP_URL uses localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  serverExternalPackages: ["postgres", "sharp"],
  // Public media is served from our own asset routes as pre-sized derivatives; the
  // built-in optimizer is not used, so plain <img> elements with explicit sizes are intended.
  images: { unoptimized: true },
  // The stylesheets are small (Tailwind, ~9 KB in total); inlining them removes a
  // render-blocking round trip on first visits to the public sites.
  experimental: { inlineCss: true },
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
        // Local demonstration routes are not canonical customer URLs.
        source: "/demo/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
