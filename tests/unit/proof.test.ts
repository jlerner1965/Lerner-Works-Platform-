import { describe, expect, it } from "vitest";
import { strFromU8 } from "fflate";
import { proofSites, proofSheets, proofPhotoProblems, LOC_ATTRIBUTION, LOC_LICENSE } from "@/server/demo/proof";
import { proofWorkbook } from "@/server/demo/proof/package";
import { siteSheetKeys, kindFiles } from "@/server/import/onboarding";
import { workbookToPackageFiles } from "@/server/import/workbook";
import { csvSpecs, type ImportableKind } from "@/server/import/csv-spec";
import { presets } from "@/modules/presets";

/**
 * Site-building programme B4: the proof sites are consistent before any database is
 * involved. Every picture a row or setting names exists with alternative text and a
 * catalogue record, every sheet carries exactly the columns of its kind, every setting is one
 * the import knows, and the rights are recorded on every photograph.
 */
const hours = /^(closed|unknown|\d{2}:\d{2}-\d{2}:\d{2}(;\d{2}:\d{2}-\d{2}:\d{2})*)$/;

describe("the proof sites are consistent (B4)", () => {
  for (const site of proofSites) {
    it(`${site.name}: pictures, sheets, settings and rights`, () => {
      expect(proofPhotoProblems(site)).toEqual([]);
      const known = new Set(siteSheetKeys.map((k) => k.key));
      for (const key of Object.keys(site.settings)) expect(known.has(key), `setting ${key}`).toBe(true);
      expect(site.settings.hero_image).toBeTruthy();
      expect(site.settings.logo).toBe("logo.png");
      const files = proofSheets(site);
      const kinds = presets[site.preset].kinds.filter((k): k is ImportableKind => k !== "page");
      for (const kind of kinds) {
        const sheet = files[kindFiles[kind]];
        // The proof sites predate links (B5-2) and carry none; every other sheet of the preset is present.
        if (kind === "link" && !site.rows.link?.length) continue;
        expect(sheet, `${kind} sheet`).toBeDefined();
        const header = strFromU8(sheet!).split("\r\n")[0];
        expect(header).toBe(csvSpecs[kind].map((c) => c.key).join(","));
        for (const row of site.rows[kind] ?? []) {
          for (const c of csvSpecs[kind]) if (c.required) expect(row[c.key], `${kind} ${row.external_id} ${c.key}`).toBeTruthy();
          for (const [k, v] of Object.entries(row)) if (k.startsWith("hours_")) expect(v, `${kind} ${row.external_id} ${k}`).toMatch(hours);
          if (row.image) expect(row.image_alt ?? "").toBe(""); // the alternative text comes from images.csv, once per picture
        }
      }
      const images = strFromU8(files["images.csv"]!).split("\r\n").filter(Boolean);
      expect(images.length).toBe(1 + site.artwork.length + site.photos.length);
      for (const line of images.slice(1 + site.artwork.length)) {
        expect(line).toContain(LOC_LICENSE);
        expect(line).toContain(LOC_ATTRIBUTION);
        expect(line).toMatch(/https:\/\/www\.loc\.gov\/item\/\d+\//);
      }
      // Every archive id is used once.
      const ids = site.photos.map((p) => p.loc);
      expect(new Set(ids).size).toBe(ids.length);
      // The package carries the sheets as the onboarding workbook (B5-3); read back, it is exactly the CSV files above.
      const converted = workbookToPackageFiles(proofWorkbook(site), site.preset);
      expect(converted.errors).toEqual([]);
      expect(converted.warnings).toEqual([]);
      expect(Object.keys(converted.files).sort()).toEqual(Object.keys(files).sort());
      for (const [file, bytes] of Object.entries(files)) expect(strFromU8(converted.files[file]!), file).toBe(strFromU8(bytes));
    });
  }

  it("the two sites cover both presets and share no picture file", () => {
    expect(proofSites.map((s) => s.preset).sort()).toEqual(["community_guide", "location_business"]);
    const all = proofSites.flatMap((s) => s.photos.map((p) => p.loc));
    expect(new Set(all).size).toBe(all.length);
  });
});
