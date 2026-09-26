import { headers } from "next/headers";
import { PUBLIC_SITE_HEADER, parsePublicSiteMarker } from "@/lib/public-site-header";
import { resolveDemoRelease, resolveLiveRelease, type PublicRelease } from "@/server/publishing/public-site";

const DEFAULT_LANGUAGE = "en";

/** The public release a request renders, from the proxy's marker header; null for dashboard requests. */
export async function publicReleaseForRequest(): Promise<PublicRelease | null> {
  const marker = parsePublicSiteMarker((await headers()).get(PUBLIC_SITE_HEADER));
  if (!marker) return null;
  return marker.kind === "demo" ? resolveDemoRelease(marker.siteKey) : resolveLiveRelease(marker.host);
}

/**
 * Language for the `<html lang>` attribute: the public site's configured language on public
 * routes (shared with the page through the per-request release cache), English elsewhere.
 */
export async function publicDocumentLanguage(): Promise<string> {
  const release = await publicReleaseForRequest();
  return release?.snapshot.config.metadata.language || DEFAULT_LANGUAGE;
}
