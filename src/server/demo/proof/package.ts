import { zipSync, strToU8 } from "fflate";
import { csvSpecs, type ImportableKind } from "@/server/import/csv-spec";
import { kindFiles } from "@/server/import/onboarding";
import { writeWorkbook } from "@/server/import/xlsx";
import { kindRegistry } from "@/modules/registry";
import { presets } from "@/modules/presets";
import { renderScenePng } from "@/server/demo/images";
import { LOC_ATTRIBUTION, LOC_LICENSE, type ProofSite } from "./types";

const esc = (s: string): string => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = (rows: string[][]): Uint8Array => strToU8(rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n");

/** The rows of a proof site's sheets (header row first), by the package file each sheet stands for. */
export function proofRows(site: ProofSite): Record<string, string[][]> {
  const sheets: Record<string, string[][]> = {};
  const kinds = presets[site.preset].kinds.filter((k): k is ImportableKind => k in kindFiles);
  for (const kind of kinds) {
    const rows = site.rows[kind] ?? [];
    if (!rows.length) continue;
    const columns = csvSpecs[kind].map((c) => c.key);
    for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) throw new Error(`${site.key}: ${kind} row ${row.external_id ?? "?"} uses unknown column "${key}"`);
    sheets[kindFiles[kind]] = [columns, ...rows.map((row) => columns.map((c) => row[c] ?? ""))];
  }
  sheets["site.csv"] = [["key", "value"], ...Object.entries(site.settings)];
  sheets["images.csv"] = [
    ["file", "alt_text", "title", "license", "attribution", "source_url", "decorative"],
    ...site.artwork.map((a) => [a.file, a.alt, a.title, "CC0-1.0", "Drawn for this demonstration", "", "no"]),
    ...site.photos.map((p) => [p.file, p.alt, p.title, LOC_LICENSE, LOC_ATTRIBUTION, p.sourceUrl, "no"]),
  ];
  return sheets;
}

/** The sheets of a proof site's package as the CSV files the import reads once a workbook is converted. */
export function proofSheets(site: ProofSite): Record<string, Uint8Array> {
  return Object.fromEntries(Object.entries(proofRows(site)).map(([file, rows]) => [file, csv(rows)]));
}

/** The same sheets as the onboarding workbook a client fills in (B5-3): a sheet per kind with rows, then Site and Images. */
export function proofWorkbook(site: ProofSite): Uint8Array {
  const names: Record<string, string> = { "site.csv": "Site", "images.csv": "Images" };
  for (const kind of Object.keys(kindFiles) as ImportableKind[]) names[kindFiles[kind]] = kindRegistry[kind].plural;
  return writeWorkbook(Object.entries(proofRows(site)).map(([file, rows]) => ({ name: names[file]!, rows })));
}

/**
 * The onboarding package of a proof site: its workbook, its artwork (rendered by the fixture
 * generator) and its photographs, read by the given function (from the repository in the
 * scripts and tests). Imported through the dashboard's Import & export page like any client
 * package.
 */
export async function buildProofPackage(site: ProofSite, readPhoto: (file: string) => Uint8Array): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = { "content.xlsx": proofWorkbook(site) };
  for (const a of site.artwork) files[`images/${a.file}`] = new Uint8Array(await renderScenePng(a.scene));
  for (const p of site.photos) files[`images/${p.file}`] = readPhoto(p.file);
  return zipSync(files, { level: 6 });
}

/** Every file a proof site refers to must be one of its pictures, each with alternative text and a well-formed archive id. */
export function proofPhotoProblems(site: ProofSite): string[] {
  const names = new Set([...site.artwork.map((a) => a.file), ...site.photos.map((p) => p.file)]);
  const problems: string[] = [];
  for (const [kind, rows] of Object.entries(site.rows)) for (const row of rows ?? []) if (row.image && !names.has(row.image)) problems.push(`${kind} ${row.external_id}: image "${row.image}" is not in the pictures`);
  for (const key of ["logo", "share_image", "hero_image"]) {
    const v = site.settings[key];
    if (v && !names.has(v)) problems.push(`setting ${key}: image "${v}" is not in the pictures`);
  }
  const seen = new Set<string>();
  for (const file of [...site.artwork.map((a) => a.file), ...site.photos.map((p) => p.file)]) {
    if (seen.has(file)) problems.push(`picture "${file}" is listed twice`);
    seen.add(file);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(jpe?g|png)$/i.test(file)) problems.push(`picture "${file}" has a name the package refuses`);
  }
  for (const p of site.photos) {
    if (!p.alt.trim()) problems.push(`photograph "${p.file}" has no alternative text`);
    if (!/^\d{5}:\d{5}$/.test(p.loc)) problems.push(`photograph "${p.file}" has a malformed archive id "${p.loc}"`);
    if (!/^https:\/\/www\.loc\.gov\/item\/\d+\/$/.test(p.sourceUrl)) problems.push(`photograph "${p.file}" has no catalogue record URL`);
  }
  for (const a of site.artwork) if (!a.alt.trim()) problems.push(`artwork "${a.file}" has no alternative text`);
  return problems;
}
