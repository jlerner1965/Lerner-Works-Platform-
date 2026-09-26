import type { Theme } from "@/themes/shared/types";
import type { ThemeKey } from "@/modules/site-config";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";
import { themeKeyFor } from "@/themes/capabilities";
import { guideTheme } from "@/themes/guide/index";
import { locationsTheme } from "@/themes/locations/index";
import { magazineTheme } from "@/themes/magazine/index";
import { storefrontTheme } from "@/themes/storefront/index";
import { almanacTheme } from "@/themes/almanac/index";
import { practiceTheme } from "@/themes/practice/index";

/**
 * The theme catalogue (design programme D2). Every composition the platform has ever
 * rendered stays here under its original key, because releases carry the key and an old
 * release must render as it was published. Capabilities and preset compatibility are
 * declared in `src/themes/capabilities.ts`.
 */
export const themes: Record<ThemeKey, Theme> = {
  guide: guideTheme,
  locations: locationsTheme,
  magazine: magazineTheme,
  storefront: storefrontTheme,
  almanac: almanacTheme,
  practice: practiceTheme,
};

/** The theme a release renders with: the configuration's choice when compatible with the preset, else the preset's original composition. */
export function getTheme(snapshot: Pick<ReleaseSnapshot, "site" | "config">): Theme {
  return themes[themeKeyFor(snapshot.site.preset, snapshot.config.design)];
}
