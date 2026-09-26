import type { MetadataRoute } from "next";

/** The application host serves the dashboard and demonstrations only; nothing is indexable. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
