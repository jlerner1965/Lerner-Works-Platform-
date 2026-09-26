/**
 * Request header set by the proxy (never trusted from clients) that names the public site a
 * request belongs to: `demo:<site key>` for local demonstration routes on the application
 * host, `host:<hostname>` for customer domains. The root layout reads it to set the
 * document language of the public page; dashboard requests carry no marker.
 */
export const PUBLIC_SITE_HEADER = "x-lw-public-site";

export type PublicSiteMarker = { kind: "demo"; siteKey: string } | { kind: "host"; host: string };

export function parsePublicSiteMarker(value: string | null): PublicSiteMarker | null {
  if (!value) return null;
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  const kind = value.slice(0, idx);
  const rest = value.slice(idx + 1);
  if (kind === "demo" && /^[a-z0-9-]{1,60}$/.test(rest)) return { kind: "demo", siteKey: rest };
  if (kind === "host" && /^[a-z0-9.-]{1,253}$/.test(rest)) return { kind: "host", host: rest };
  return null;
}
