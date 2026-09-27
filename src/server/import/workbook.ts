import { strToU8 } from "fflate";
import type { PresetKey } from "@/modules/presets";
import { presets } from "@/modules/presets";
import { kindRegistry } from "@/modules/registry";
import { csvSpecs, type ImportableKind } from "@/server/import/csv-spec";
import { readWorkbook, writeWorkbook, type SheetData, type SheetSpec } from "@/server/import/xlsx";

/**
 * The onboarding workbook (site-building programme B5-3): one Excel file with a sheet per
 * content kind of the preset plus the Site, Images and Documents sheets, the same columns as
 * the CSV sheets it replaces. A workbook is turned into the package's CSV files before the
 * dry run, so the import reads one shape; sheets are matched by name, loosely, and a sheet the
 * import does not know is reported and ignored.
 */

/** File the sheet stands for inside the onboarding package. */
export type SheetTarget = { kind: ImportableKind; file: string } | { file: "site.csv" | "images.csv" | "documents.csv" } | null;

const kindByName: Record<string, ImportableKind> = {
  place: "place", places: "place", directory: "place",
  event: "event", events: "event",
  article: "article", articles: "article",
  service: "service", services: "service",
  store: "store", stores: "store", location: "store", locations: "store",
  link: "link", links: "link",
};

export const kindSheetFiles: Record<ImportableKind, string> = { place: "places.csv", event: "events.csv", article: "articles.csv", service: "services.csv", store: "stores.csv", link: "links.csv" };

/** What a sheet name means to the import: a content kind, the settings sheet, the images or documents sheet, or nothing. */
export function sheetTarget(name: string): SheetTarget {
  const key = name.toLowerCase().replace(/\.csv$/, "").replace(/[^a-z]/g, "");
  if (kindByName[key]) return { kind: kindByName[key]!, file: kindSheetFiles[kindByName[key]!] };
  if (key === "site" || key === "settings" || key === "sitesettings") return { file: "site.csv" };
  if (key === "images" || key === "image" || key === "pictures" || key === "photos") return { file: "images.csv" };
  if (key === "documents" || key === "document" || key === "files" || key === "pdfs") return { file: "documents.csv" };
  return null;
}

