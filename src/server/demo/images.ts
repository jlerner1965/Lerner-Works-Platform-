import sharp from "sharp";

/**
 * Original, deterministic vector artwork rendered to raster images for the demonstration
 * sites. Every scene is generated from a specification (no stock photography, no hotlinks),
 * so the rights are unambiguous: created for this project, CC0.
 */
export type SceneSpec =
  | { type: "landscape"; palette: "dawn" | "day" | "dusk" | "autumn" | "winter"; seed: number; water?: boolean; ratio?: "wide" | "standard" }
  | { type: "storefront"; sign: string; awning: string; wall: string; trim: string; seed: number; detail?: "coffee" | "bread" | "books" | "bike" | "gear" | "gallery" | "hall" | "library" }
  | { type: "poster"; title: string; subtitle: string; bg: string; fg: string; accent: string; seed: number }
  | { type: "icon"; icon: "shoe" | "ski" | "jersey" | "wrench" | "trail" | "pond" | "falls"; bg: string; fg: string; accent: string }
  | { type: "logo"; lines: string[]; fg: string; accent: string; emblem: "pine" | "peak" | "ring" | "shield" | "leaf" | "sun" }
  /** Stylised head-and-shoulders silhouette with a monogram: a portrait for fictional people (B3). */
  | { type: "portrait"; initials: string; bg: string; fg: string; accent: string; seed: number };

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const palettes = {
  dawn: { sky: ["#f5d3b3", "#e7a37a"], far: "#8d7f9c", mid: "#5e6b7a", near: "#2f4a3f", sun: "#ffd28a", water: "#c9a58a", tree: "#24382f" },
  day: { sky: ["#cfe4f5", "#8fbbe0"], far: "#7f97b2", mid: "#4f6f6a", near: "#2f5d3a", sun: "#fff3c4", water: "#6b9ec4", tree: "#1f4030" },
  dusk: { sky: ["#3b3f6b", "#c76a4a"], far: "#5a4f7a", mid: "#3e4a5f", near: "#22322c", sun: "#f2a65a", water: "#7a5a6a", tree: "#18261f" },
  autumn: { sky: ["#f2e6cf", "#d9b58e"], far: "#a58a7a", mid: "#8a6a4a", near: "#a4502b", sun: "#ffe0a3", water: "#8ea0a8", tree: "#5a3a22" },
  winter: { sky: ["#e8eef5", "#b9c8da"], far: "#aab6c6", mid: "#7d8da0", near: "#4a5a6a", sun: "#ffffff", water: "#9fb2c4", tree: "#2c3e44" },
};

function ridge(r: () => number, width: number, baseY: number, amp: number, steps: number): string {
  const pts: string[] = [`0,${baseY + amp}`];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = baseY - amp * (0.4 + 0.6 * r()) * (i % 2 === 0 ? 1 : 0.55);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pts.push(`${width},${baseY + amp}`);
  return pts.join(" ");
}

function trees(r: () => number, width: number, baseY: number, count: number, color: string, scale: number): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = r() * width;
    const h = (40 + r() * 60) * scale;
    const w = h * 0.55;
    out += `<polygon points="${x},${baseY - h} ${x - w / 2},${baseY} ${x + w / 2},${baseY}" fill="${color}" opacity="${0.75 + r() * 0.25}"/>`;
  }
  return out;
}

