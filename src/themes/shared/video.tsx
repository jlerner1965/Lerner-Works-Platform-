"use client";

import { useState } from "react";

export interface VideoPoster {
  src: string;
  srcSet: string;
  sizes: string;
  width: number;
  height: number;
  alt: string;
  objectPosition?: string;
}

/**
 * Click-to-load video (decision D-013): nothing from the provider is requested until the
 * visitor activates the player. The poster comes from the platform's own media pipeline;
 * the activation control is a real button, so it works with a keyboard and a screen reader.
 * YouTube uses the privacy-enhanced host; Vimeo is asked not to track.
 */
export function VideoEmbed({ provider, videoId, title, poster, caption, buttonClass, frameClass }: { provider: "youtube" | "vimeo"; videoId: string; title: string; poster: VideoPoster | null; caption: string; buttonClass: string; frameClass: string }) {
  const [active, setActive] = useState(false);
  const src = provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${encodeURIComponent(videoId)}?dnt=1&autoplay=1`;
  const providerName = provider === "youtube" ? "YouTube" : "Vimeo";
  return (
    <figure>
      <div className={`relative aspect-video w-full overflow-hidden ${frameClass}`}>
        {active ? (
          <iframe src={src} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
        ) : (
          <>
            {poster ? (
              <img src={poster.src} srcSet={poster.srcSet} sizes={poster.sizes} width={poster.width} height={poster.height} alt={poster.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" style={poster.objectPosition ? { objectPosition: poster.objectPosition } : undefined} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-(--brand-text) px-6 text-center text-(--brand-on-text)">{title}</div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <button type="button" onClick={() => setActive(true)} className={buttonClass} aria-label={`Play video: ${title}`}>
                Play video
              </button>
              <p className="max-w-md text-center text-xs text-(--brand-on-text) [text-shadow:0_0_8px_var(--brand-text)]">Plays from {providerName} after you press play; nothing is loaded from {providerName} before that.</p>
            </div>
          </>
        )}
      </div>
      {caption ? <figcaption className="mt-2 text-sm text-(--section-muted)">{caption}</figcaption> : null}
    </figure>
  );
}
