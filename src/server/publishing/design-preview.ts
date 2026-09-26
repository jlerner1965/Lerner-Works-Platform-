import type { Db } from "@/server/data/db";
import type { SiteRow } from "@/server/data/access";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { getActiveRelease, type ReleaseRow } from "@/server/publishing/candidates";
import { normalizeSnapshot, type ReleaseSnapshot } from "@/server/publishing/snapshot";
import { toSnapshotMedia, type MediaAssetRow } from "@/server/publishing/manifest";

export interface DesignPreview {
  /** The active release's snapshot with the current draft configuration in place of the published one. */
  snapshot: ReleaseSnapshot;
  release: ReleaseRow;
  configVersion: number;
  configRevisionId: string;
  /** Assets the draft configuration references that no release carries yet; served through the dashboard's private route. */
  unreleasedAssetIds: Set<string>;
}

/**
 * Design preview (design programme D2): what the site would look like if the current draft
 * configuration (theme, design options, branding, typography, navigation) were published over
 * the content of the active release. Read-only; it publishes nothing and reads no draft
 * content. Returns null when the site has no active release to preview against.
 */
export async function loadDesignPreview(db: Db, site: SiteRow): Promise<DesignPreview | null> {
  const release = await getActiveRelease(db, site);
  const current = await getCurrentSiteConfig(db, site.id);
  if (!release || !current) return null;
  const base = normalizeSnapshot(release.snapshot);
  if (!base) return null;
  const config = current.config;
  const referenced = [config.branding.logoAssetId, config.branding.logoDarkAssetId, config.metadata.faviconAssetId, config.metadata.shareImageAssetId].filter((id): id is string => typeof id === "string" && !base.media[id]);
  const media = { ...base.media };
  const unreleasedAssetIds = new Set<string>();
  if (referenced.length) {
    const rows = await db<MediaAssetRow[]>`select * from public.media_assets where id = any(${referenced}) and site_id = ${site.id} and status = 'ready'`;
    for (const row of rows) {
      media[row.id] = toSnapshotMedia(row);
      unreleasedAssetIds.add(row.id);
    }
  }
  return {
    snapshot: { ...base, config, configRevisionId: current.id, media },
    release,
    configVersion: current.version,
    configRevisionId: current.id,
    unreleasedAssetIds,
  };
}