export function landscapeSvg(spec: Extract<SceneSpec, { type: "landscape" }>): string {
  const W = 1600;
  const H = spec.ratio === "wide" ? 900 : 1067;
  const p = palettes[spec.palette];
  const r = rng(spec.seed);
  const sunX = 300 + r() * 1000;
  const sunY = 180 + r() * 160;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${(60 + r() * 40).toFixed(0)}" fill="${p.sun}" opacity="0.9"/>
<polygon points="${ridge(r, W, H * 0.55, 220, 9)}" fill="${p.far}"/>
<polygon points="${ridge(r, W, H * 0.66, 170, 7)}" fill="${p.mid}"/>
${spec.water ? `<rect x="0" y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="${p.water}"/><rect x="0" y="${H * 0.78}" width="${W}" height="6" fill="#ffffff" opacity="0.35"/>` : ""}
<polygon points="${ridge(r, W, H * 0.8, 120, 6)}" fill="${p.near}"/>
${trees(r, W, H * 0.86, 26, p.tree, 1.4)}
<rect x="0" y="${H * 0.86}" width="${W}" height="${H * 0.14}" fill="${p.near}"/>
${trees(r, W, H * 0.98, 18, p.tree, 1.8)}
</svg>`;
}

function detailGlyph(detail: NonNullable<Extract<SceneSpec, { type: "storefront" }>["detail"]>, x: number, y: number, color: string): string {
  switch (detail) {
    case "coffee":
      return `<g transform="translate(${x},${y})"><rect x="0" y="0" width="60" height="70" rx="6" fill="${color}"/><path d="M60 15 h18 a14 14 0 0 1 0 28 h-18" fill="none" stroke="${color}" stroke-width="10"/><path d="M15 -20 q8 -12 0 -24 M35 -20 q8 -12 0 -24" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round"/></g>`;
    case "bread":
      return `<g transform="translate(${x},${y})"><ellipse cx="40" cy="30" rx="48" ry="26" fill="${color}"/><path d="M15 22 l12 -10 M35 18 l12 -10 M55 22 l12 -10" stroke="#fff" stroke-width="4" opacity="0.6"/></g>`;
    case "books":
      return `<g transform="translate(${x},${y})"><rect x="0" y="0" width="22" height="70" fill="${color}"/><rect x="26" y="10" width="22" height="60" fill="${color}" opacity="0.8"/><rect x="52" y="4" width="22" height="66" fill="${color}" opacity="0.65"/></g>`;
    case "bike":
      return `<g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="7"><circle cx="20" cy="50" r="22"/><circle cx="90" cy="50" r="22"/><path d="M20 50 l25 -35 h35 l10 35 M45 15 l20 35 h-45"/></g>`;
    case "gear":
      return `<g transform="translate(${x},${y})"><path d="M10 60 l20 -50 l20 50 z" fill="${color}"/><rect x="55" y="20" width="40" height="40" rx="8" fill="${color}" opacity="0.8"/></g>`;
    case "gallery":
      return `<g transform="translate(${x},${y})"><rect x="0" y="0" width="70" height="55" fill="none" stroke="${color}" stroke-width="8"/><polygon points="12,45 30,20 45,38 55,28 62,45" fill="${color}"/></g>`;
    case "hall":
      return `<g transform="translate(${x},${y})"><rect x="0" y="20" width="90" height="50" fill="${color}"/><polygon points="-5,20 45,-10 95,20" fill="${color}" opacity="0.8"/></g>`;
    case "library":
      return `<g transform="translate(${x},${y})"><rect x="0" y="0" width="16" height="60" fill="${color}"/><rect x="22" y="0" width="16" height="60" fill="${color}" opacity="0.85"/><rect x="44" y="0" width="16" height="60" fill="${color}" opacity="0.7"/><rect x="66" y="0" width="16" height="60" fill="${color}" opacity="0.55"/></g>`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function storefrontSvg(spec: Extract<SceneSpec, { type: "storefront" }>): string {
  const W = 1600;
  const H = 1067;
  const r = rng(spec.seed);
  const skyA = ["#dfe9f3", "#f4e9d8", "#e6eef0"][spec.seed % 3];
  const stripes = Array.from({ length: 12 }, (_, i) => `<rect x="${200 + i * 100}" y="470" width="50" height="90" fill="#ffffff" opacity="0.35"/>`).join("");
  const windows = Array.from({ length: 4 }, (_, i) => `<rect x="${300 + i * 280}" y="600" width="200" height="260" fill="#cfe1ea" stroke="${spec.trim}" stroke-width="10"/><rect x="${300 + i * 280 + 20}" y="620" width="60" height="220" fill="#ffffff" opacity="0.35"/>`).join("");
  const sign = escapeXml(spec.sign.toUpperCase());
  const fontSize = spec.sign.length > 18 ? 70 : 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${skyA}"/>
<circle cx="${(1200 + r() * 200).toFixed(0)}" cy="160" r="70" fill="#fff5d6"/>
<rect x="0" y="900" width="${W}" height="167" fill="#9a9a94"/>
<rect x="120" y="260" width="1360" height="660" fill="${spec.wall}"/>
<rect x="120" y="260" width="1360" height="40" fill="${spec.trim}"/>
<rect x="160" y="330" width="1280" height="130" rx="8" fill="${spec.trim}"/>
<text x="800" y="422" font-family="DejaVu Sans, FreeSans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="6">${sign}</text>
<polygon points="160,470 1440,470 1500,560 100,560" fill="${spec.awning}"/>
${stripes}
${windows}
<rect x="720" y="600" width="160" height="300" fill="${spec.trim}"/><rect x="740" y="620" width="120" height="180" fill="#cfe1ea"/><circle cx="850" cy="770" r="8" fill="#f2d16b"/>
${spec.detail ? detailGlyph(spec.detail, 1200, 660, spec.trim) : ""}
<rect x="60" y="560" width="30" height="340" fill="#5b4a3a"/><ellipse cx="75" cy="520" rx="90" ry="110" fill="#2f5d3a"/>
</svg>`;
}

export function posterSvg(spec: Extract<SceneSpec, { type: "poster" }>): string {
  const W = 1600;
  const H = 900;
  const r = rng(spec.seed);
  const dots = Array.from({ length: 40 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(4 + r() * 14).toFixed(0)}" fill="${spec.accent}" opacity="${(0.15 + r() * 0.3).toFixed(2)}"/>`).join("");
  // Centered composition so 4:3 cover crops of this 16:9 poster keep the words visible.
  const lines = wrap(spec.title.toUpperCase(), 14);
  const top = H / 2 - (lines.length * 100) / 2 + 20;
  const titleSvg = lines.map((l, i) => `<text x="${W / 2}" y="${top + i * 100}" font-family="DejaVu Sans, FreeSans, sans-serif" font-size="84" font-weight="bold" fill="${spec.fg}" text-anchor="middle">${escapeXml(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${spec.bg}"/>${dots}
<rect x="${W / 2 - 110}" y="${top - 130}" width="220" height="14" fill="${spec.accent}"/>
${titleSvg}
<text x="${W / 2}" y="${top + lines.length * 100 + 20}" font-family="DejaVu Serif, serif" font-size="44" fill="${spec.fg}" opacity="0.85" text-anchor="middle">${escapeXml(spec.subtitle)}</text>
</svg>`;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 4);
}

