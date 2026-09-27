import { describe, expect, it } from "vitest";
import { strToU8, zipSync, unzipSync, strFromU8 } from "fflate";
import { readWorkbook, writeWorkbook, columnIndex, columnLetters, isDateFormat, serialToDateText, looksLikeWorkbook, decodeXml, encodeXml } from "@/server/import/xlsx";
import { sheetTarget, workbookToPackageFiles } from "@/server/import/workbook";
import { parseCsv } from "@/server/import/csv";

/**
 * Site-building programme B5-3: the workbook reader and writer. What a filled-in Excel file
 * carries becomes text cells the import reads as it reads a CSV: shared and inline strings,
 * rich-text runs, numbers, booleans, dates by style, formulas by their cached result.
 */
const WB = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** A workbook written the way Excel writes one: shared strings, styles, one styled date, a formula, a boolean and a rich-text run. */
function excelLikeWorkbook(): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  files["[Content_Types].xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`);
  files["_rels/.rels"] = strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  files["xl/workbook.xml"] = strToU8(`<?xml version="1.0"?><x:workbook xmlns:x="${WB}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Places &amp; more" sheetId="1" r:id="rId3"/><x:sheet name="Site" sheetId="2" r:id="rId4"/></x:sheets></x:workbook>`);
  files["xl/_rels/workbook.xml.rels"] = strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  files["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0"?><sst xmlns="${WB}" count="6" uniqueCount="6"><si><t>external_id</t></si><si><t>title</t></si><si><r><rPr><b/></rPr><t>Cedar </t></r><r><t xml:space="preserve">Bend Bakery</t></r><rPh sb="0" eb="1"><t>ceda</t></rPh></si><si><t>last_verified_on</t></si><si><t>Tom &amp; Jerry&apos;s</t></si><si><t>postal_code</t></si></sst>`);
  files["xl/styles.xml"] = strToU8(`<?xml version="1.0"?><styleSheet xmlns="${WB}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165"/><xf numFmtId="22"/></cellXfs></styleSheet>`);
  files["xl/worksheets/sheet1.xml"] = strToU8(`<?xml version="1.0"?><worksheet xmlns="${WB}"><dimension ref="A1:F4"/><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>3</v></c><c r="D1" t="inlineStr"><is><t>rating</t></is></c><c r="E1" t="inlineStr"><is><t>open</t></is></c><c r="F1" t="s"><v>5</v></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>P-1</t></is></c><c r="B2" t="s"><v>2</v></c><c r="C2" s="1"><v>46283</v></c><c r="D2" s="2"><v>4.5</v></c><c r="E2" t="b"><v>1</v></c><c r="F2"><v>80501</v></c></row>
    <row r="3"><c r="A3" t="str"><f>CONCATENATE("P-",2)</f><v>P-2</v></c><c r="B3" t="s"><v>4</v></c><c r="C3" s="3"><v>46283.5</v></c><c r="D3"><v>1e21</v></c><c r="E3" t="b"><v>0</v></c><c r="F3" t="e"><v>#N/A</v></c></row>
    <row r="4"><c r="A4"/><c r="B4" t="inlineStr"><is><t xml:space="preserve">  </t></is></c></row>
    <row r="6"><c r="A6" t="inlineStr"><is><t></t></is></c></row>
  </sheetData></worksheet>`);
  files["xl/worksheets/sheet2.xml"] = strToU8(`<?xml version="1.0"?><worksheet xmlns="${WB}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>key</t></is></c><c r="B1" t="inlineStr"><is><t>value</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>tagline</t></is></c><c r="B2" t="inlineStr"><is><t>Shops, trails &amp; &lt;people&gt;</t></is></c></row></sheetData></worksheet>`);
  return zipSync(files);
}

describe("reading workbooks", () => {
  it("reads shared and inline strings, rich runs, dates by style, numbers, booleans, formulas and errors as text, in workbook order", () => {
    const sheets = readWorkbook(excelLikeWorkbook());
    expect(sheets.map((s) => s.name)).toEqual(["Places & more", "Site"]);
    const rows = sheets[0]!.rows;
    expect(rows[0]).toEqual(["external_id", "title", "last_verified_on", "rating", "open", "postal_code"]);
    expect(rows[1]).toEqual(["P-1", "Cedar Bend Bakery", "2026-09-18", "4.5", "yes", "80501"]);
    // An error cell is empty text, and trailing empty cells are trimmed off the row.
    expect(rows[2]).toEqual(["P-2", "Tom & Jerry's", "2026-09-18 12:00", "1e+21", "no"]);
    // Rows 4 and 6 hold only blanks and whitespace; trailing rows like these are dropped with their cells.
    expect(rows.length).toBe(3);
    expect(sheets[1]!.rows).toEqual([["key", "value"], ["tagline", "Shops, trails & <people>"]]);
  });

  it("refuses what is not a workbook and converts references, formats and serial dates", () => {
    expect(() => readWorkbook(strToU8("not a zip at all"))).toThrow(/not a workbook/);
    expect(() => readWorkbook(zipSync({ "hello.txt": strToU8("hi") }))).toThrow(/xl\/workbook\.xml is missing/);
    expect(looksLikeWorkbook(zipSync({ "hello.txt": strToU8("hi") }))).toBe(false);
    expect(looksLikeWorkbook(zipSync({ "hello.txt": strToU8("hi") }), "content.xlsx")).toBe(true);
    expect(looksLikeWorkbook(excelLikeWorkbook())).toBe(true);
    expect(looksLikeWorkbook(strToU8("%PDF-1.4"))).toBe(false);
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AA1")).toBe(26);
    expect(columnIndex("BC12")).toBe(54);
    expect(columnLetters(0)).toBe("A");
    expect(columnLetters(26)).toBe("AA");
    expect(columnLetters(54)).toBe("BC");
    expect(isDateFormat("yyyy-mm-dd")).toBe(true);
    expect(isDateFormat("h:mm AM/PM")).toBe(true);
    expect(isDateFormat("#,##0.00")).toBe(false);
    expect(isDateFormat('"Total: "0.00')).toBe(false);
    expect(isDateFormat("General")).toBe(false);
    expect(isDateFormat("[$-409]d-mmm-yy;@")).toBe(true);
    expect(serialToDateText(46283)).toBe("2026-09-18");
    expect(serialToDateText(46283.5)).toBe("2026-09-18 12:00");
    expect(serialToDateText(45658)).toBe("2025-01-01");
    expect(decodeXml("a &amp; b &lt; c &#8217;s &#x2014;")).toBe("a & b < c ’s —");
    expect(encodeXml('<"&\'>')).toBe("&lt;&quot;&amp;&apos;&gt;");
  });
});

describe("writing workbooks", () => {
  it("round-trips sheets through the writer and the reader with the header row bold and column widths set", () => {
    const rows = [["file", "alt_text", "decorative"], ["a.jpg", "A tree by the river, with \"quotes\" & <brackets>", "no"], ["b.jpg", "Line one\nline two", ""]];
    const bytes = writeWorkbook([{ name: "Images", rows, widths: [12, 60, 10] }, { name: "Read me", rows: [["Notes"]] }]);
    const back = readWorkbook(bytes);
    expect(back.map((s) => s.name)).toEqual(["Images", "Read me"]);
    expect(back[0]!.rows).toEqual([["file", "alt_text", "decorative"], ["a.jpg", "A tree by the river, with \"quotes\" & <brackets>", "no"], ["b.jpg", "Line one\nline two"]]);
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
    const sheet = strFromU8(entries["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(sheet).toContain('<col min="2" max="2" width="60" customWidth="1"/>');
    expect(sheet).not.toContain('<c r="C3"');
    expect(strFromU8(entries["xl/workbook.xml"]!)).toContain('<sheet name="Read me" sheetId="2" r:id="rId2"/>');
    // Sheet names Excel refuses are cut to 31 characters and the characters it forbids become spaces.
    expect(strFromU8(unzipSync(writeWorkbook([{ name: "a/b:c*d?e[f]".padEnd(40, "x"), rows: [["x"]] }]))["xl/workbook.xml"]!)).toContain(`name="a b c d e f ${"x".repeat(19)}"`);
  });
});

describe("the onboarding workbook's sheets", () => {
  it("matches sheet names loosely and turns each into the package file the import reads", () => {
    expect(sheetTarget("Places")).toEqual({ kind: "place", file: "places.csv" });
    expect(sheetTarget(" place ")).toEqual({ kind: "place", file: "places.csv" });
    expect(sheetTarget("Locations")).toEqual({ kind: "store", file: "stores.csv" });
    expect(sheetTarget("links.csv")).toEqual({ kind: "link", file: "links.csv" });
    expect(sheetTarget("Site settings")).toEqual({ file: "site.csv" });
    expect(sheetTarget("Pictures")).toEqual({ file: "images.csv" });
    expect(sheetTarget("PDFs")).toEqual({ file: "documents.csv" });
    expect(sheetTarget("Read me")).toBeNull();
    expect(sheetTarget("Budget")).toBeNull();
    const bytes = writeWorkbook([
      { name: "Read me", rows: [["Fill in the sheets."]] },
      { name: "Places", rows: [["External ID", "Title ", "category", "summary"], ["P-1", "Bakery", "Eat & Drink", "Bread before dawn."], ["", "", "", ""], ["P-2", "Books", "Shops", ""]] },
      { name: "Site", rows: [["key", "value", "notes"], ["tagline", "Shops and trails", "ignored"]] },
      { name: "Budget", rows: [["item", "cost"], ["hosting", "12"]] },
      { name: "Empty", rows: [] },
    ]);
    const out = workbookToPackageFiles(bytes, "community_guide");
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([expect.stringContaining('Sheet "Budget" is not one the import reads'), expect.stringContaining('Sheet "Empty" is not one the import reads')]);
    expect(Object.keys(out.files).sort()).toEqual(["places.csv", "site.csv"]);
    const places = parseCsv(strFromU8(out.files["places.csv"]!));
    expect(places.headers).toEqual(["external_id", "title", "category", "summary"]);
    expect(places.rows.map((r) => r.external_id)).toEqual(["P-1", "P-2"]);
    expect(out.sheets).toEqual([
      // A read sheet counts its rows below the header; an ignored sheet counts every row it holds.
      { name: "Read me", file: null, rows: 1 },
      { name: "Places", file: "places.csv", rows: 2 },
      { name: "Site", file: "site.csv", rows: 1 },
      { name: "Budget", file: null, rows: 2 },
      { name: "Empty", file: null, rows: 0 },
    ]);
    // A kind the preset does not have, a sheet given twice, and a workbook with nothing to read are errors.
    expect(workbookToPackageFiles(writeWorkbook([{ name: "Stores", rows: [["external_id", "title"], ["S-1", "Shop"]] }]), "community_guide").errors).toEqual([expect.stringContaining("not a content kind of the Community guide preset")]);
    expect(workbookToPackageFiles(writeWorkbook([{ name: "Places", rows: [["external_id"]] }, { name: "Directory", rows: [["external_id"]] }]), "community_guide").errors).toEqual([expect.stringContaining("Two sheets stand for places.csv")]);
    expect(workbookToPackageFiles(writeWorkbook([{ name: "Budget", rows: [["x"]] }]), "community_guide").errors).toEqual([expect.stringContaining("no sheet the import reads")]);
    expect(workbookToPackageFiles(strToU8("nope"), "community_guide").errors[0]).toMatch(/not a workbook/);
  });
});
