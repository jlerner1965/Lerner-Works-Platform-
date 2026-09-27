import type { ThemeKey } from "@/modules/site-config";

export interface RelatedItem {
  id: string;
  title: string;
  slug: string;
}

export interface AssetOption {
  id: string;
  title: string;
  alt: string;
  /** Pixel dimensions of a picture; 0 for a document. */
  width: number;
  height: number;
  thumbUrl: string | null;
  status: string;
  /** A picture, or a document (PDF) offered where a download is wanted (B5-1). */
  kind: "image" | "document";
  /** Size of a document's file, for the picker. */
  bytes: number;
}

export interface EditorContext {
  siteId: string;
  timeZone: string;
  related: Partial<Record<"place" | "event" | "article" | "store" | "service" | "page" | "link", RelatedItem[]>>;
  assets: AssetOption[];
  routes: string[];
  /** Categories the site's places already use, most used first (suggestions for the Category field). */
  categories: string[];
  /** Categories the site's links already use (B5-2). */
  linkCategories: string[];
  /** Theme rendering this site; decides which section types and styles the editor offers. */
  themeKey: ThemeKey;
}

export type Issues = Record<string, string>;

export type Payload = Record<string, unknown>;

export function issueFor(issues: Issues, path: string): string | undefined {
  return issues[path];
}