const iconPaths: Record<Extract<SceneSpec, { type: "icon" }>["icon"], string> = {
  shoe: `<path d="M180 520 c40 -90 120 -150 240 -170 l60 60 c80 40 200 60 320 80 l160 40 v70 H180 z" fill="FG"/><path d="M180 590 h780 v40 H180 z" fill="ACC"/><path d="M420 350 l60 60 M470 335 l60 60 M520 320 l60 60" stroke="BG" stroke-width="14"/>`,
  ski: `<path d="M200 700 L900 220" stroke="FG" stroke-width="40" stroke-linecap="round"/><path d="M300 760 L1000 280" stroke="ACC" stroke-width="40" stroke-linecap="round"/><path d="M560 300 l40 -140 M640 320 l40 -140" stroke="FG" stroke-width="18" stroke-linecap="round"/>`,
  jersey: `<path d="M330 250 l150 -70 h240 l150 70 l90 150 l-120 70 l-30 -50 v330 H390 V420 l-30 50 l-120 -70 z" fill="FG"/><text x="600" y="560" font-family="DejaVu Sans, sans-serif" font-size="150" font-weight="bold" fill="ACC" text-anchor="middle">7</text>`,
  wrench: `<path d="M760 200 a120 120 0 0 0 -140 150 L300 670 a60 60 0 0 0 85 85 L705 435 a120 120 0 0 0 150 -140 l-90 90 l-70 -70 z" fill="FG"/><circle cx="330" cy="700" r="22" fill="ACC"/>`,
  trail: `<path d="M120 700 C400 600 500 500 400 380 S700 250 1080 220" stroke="FG" stroke-width="34" fill="none" stroke-dasharray="60 40" stroke-linecap="round"/><polygon points="1040,140 1120,220 960,220" fill="ACC"/>`,
  pond: `<ellipse cx="600" cy="520" rx="420" ry="180" fill="FG"/><ellipse cx="600" cy="520" rx="300" ry="110" fill="ACC" opacity="0.5"/><path d="M200 300 l60 -120 l60 120 z M900 260 l70 -140 l70 140 z" fill="FG"/>`,
  falls: `<rect x="450" y="150" width="120" height="420" fill="ACC"/><rect x="600" y="150" width="90" height="420" fill="ACC" opacity="0.7"/><path d="M300 620 q300 -80 600 0 v160 H300 z" fill="FG"/><path d="M150 150 h900 v60 H150 z" fill="FG"/>`,
};

