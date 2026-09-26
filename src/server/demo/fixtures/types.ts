import type { Block } from "@/lib/richtext";
import type { PagePayload } from "@/modules/page";
import type { SceneSpec } from "@/server/demo/images";

export interface FixtureImage {
  /** Stable key used to find an existing asset on re-runs. */
  key: string;
  title: string;
  alt: string;
  scene: SceneSpec;
  decorative?: boolean;
}

export interface FixtureItem {
  /** Stable external id, scoped to the site and kind. */
  externalId: string;
  kind: "page" | "place" | "event" | "article" | "store" | "service";
  /** Payload without schemaVersion; media keys are resolved to asset ids at load time. */
  payload: Record<string, unknown>;
  image?: FixtureImage;
  /** Leave this item unapproved after loading (demo of a pending draft). */
  leaveAsDraft?: boolean;
  /** Submit for review and leave it pending. */
  submitForReview?: boolean;
}

export interface FixtureSite {
  key: string;
  config: {
    tagline: string;
    footerText: string;
    defaultDescription: string;
    heroImageKey?: string;
  };
  items: FixtureItem[];
  /** Applied after the first release to create a second historical release. */
  secondRelease: { note: string; apply: (items: FixtureItem[]) => FixtureItem[] };
  inquiry: { name: string; email: string; message: string; sourcePath: string; externalId?: string };
}

export const p = (text: string): Block => ({ type: "paragraph", text });
export const h2 = (text: string): Block => ({ type: "heading", level: 2, text });
export const list = (...items: string[]): Block => ({ type: "list", style: "bullet", items });

export function common(input: { title: string; slug: string; summary: string; body?: Block[]; metaDescription?: string; sourceUrl?: string; lastVerifiedOn?: string; attribution?: string }): Record<string, unknown> {
  return {
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    body: input.body ?? [],
    featuredImageAssetId: null,
    metaTitle: "",
    metaDescription: input.metaDescription ?? "",
    indexable: true,
    sourceUrl: input.sourceUrl ?? "",
    lastVerifiedOn: input.lastVerifiedOn ?? "",
    attribution: input.attribution ?? "",
  };
}

export function page(input: { title: string; slug: string; summary: string; sections: PagePayload["sections"]; metaDescription?: string }): Record<string, unknown> {
  return { ...common({ title: input.title, slug: input.slug, summary: input.summary, metaDescription: input.metaDescription }), sections: input.sections };
}

/** ISO instant for a local wall-clock time in a zone, relative to the fixture clock. */
export function localInstant(base: Date, dayOffset: number, hour: number, minute: number, timeZone: string): string {
  const date = new Date(base.getTime() + dayOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  let guess = Date.UTC(get("year"), get("month") - 1, get("day"), hour, minute);
  for (let i = 0; i < 3; i++) {
    const back = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(guess));
    const g = (t: string) => Number(back.find((x) => x.type === t)?.value);
    const diff = Date.UTC(get("year"), get("month") - 1, get("day"), hour, minute) - Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess).toISOString();
}

export function dateKey(base: Date, dayOffset: number, timeZone: string): string {
  const date = new Date(base.getTime() + dayOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Fourth Thursday of November on or after the clock's date (US Thanksgiving). */
export function nextThanksgiving(base: Date, timeZone: string): string {
  const today = dateKey(base, 0, timeZone);
  for (const year of [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) {
    const first = new Date(Date.UTC(year, 10, 1));
    const offset = (4 - first.getUTCDay() + 7) % 7;
    const day = 1 + offset + 21;
    const key = `${year}-11-${String(day).padStart(2, "0")}`;
    if (key >= today) return key;
  }
  return `${Number(today.slice(0, 4)) + 1}-11-26`;
}

export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days, 12)).toISOString().slice(0, 10);
}
