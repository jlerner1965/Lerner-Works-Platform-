/**
 * Sample PDF documents for the demonstration fixtures and the tests (site-building programme
 * B5-1): a one-page PDF written by hand (header, catalogue, page tree, one Helvetica text
 * stream, cross-reference table, trailer), valid for every PDF reader and for the platform's
 * own signature check. No library, no external file, no embedded fonts: what a client's
 * brochure or price list stands for in a fixture, never presented as a real document.
 */
export interface SimplePdfSpec {
  title: string;
  /** Lines of body text, in the order they read; long lines are not wrapped. */
  lines: string[];
  /** Repeats the body text this many times on the page, to make a larger file for size tests. */
  repeat?: number;
}

function pdfText(text: string): string {
  // PDF string literals escape backslashes and parentheses; the base font has no glyphs outside Latin-1.
  return text
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function renderSimplePdf(spec: SimplePdfSpec): Uint8Array {
  const lines: string[] = [];
  for (let r = 0; r < Math.max(1, spec.repeat ?? 1); r++) lines.push(...spec.lines);
  const content = [
    "BT",
    "/F1 24 Tf",
    "72 720 Td",
    `(${pdfText(spec.title)}) Tj`,
    "ET",
    "BT",
    "/F1 12 Tf",
    "72 690 Td",
    "16 TL",
    ...lines.map((line) => `(${pdfText(line)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    `<< /Title (${pdfText(spec.title)}) /Producer (Lerner Works Platform fixtures) >>`,
  ];
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
