import { contrastRatio, hexToRgb } from "@/lib/contrast";

/**
 * Derived brand tokens. A site owner chooses four colours (primary, accent, background,
 * text); everything else a theme needs is computed here with the formulas below, so a
 * recolour is complete and every pairing a theme renders can be checked before publication.
 *
 * Formulas (sRGB channel mixing, documented in docs/DESIGN-TOKENS.md):
 * - surface        = mix(background → text, 4 %)     tinted panels: forms, callouts, notices
 * - surfaceStrong  = mix(background → text, 9 %)     stronger tint: placeholders, banners
 * - muted          = text mixed toward background as far as 40 %, stopping at the lightest
 *                    step that keeps 4.5:1 against both background and surfaceStrong
 * - border         = mix(background → text, 18 %)    decorative rules and dividers
 * - borderStrong   = background mixed toward text from 35 % up, first step with 3:1 against
 *                    background and surface (form field borders, WCAG 1.4.11)
 * - focus          = first of accent, primary, text with 3:1 against background and surfaceStrong
 * - onPrimary/onAccent/onText = white when white reads at 4.5:1 on that colour; otherwise the
 *                    first of text, background, near-black that does; otherwise the best of them
 * - danger/success = fixed base hues pushed toward black (light backgrounds) or white (dark
 *                    backgrounds) in 5 % steps until 4.5:1 against background and surface
 * - dangerSoft/successSoft = mix(background → status colour, 10 %) when the status colour
 *                    still reads at 4.5:1 on it; otherwise surface
 */
export interface BrandColors {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

export interface BrandTokens extends BrandColors {
  surface: string;
  surfaceStrong: string;
  muted: string;
  border: string;
  borderStrong: string;
  focus: string;
  onPrimary: string;
  onAccent: string;
  onText: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
}

export interface BrandPairing {
  id: string;
  /** What the pairing is used for, in the owner's words. */
  label: string;
  fg: string;
  bg: string;
  /** Minimum contrast ratio: 4.5 for text, 3 for non-text indicators. */
  minimum: 4.5 | 3;
  ratio: number;
  passes: boolean;
}

const WHITE = "#ffffff";
const NEAR_BLACK = "#111111";
const DANGER_BASE = "#b42318";
const SUCCESS_BASE = "#1e7f4f";

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mixes `from` toward `to` by `amount` (0–1) per sRGB channel. */
export function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = Math.max(0, Math.min(1, amount));
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

function isLight(hex: string): boolean {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, WHITE);
}

function readsOn(fg: string, backgrounds: string[], minimum: number): boolean {
  return backgrounds.every((bg) => contrastRatio(fg, bg) >= minimum);
}

/** First candidate that reads on every background; otherwise the candidate with the best worst-case ratio. */
function pickReadable(candidates: string[], backgrounds: string[], minimum: number): string {
  for (const c of candidates) if (readsOn(c, backgrounds, minimum)) return c;
  let best = candidates[0]!;
  let bestRatio = -1;
  for (const c of candidates) {
    const worst = Math.min(...backgrounds.map((bg) => contrastRatio(c, bg)));
    if (worst > bestRatio) {
      best = c;
      bestRatio = worst;
    }
  }
  return best;
}

/** Steps a colour toward black or white (whichever the background is not) until it reads. */
function ensureContrast(color: string, backgrounds: string[], minimum: number): string {
  if (readsOn(color, backgrounds, minimum)) return color;
  const toward = isLight(backgrounds[0]!) ? "#000000" : WHITE;
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(color, toward, step * 0.05);
    if (readsOn(candidate, backgrounds, minimum)) return candidate;
  }
  return toward;
}

function textOn(bg: string, colors: BrandColors): string {
  return pickReadable([WHITE, colors.text, colors.background, NEAR_BLACK], [bg], 4.5);
}