const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export const toCsv = (rows: string[][]): Uint8Array => strToU8(rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n");

export interface WorkbookConversion {
  /** CSV files by the names the onboarding import reads. */
  files: Record<string, Uint8Array>;
  /** Sheets read, with what each became. */
  sheets: Array<{ name: string; file: string | null; rows: number }>;
  warnings: string[];
  errors: string[];
}

/** Turns a workbook into the package's CSV files. Header cells are trimmed; wholly empty rows are dropped; a sheet the import does not know is ignored with a warning. */
export function workbookToPackageFiles(bytes: Uint8Array, preset: PresetKey): WorkbookConversion {
  const out: WorkbookConversion = { files: {}, sheets: [], warnings: [], errors: [] };
  let sheets: SheetData[];
  try {
    sheets = readWorkbook(bytes);
  } catch (err) {
    out.errors.push((err as Error).message);
    return out;
  }
  const allowed = new Set<string>(presets[preset].kinds.filter((k): k is ImportableKind => k in kindSheetFiles).map((k) => kindSheetFiles[k]));
  for (const sheet of sheets) {
    const target = sheetTarget(sheet.name);
    const rows = sheet.rows.map((r) => r.map((c) => c.trim())).filter((r, i) => i === 0 || r.some((c) => c !== ""));
    if (!target) {
      // A notes sheet is expected in the template; anything else is named so a typo is noticed.
      if (!/^(read ?me|notes?|instructions?|help)$/i.test(sheet.name.trim())) out.warnings.push(`Sheet "${sheet.name}" is not one the import reads (${["Places", "Events", "Articles", "Services", "Stores", "Links", "Site", "Images", "Documents"].join(", ")}); it is ignored.`);
      out.sheets.push({ name: sheet.name, file: null, rows: rows.length });
      continue;
    }
    if ("kind" in target && !allowed.has(target.file)) {
      out.errors.push(`Sheet "${sheet.name}" holds ${kindRegistry[target.kind].plural.toLowerCase()}, which are not a content kind of the ${presets[preset].label} preset.`);
      continue;
    }
    if (out.files[target.file]) {
      out.errors.push(`Two sheets stand for ${target.file} ("${sheet.name}" and another); keep one.`);
      continue;
    }
    if (rows.length === 0 || rows[0]!.every((c) => c === "")) {
      out.sheets.push({ name: sheet.name, file: target.file, rows: 0 });
      continue;
    }
    // Header cells are the column keys; case and stray spaces are forgiven.
    const header = rows[0]!.map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    const width = header.length;
    const body = rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
    out.files[target.file] = toCsv([header, ...body]);
    out.sheets.push({ name: sheet.name, file: target.file, rows: body.length });
  }
  if (Object.keys(out.files).length === 0 && out.errors.length === 0) out.errors.push("The workbook has no sheet the import reads: name the sheets Places, Events, Articles, Services, Stores, Links, Site, Images or Documents.");
  return out;
}

/** The settings sheet's keys with their explanations, shared with the CSV template. */
export interface SettingsKey {
  key: string;
  description: string;
  example: string;
}

/**
 * The workbook template for a preset: the kind sheets (header row, an example row, a notes
 * row is not used so the file imports as is once the example is replaced), the Site sheet
 * with every key explained, the Images and Documents sheets with one example each, and a
 * Read me sheet. Column widths follow the longest of header and example.
 */
export function buildWorkbookTemplate(preset: PresetKey, siteName: string, settings: SettingsKey[], imagesColumns: readonly string[], documentsColumns: readonly string[]): Uint8Array {
  const def = presets[preset];
  const kinds = def.kinds.filter((k): k is ImportableKind => k in kindSheetFiles);
  const widthFor = (rows: string[][]): number[] => {
    const n = Math.max(...rows.map((r) => r.length));
    return Array.from({ length: n }, (_, i) => Math.min(60, Math.max(12, ...rows.map((r) => (r[i] ?? "").length + 2))));
  };
  const sheets: SheetSpec[] = [];
  const readme = [
    [`Onboarding workbook for ${siteName} (${def.label})`],
    [""],
    ["One sheet per content kind: the first row names the columns, the second is an example to replace. Add one row per item."],
    ["Site: the brand, contact details and the starter pages' text as key/value rows. Leave a value empty to keep the site's current setting."],
    ["Images: one row per picture in the images folder of the package (alternative text, title, license, attribution, source, decorative)."],
    ["Documents: one row per PDF in the documents folder (title, license, attribution, source). Rows name documents in their attachments column."],
    ["Dates are YYYY-MM-DD; event times are YYYY-MM-DD HH:MM in the site's time zone. Excel date cells are read as dates."],
    ["Text columns hold plain text: paragraphs separated by a blank line, ## for a heading, - for a list item. No HTML."],
    ["Upload this workbook on its own on the Import & export page, or zip it with images/ and documents/ folders as content.xlsx."],
    ["Phone numbers and postal codes are text: type an apostrophe first in Excel (or format the column as text) so leading zeros stay."],
  ];
  sheets.push({ name: "Read me", rows: readme, widths: [110] });
  for (const kind of kinds) {
    const cols = csvSpecs[kind];
    const rows = [cols.map((c) => c.key), cols.map((c) => c.example)];
    sheets.push({ name: kindRegistry[kind].plural, rows, widths: widthFor(rows) });
  }
  const siteRows = [["key", "value", "notes"], ...settings.map((k) => [k.key, "", `${k.description} Example: ${k.example}`])];
  sheets.push({ name: "Site", rows: siteRows, widths: [20, 40, 100] });
  const imagesRows = [[...imagesColumns], ["storefront.jpg", "The bakery's front window at dawn, bread stacked on the counter", "Bakery storefront", "Owned by the client", "", "", "no"]];
  sheets.push({ name: "Images", rows: imagesRows, widths: widthFor(imagesRows) });
  const documentsRows = [[...documentsColumns], ["menu.pdf", "Autumn menu", "Owned by the client", "", ""]];
  sheets.push({ name: "Documents", rows: documentsRows, widths: widthFor(documentsRows) });
  return writeWorkbook(sheets);
}
