export interface RelatedItem {
  id: string;
  title: string;
  slug: string;
}

export interface AssetOption {
  id: string;
  title: string;
  alt: string;
  width: number;
  height: number;
  thumbUrl: string | null;
  status: string;
}

export interface EditorContext {
  siteId: string;
  timeZone: string;
  related: Partial<Record<"place" | "event" | "article" | "store" | "service" | "page", RelatedItem[]>>;
  assets: AssetOption[];
  routes: string[];
  /** Theme rendering this site; decides which section types and styles the editor offers. */
  themeKey: "guide" | "locations";
}

export type Issues = Record<string, string>;

export type Payload = Record<string, unknown>;

export function issueFor(issues: Issues, path: string): string | undefined {
  return issues[path];
}
