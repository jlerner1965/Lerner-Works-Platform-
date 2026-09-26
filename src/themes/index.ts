import type { Theme } from "@/themes/shared/types";
import { guideTheme } from "@/themes/guide/index";
import { locationsTheme } from "@/themes/locations/index";
import type { PresetKey } from "@/modules/presets";

export function getTheme(preset: PresetKey): Theme {
  return preset === "community_guide" ? guideTheme : locationsTheme;
}
