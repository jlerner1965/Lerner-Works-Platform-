"use client";

import { useState } from "react";

export type MapEmbedProvider = "google" | "openstreetmap";

const providerName: Record<MapEmbedProvider, string> = { google: "Google Maps", openstreetmap: "OpenStreetMap" };

/** Provider page centred on the point; both work without an API key. */
export function mapEmbedUrl(provider: MapEmbedProvider, latitude: number, longitude: number): string {
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  if (provider === "google") return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  const dLat = 0.007;
  const dLng = 0.012;
  const bbox = [longitude - dLng, latitude - dLat, longitude + dLng, latitude + dLat].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

/**
 * Click-to-load map (decision D-013 extended in the site-building programme's phase B3):
 * the page shows the address on a plain panel and requests nothing from the map provider
 * until the visitor presses "Show map". The control is a real button, so it works with a
 * keyboard and a screen reader; where the directions link is withheld (demonstration sites,
 * previews, unapproved addresses) the button is disabled and the note says why.
 */
export function MapEmbed({ provider, latitude, longitude, address, enabled, disabledNote, buttonClass, frameClass }: { provider: MapEmbedProvider; latitude: number; longitude: number; address: string; enabled: boolean; disabledNote: string; buttonClass: string; frameClass: string }) {
  const [active, setActive] = useState(false);
  const name = providerName[provider];
  return (
    <div className={`mt-5 overflow-hidden ${frameClass}`}>
      {active ? (
        <iframe src={mapEmbedUrl(provider, latitude, longitude)} title={`Map: ${address}`} loading="lazy" referrerPolicy="strict-origin" allowFullScreen className="block aspect-[16/9] w-full border-0 sm:aspect-[21/9]" />
      ) : (
        <div className="flex aspect-[16/9] flex-col items-center justify-center gap-3 p-6 text-center sm:aspect-[21/9]">
          <p className="text-sm">{address}</p>
          <button type="button" className={buttonClass} disabled={!enabled} aria-disabled={!enabled || undefined} onClick={() => setActive(true)}>
            Show map
          </button>
          <p className="max-w-md text-xs text-(--section-muted)">{enabled ? `The map loads from ${name} after you press the button; nothing is loaded from ${name} before that.` : disabledNote}</p>
        </div>
      )}
    </div>
  );
}
