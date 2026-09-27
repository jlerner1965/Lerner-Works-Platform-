import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * A small reader and writer for Excel workbooks (`.xlsx`, Office Open XML SpreadsheetML), for
 * the import (site-building programme B5-3). It handles what a filled-in template needs:
 * sheet names, shared and inline strings (with rich-text runs), numbers, booleans, dates by
 * cell style, and formulas by their cached result. Every value becomes text, as a CSV cell
 * would be, so the rest of the import pipeline is unchanged. The writer produces a plain
 * workbook (inline strings, a bold header row, column widths) that Excel, Numbers, LibreOffice
 * and Google Sheets open. Nothing here executes formulas or reads macros.
 */
export interface SheetData {
  name: string;
  /** Rows as arrays of text cells, the first being the header row; trailing empty cells removed. */
  rows: string[][];
}

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;
const MAX_UNCOMPRESSED = 128 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (whole, code: string) => {
    if (code === "amp") return "&";
    if (code === "lt") return "<";
    if (code === "gt") return ">";
    if (code === "quot") return '"';
    if (code === "apos") return "'";
    const n = code.startsWith("#x") ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
  });
}

export function encodeXml(text: string): string {
  // Control characters other than tab, newline and carriage return are not allowed in XML 1.0.
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

/** Attribute value from a tag, whatever the namespace prefix ("r:id" or "id"). */
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)(?:[A-Za-z0-9_]+:)?${name}="([^"]*)"`).exec(tag) ?? new RegExp(`(?:^|\\s)(?:[A-Za-z0-9_]+:)?${name}='([^']*)'`).exec(tag);
  return m ? decodeXml(m[1]!) : null;
}

/** Text of every <t> element in a fragment (rich-text runs concatenated), phonetic runs skipped. */
function textRuns(fragment: string): string {
  const withoutPhonetic = fragment.replace(/<(?:[a-z0-9]+:)?rPh\b[\s\S]*?<\/(?:[a-z0-9]+:)?rPh>/gi, "");
  let out = "";
  for (const m of withoutPhonetic.matchAll(/<(?:[a-z0-9]+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[a-z0-9]+:)?t>)/gi)) out += decodeXml(m[1] ?? "");
  return out;
}

/** Column letters of a cell reference ("BC12" → 54) as a zero-based index. */
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

export function columnLetters(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Built-in number formats that show a date or a time (ECMA-376 part 1, 18.8.30). */
const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Whether a custom format code shows a date or time: date letters outside quoted text and brackets. */
export function isDateFormat(code: string): boolean {
  const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  if (/general/i.test(bare)) return false;
  return /[yd]/i.test(bare) || /h/i.test(bare) || (/m/i.test(bare) && !/#|0/.test(bare));
}

/** Excel serial date (1900 system) to "YYYY-MM-DD", with the time of day when the serial has one. */
export function serialToDateText(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Math.round(serial * 86_400_000);
  const d = new Date(epoch + ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const seconds = Math.round((serial % 1) * 86_400);
  if (seconds === 0) return date;
  return `${date} ${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}`;
}

function numberText(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw.trim();
  // Fifteen significant digits, as Excel shows them, without exponent notation for ordinary values.
  const text = Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0) ? n.toString() : String(Number(n.toPrecision(15)));
  return text;
}

interface Styles {
  /** For each cell style index (cellXfs), whether its number format is a date or time. */
  dateStyle: boolean[];
}

function parseStyles(xml: string | undefined): Styles {
  if (!xml) return { dateStyle: [] };
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<(?:[a-z0-9]+:)?numFmt\b[^>]*\/?>/gi)) {
    const id = Number(attr(m[0], "numFmtId"));
    const code = attr(m[0], "formatCode");
    if (Number.isFinite(id) && code !== null) custom.set(id, code);
  }
  const cellXfs = /<(?:[a-z0-9]+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?cellXfs>/i.exec(xml)?.[1] ?? "";
  const dateStyle: boolean[] = [];
  for (const m of cellXfs.matchAll(/<(?:[a-z0-9]+:)?xf\b[^>]*\/?>/gi)) {
    const id = Number(attr(m[0], "numFmtId") ?? "0");
    dateStyle.push(DATE_FORMAT_IDS.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!)));
  }
  return { dateStyle };
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const m of xml.matchAll(/<(?:[a-z0-9]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?si>/gi)) out.push(textRuns(m[1] ?? ""));
  return out;
}

