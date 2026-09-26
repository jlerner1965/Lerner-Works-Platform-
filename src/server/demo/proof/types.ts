import type { PresetKey } from "@/modules/presets";
import type { ImportableKind } from "@/server/import/csv-spec";
import type { SceneSpec } from "@/server/demo/images";

/**
 * The proof sites (site-building programme B4): two realistic client sites, a community guide
 * and a location business, written as the onboarding package a client would fill in, with
 * licensed photography. They are the material of the timed dashboard build recorded in
 * `docs/evidence/proof/`, and the owner can import the same packages on production
 * (`pnpm proof:package`) to judge the compositions on real photographs.
 */

/** A photograph from the Library of Congress Prints and Photographs Division (Carol M. Highsmith Archive, no known restrictions on publication). */
export interface ProofPhoto {
  /** File name inside the package's images folder (letters, digits, dots, hyphens; .jpg). */
  file: string;
  /** The archive's resource id, `<batch>:<item>` as in `service:pnp:highsm:33700:33703`. */
  loc: string;
  /** The catalogue record of the photograph (https://www.loc.gov/item/…/), recorded as the asset's source. */
  sourceUrl: string;
  /** The archive's own title, kept verbatim as the record of what the picture shows. */
  locTitle: string;
  /** The title shown in the media library: the sample site's own name for the picture. */
  title: string;
  /** Alternative text written for the sample site: what the picture shows, for people who cannot see it. */
  alt: string;
}

/** One sheet of the package: rows keyed by the column keys of `csvSpecs[kind]`; missing keys are empty cells. */
export type ProofRows = Partial<Record<ImportableKind, Array<Record<string, string>>>>;

/**
 * Original artwork drawn by the fixture generator (`src/server/demo/images.ts`) for the sample
 * site: its logo, stylised portraits for the people and quotation sections, and marks for the
 * logo strip. Real photography stands in for places and landscapes; no real person's likeness
 * and no organisation's mark is used for a fictional one.
 */
export interface ProofArtwork {
  file: string;
  title: string;
  alt: string;
  scene: SceneSpec;
}

export interface ProofSite {
  /** Registry key of the sample site (also the folder of its photographs). */
  key: string;
  name: string;
  preset: PresetKey;
  timeZone: string;
  /** The contact email entered when the site is created (the settings sheet carries the public details). */
  contactEmail: string;
  /** `site.csv`: brand, contact details and the starter pages' text, by key (`siteSheetKeys`). */
  settings: Record<string, string>;
  artwork: ProofArtwork[];
  photos: ProofPhoto[];
  rows: ProofRows;
}

/** Rights and attribution recorded on every photograph's asset row and in `docs/evidence/ASSETS.md`. */
export const LOC_LICENSE = "Public domain: Library of Congress, no known restrictions on publication";
export const LOC_ATTRIBUTION = "Carol M. Highsmith Archive, Library of Congress, Prints and Photographs Division";

/** The archive's IIIF image service: `pct:25` of the original is about 2200 pixels wide. */
export const locImageUrl = (loc: string, size = "pct:25"): string => `https://tile.loc.gov/image-services/iiif/service:pnp:highsm:${loc.replace(":", ":")}/full/${size}/0/default.jpg`;