export function iconSvg(spec: Extract<SceneSpec, { type: "icon" }>): string {
  const W = 1200;
  const H = 900;
  const body = iconPaths[spec.icon].replace(/FG/g, spec.fg).replace(/ACC/g, spec.accent).replace(/BG/g, spec.bg);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${spec.bg}"/><rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="${spec.fg}" stroke-width="6" opacity="0.25"/>${body}</svg>`;
}

const emblems: Record<Extract<SceneSpec, { type: "logo" }>["emblem"], (fg: string, accent: string) => string> = {
  pine: (fg, accent) => `<circle cx="160" cy="160" r="120" fill="${accent}"/><polygon points="160,58 232,196 88,196" fill="${fg}"/><polygon points="160,112 248,252 72,252" fill="${fg}"/><rect x="148" y="244" width="24" height="30" fill="${fg}"/>`,
  peak: (fg, accent) => `<rect x="40" y="40" width="240" height="240" rx="24" fill="${fg}"/><polygon points="62,262 150,112 198,192 228,146 298,262" fill="${accent}"/><polygon points="62,262 150,112 172,150 118,262" fill="${accent}" opacity="0.6"/>`,
  ring: (fg, accent) => `<circle cx="160" cy="160" r="116" fill="none" stroke="${accent}" stroke-width="28"/><circle cx="160" cy="160" r="46" fill="${fg}"/>`,
  shield: (fg, accent) => `<path d="M160 36 L272 78 V170 C272 240 216 280 160 296 C104 280 48 240 48 170 V78 Z" fill="${fg}"/><path d="M160 90 L226 116 V170 C226 212 192 240 160 252 C128 240 94 212 94 170 V116 Z" fill="${accent}"/>`,
  leaf: (fg, accent) => `<path d="M60 262 C60 122 160 42 282 42 C282 182 182 262 60 262 Z" fill="${accent}"/><path d="M74 248 L268 56" stroke="${fg}" stroke-width="14" stroke-linecap="round"/>`,
  sun: (fg, accent) => `<circle cx="160" cy="160" r="76" fill="${accent}"/>${Array.from({ length: 8 }, (_, i) => `<rect x="150" y="30" width="20" height="46" rx="6" fill="${fg}" transform="rotate(${i * 45} 160 160)"/>`).join("")}`,
};