export function deriveBrandTokens(colors: BrandColors): BrandTokens {
  const { primary, accent, background, text } = colors;
  const surface = mix(background, text, 0.04);
  const surfaceStrong = mix(background, text, 0.09);

  let muted = text;
  for (const t of [0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05]) {
    const candidate = mix(text, background, t);
    if (readsOn(candidate, [background, surfaceStrong], 4.5)) {
      muted = candidate;
      break;
    }
  }

  const border = mix(background, text, 0.18);
  let borderStrong = text;
  for (let t = 0.35; t <= 1.0001; t += 0.05) {
    const candidate = mix(background, text, t);
    if (readsOn(candidate, [background, surface], 3)) {
      borderStrong = candidate;
      break;
    }
  }

  const focus = pickReadable([accent, primary, text], [background, surfaceStrong], 3);
  const danger = ensureContrast(DANGER_BASE, [background, surface], 4.5);
  const success = ensureContrast(SUCCESS_BASE, [background, surface], 4.5);
  const dangerSoftCandidate = mix(background, danger, 0.1);
  const successSoftCandidate = mix(background, success, 0.1);

  return {
    primary,
    accent,
    background,
    text,
    surface,
    surfaceStrong,
    muted,
    border,
    borderStrong,
    focus,
    onPrimary: textOn(primary, colors),
    onAccent: textOn(accent, colors),
    onText: textOn(text, colors),
    danger,
    dangerSoft: contrastRatio(danger, dangerSoftCandidate) >= 4.5 ? dangerSoftCandidate : surface,
    success,
    successSoft: contrastRatio(success, successSoftCandidate) >= 4.5 ? successSoftCandidate : surface,
  };
}

/** CSS custom properties for a theme root element. */
export function brandCssVariables(tokens: BrandTokens): Record<string, string> {
  return {
    "--brand-primary": tokens.primary,
    "--brand-accent": tokens.accent,
    "--brand-bg": tokens.background,
    "--brand-text": tokens.text,
    "--brand-surface": tokens.surface,
    "--brand-surface-strong": tokens.surfaceStrong,
    "--brand-muted": tokens.muted,
    "--brand-border": tokens.border,
    "--brand-border-strong": tokens.borderStrong,
    "--brand-focus": tokens.focus,
    "--brand-on-primary": tokens.onPrimary,
    "--brand-on-accent": tokens.onAccent,
    "--brand-on-text": tokens.onText,
    "--brand-danger": tokens.danger,
    "--brand-danger-soft": tokens.dangerSoft,
    "--brand-success": tokens.success,
    "--brand-success-soft": tokens.successSoft,
  };
}

/**
 * Every colour pairing the themes render, with the WCAG 2.2 AA minimum that applies. The
 * publication gate blocks on any failing pairing; the settings page shows the same list.
 */
export function brandPairings(colors: BrandColors): BrandPairing[] {
  const t = deriveBrandTokens(colors);
  const pair = (id: string, label: string, fg: string, bg: string, minimum: 4.5 | 3 = 4.5): BrandPairing => {
    const ratio = contrastRatio(fg, bg);
    return { id, label, fg, bg, minimum, ratio, passes: ratio >= minimum };
  };
  return [
    pair("text-bg", "Body text on the background", t.text, t.background),
    pair("text-surface", "Body text on tinted panels (forms, callouts, notices)", t.text, t.surface),
    pair("muted-bg", "Secondary text on the background", t.muted, t.background),
    pair("primary-bg", "Headings and primary-coloured text on the background", t.primary, t.background),
    pair("primary-surface", "Headings on tinted panels", t.primary, t.surface),
    pair("accent-bg", "Links and accent text on the background", t.accent, t.background),
    pair("accent-surface", "Links on tinted panels", t.accent, t.surface),
    pair("on-primary", "Text on primary buttons and primary-coloured areas", t.onPrimary, t.primary),
    pair("on-accent", "Text on accent buttons", t.onAccent, t.accent),
    pair("on-text", "Text on text-coloured bars (demonstration banner, skip link)", t.onText, t.text),
    pair("danger-bg", "Closure and error notices on the background", t.danger, t.background),
    pair("danger-soft", "Closure notices on their tinted panel", t.danger, t.dangerSoft),
    pair("success-bg", "Open-now status on the background", t.success, t.background),
    pair("focus-bg", "Keyboard focus ring against the background", t.focus, t.background, 3),
    pair("border-strong-bg", "Form field borders against the background", t.borderStrong, t.background, 3),
  ];
}

export function failingPairings(colors: BrandColors): BrandPairing[] {
  return brandPairings(colors).filter((p) => !p.passes);
}