function parseSheet(xml: string, shared: string[], styles: Styles): string[][] {
  const rows: string[][] = [];
  const data = /<(?:[a-z0-9]+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?sheetData>/i.exec(xml)?.[1] ?? "";
  for (const rowMatch of data.matchAll(/<(?:[a-z0-9]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[a-z0-9]+:)?row>/gi)) {
    const rowNumber = Number(attr(`<row ${rowMatch[1]}>`, "r") ?? rows.length + 1);
    if (rowNumber > MAX_ROWS) throw new Error(`the workbook has more than ${MAX_ROWS} rows on one sheet`);
    const cells: string[] = [];
    let nextColumn = 0;
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<(?:[a-z0-9]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[a-z0-9]+:)?c>)/gi)) {
      const tag = `<c ${cellMatch[1]}>`;
      const ref = attr(tag, "r");
      const column = ref ? columnIndex(ref) : nextColumn;
      if (column >= MAX_COLUMNS) throw new Error(`the workbook has more than ${MAX_COLUMNS} columns on one sheet`);
      nextColumn = column + 1;
      const type = attr(tag, "t") ?? "n";
      const style = Number(attr(tag, "s") ?? "0");
      const inner = cellMatch[2] ?? "";
      const value = /<(?:[a-z0-9]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?v>/i.exec(inner)?.[1];
      let text = "";
      if (type === "s") text = value !== undefined ? shared[Number(value)] ?? "" : "";
      else if (type === "inlineStr") text = textRuns(/<(?:[a-z0-9]+:)?is\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?is>/i.exec(inner)?.[1] ?? "");
      else if (type === "str") text = value !== undefined ? decodeXml(value) : "";
      else if (type === "b") text = value === "1" ? "yes" : value === "0" ? "no" : "";
      else if (type === "d") text = value !== undefined ? decodeXml(value).replace("T", " ").slice(0, 16).replace(/ 00:00$/, "") : "";
      else if (type === "e") text = "";
      else if (value !== undefined) text = styles.dateStyle[style] ? serialToDateText(Number(value)) : numberText(decodeXml(value));
      while (cells.length < column) cells.push("");
      cells[column] = text.replace(/\r\n?/g, "\n");
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }
  // Trailing empty cells and rows carry nothing.
  const trimmed = rows.map((r) => {
    let end = r.length;
    while (end > 0 && (r[end - 1] ?? "").trim() === "") end--;
    return r.slice(0, end).map((c) => c ?? "");
  });
  while (trimmed.length > 0 && trimmed[trimmed.length - 1]!.length === 0) trimmed.pop();
  return trimmed;
}

/** Every worksheet of a workbook, in workbook order, with every cell as text. */
export function readWorkbook(bytes: Uint8Array): SheetData[] {
  if (bytes.byteLength > MAX_WORKBOOK_BYTES) throw new Error(`The workbook is larger than ${MAX_WORKBOOK_BYTES / 1024 / 1024} MB.`);
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0;
    entries = unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNCOMPRESSED) throw new Error("uncompressed size exceeds the limit");
        return /^(xl\/|\[Content_Types\]\.xml$|_rels\/)/.test(f.name);
      },
    });
  } catch (err) {
    throw new Error(`The file is not a workbook Excel would open: ${(err as Error).message}`);
  }
  const text = (path: string): string | undefined => (entries[path] ? strFromU8(entries[path]!) : undefined);
  const workbookXml = text("xl/workbook.xml");
  if (!workbookXml) throw new Error("The file is not an Excel workbook (.xlsx): xl/workbook.xml is missing.");
  const rels = new Map<string, string>();
  for (const m of (text("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<(?:[a-z0-9]+:)?Relationship\b[^>]*\/?>/gi)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) rels.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
  }
  const shared = parseSharedStrings(text("xl/sharedStrings.xml"));
  const styles = parseStyles(text("xl/styles.xml"));
  const sheets: SheetData[] = [];
  for (const m of workbookXml.matchAll(/<(?:[a-z0-9]+:)?sheet\b[^>]*\/?>/gi)) {
    const name = attr(m[0], "name") ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[0], "id");
    const path = rid ? rels.get(rid) : undefined;
    const xml = path ? text(path) : undefined;
    if (!xml) continue;
    sheets.push({ name, rows: parseSheet(xml, shared, styles) });
  }
  return sheets;
}

export interface SheetSpec {
  name: string;
  rows: string[][];
  /** Column widths in characters; unset columns take a default. */
  widths?: number[];
}

/** A plain workbook: one worksheet per spec, inline strings, a bold header row, column widths. */
export function writeWorkbook(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const sheetXml = (spec: SheetSpec): string => {
    const cols = spec.widths?.length ? `<cols>${spec.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(6, Math.min(120, w))}" customWidth="1"/>`).join("")}</cols>` : "";
    const rows = spec.rows
      .map((row, r) => {
        const cells = row.map((value, c) => (value === "" ? "" : `<c r="${columnLetters(c)}${r + 1}"${r === 0 ? ' s="1"' : ""} t="inlineStr"><is><t xml:space="preserve">${encodeXml(value)}</t></is></c>`)).join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };
  sheets.forEach((spec, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(spec));
  });
  const sheetTags = sheets.map((s, i) => `<sheet name="${encodeXml(s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, " "))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  files["xl/workbook.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`);
  const rels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");
  files["xl/_rels/workbook.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  files["xl/styles.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  files["_rels/.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  const overrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  files["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`,
  );
  return zipSync(files, { level: 6 });
}

/** Whether bytes are a ZIP-based Office file (the import decides by content, not by name). */
export function looksLikeWorkbook(bytes: Uint8Array, filename = ""): boolean {
  const zip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!zip) return false;
  if (/\.xlsx$/i.test(filename)) return true;
  try {
    const entries = unzipSync(bytes, { filter: (f) => f.name === "xl/workbook.xml" });
    return Boolean(entries["xl/workbook.xml"]);
  } catch {
    return false;
  }
}