/** Wide wordmark logo (3:1) with a small emblem, on a transparent background. */
export function logoSvg(spec: Extract<SceneSpec, { type: "logo" }>): string {
  const W = 960;
  const H = 320;
  const emblem = emblems[spec.emblem](spec.fg, spec.accent);
  const [first = "", second = ""] = spec.lines;
  const fit = (text: string, max: number, width: number) => Math.min(max, Math.floor(width / (0.62 * Math.max(text.length, 1))));
  const s1 = fit(first, 116, 620);
  const s2 = fit(second, 60, 620);
  const text =
    `<text x="320" y="${second ? 168 : 200}" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="${s1}" fill="${spec.fg}">${escapeXml(first)}</text>` +
    (second ? `<text x="322" y="${168 + s2 + 28}" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="${s2}" letter-spacing="${Math.round(s2 * 0.18)}" fill="${spec.accent}">${escapeXml(second)}</text>` : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${emblem}${text}</svg>`;
}

/** Square portrait: a one-colour head-and-shoulders silhouette, varied by the seed, with a monogram and a ring in the accent colour. */
export function portraitSvg(spec: Extract<SceneSpec, { type: "portrait" }>): string {
  const S = 800;
  const r = rng(spec.seed);
  const headR = 140 + Math.round(r() * 30);
  const headCx = 400 + Math.round((r() - 0.5) * 30);
  const headCy = 340 + Math.round((r() - 0.5) * 30);
  const shoulder = 520 + Math.round(r() * 140);
  const hairStyle = spec.seed % 3;
  const hair =
    hairStyle === 0
      ? `<ellipse cx="${headCx}" cy="${headCy - headR * 0.55}" rx="${headR * 1.05}" ry="${headR * 0.62}" fill="${spec.fg}"/>`
      : hairStyle === 1
        ? `<ellipse cx="${headCx}" cy="${headCy - headR * 0.5}" rx="${headR * 1.02}" ry="${headR * 0.6}" fill="${spec.fg}"/><circle cx="${headCx}" cy="${headCy - headR - 34}" r="52" fill="${spec.fg}"/>`
        : `<ellipse cx="${headCx}" cy="${headCy - headR * 0.3}" rx="${headR * 1.28}" ry="${headR * 0.95}" fill="${spec.fg}"/>`;
  const left = 400 - shoulder / 2;
  const right = 400 + shoulder / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<rect width="${S}" height="${S}" fill="${spec.bg}"/>
<circle cx="400" cy="400" r="372" fill="none" stroke="${spec.accent}" stroke-width="16" opacity="0.4"/>
<text x="64" y="118" font-family="DejaVu Sans, FreeSans, sans-serif" font-size="64" font-weight="bold" letter-spacing="4" fill="${spec.fg}" opacity="0.85">${escapeXml(spec.initials.toUpperCase())}</text>
<path d="M${left} 800 Q${left} 580 ${400 - shoulder / 4} 556 L${400 + shoulder / 4} 556 Q${right} 580 ${right} 800 Z" fill="${spec.fg}"/>
<rect x="366" y="${headCy + headR - 40}" width="68" height="${560 - (headCy + headR - 40)}" fill="${spec.fg}"/>
<path d="M330 556 L400 660 L470 556 Z" fill="${spec.accent}"/>
${hair}
<circle cx="${headCx}" cy="${headCy}" r="${headR}" fill="${spec.fg}"/>
</svg>`;
}

export function sceneSvg(spec: SceneSpec): string {
  switch (spec.type) {
    case "landscape":
      return landscapeSvg(spec);
    case "storefront":
      return storefrontSvg(spec);
    case "poster":
      return posterSvg(spec);
    case "icon":
      return iconSvg(spec);
    case "logo":
      return logoSvg(spec);
    case "portrait":
      return portraitSvg(spec);
  }
}

/** Renders a scene to a PNG buffer suitable for the normal upload pipeline. */
export async function renderScenePng(spec: SceneSpec): Promise<Uint8Array> {
  const svg = Buffer.from(sceneSvg(spec));
  return sharp(svg).png({ compressionLevel: 8 }).toBuffer();
}
