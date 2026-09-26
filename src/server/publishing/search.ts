import { kindRegistry, type ContentKind } from "@/modules/registry";
import { blocksToPlainText, type Block } from "@/lib/richtext";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";
import { formatEventDate } from "@/lib/events";

export interface SearchResult {
  path: string;
  title: string;
  kind: ContentKind;
  kindLabel: string;
  meta: string;
  snippet: string;
  score: number;
}

interface IndexEntry {
  path: string;
  title: string;
  kind: ContentKind;
  meta: string;
  snippet: string;
  tokens: { title: string[]; strong: string[]; body: string[] };
  category: string;
  locality: string;
  services: string[];
  startsAt: string | null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

const indexCache = new WeakMap<ReleaseSnapshot, IndexEntry[]>();

/** Deterministic in-memory index of the published snapshot: titles, summaries, categories, localities. */
export function buildSearchIndex(snapshot: ReleaseSnapshot): IndexEntry[] {
  const cached = indexCache.get(snapshot);
  if (cached) return cached;
  const entries: IndexEntry[] = [];
  for (const route of snapshot.routes) {
    if (!route.itemId) continue;
    const item = snapshot.items[route.itemId];
    if (!item) continue;
    const p = item.payload as Record<string, unknown>;
    if (p.indexable === false) continue;
    const summary = String(p.summary ?? "");
    const bodyText = blocksToPlainText((p.body as Block[]) ?? []);
    const sectionsText = item.kind === "page" ? ((p.sections as Array<Record<string, unknown>>) ?? []).map((s) => [s.heading, s.subheading, s.text, s.intro, Array.isArray(s.body) ? blocksToPlainText(s.body as Block[]) : ""].filter(Boolean).join(" ")).join(" ") : "";
    const category = String(p.category ?? "");
    const address = p.address as { locality?: string } | undefined;
    const locality = address?.locality ?? "";
    const services = item.kind === "store" ? ((p.serviceItemIds as string[]) ?? []).map((id) => snapshot.items[id]?.title ?? "").filter(Boolean) : [];
    const startsAt = item.kind === "event" ? String(p.startsAt) : null;
    const meta = item.kind === "event" && startsAt ? formatEventDate(startsAt, String(p.timeZone)) : item.kind === "place" ? category : item.kind === "store" ? locality : item.kind === "article" ? `By ${String(p.authorName ?? "")}` : "";
    entries.push({
      path: route.path,
      title: item.title,
      kind: item.kind,
      meta,
      snippet: summary || (bodyText || sectionsText).slice(0, 160),
      tokens: { title: tokenize(item.title), strong: tokenize([category, locality, ...services].join(" ")), body: tokenize([summary, bodyText, sectionsText].join(" ")) },
      category,
      locality,
      services,
      startsAt,
    });
  }
  indexCache.set(snapshot, entries);
  return entries;
}

export interface SearchOptions {
  query: string;
  kind?: string;
  category?: string;
  locality?: string;
  service?: string;
  now: Date;
  limit?: number;
}

export function searchSnapshot(snapshot: ReleaseSnapshot, opts: SearchOptions): SearchResult[] {
  const index = buildSearchIndex(snapshot);
  const terms = tokenize(opts.query);
  const results: SearchResult[] = [];
  for (const e of index) {
    if (opts.kind && e.kind !== opts.kind) continue;
    if (opts.category && e.category !== opts.category) continue;
    if (opts.locality && e.locality !== opts.locality) continue;
    if (opts.service && !e.services.includes(opts.service)) continue;
    let score = 0;
    if (terms.length === 0) score = 1;
    for (const t of terms) {
      const titleHit = e.tokens.title.some((x) => x === t || x.startsWith(t));
      const strongHit = e.tokens.strong.some((x) => x === t || x.startsWith(t));
      const bodyHit = e.tokens.body.some((x) => x === t || x.startsWith(t));
      if (titleHit) score += 10;
      if (strongHit) score += 5;
      if (bodyHit) score += 1;
      if (!titleHit && !strongHit && !bodyHit) {
        score = 0;
        break;
      }
    }
    if (score <= 0) continue;
    results.push({ path: e.path, title: e.title, kind: e.kind, kindLabel: kindRegistry[e.kind].label, meta: e.meta, snippet: e.snippet, score });
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return results.slice(0, opts.limit ?? 50);
}
