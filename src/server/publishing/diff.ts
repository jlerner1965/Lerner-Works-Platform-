import { kindRegistry } from "@/modules/registry";
import type { ReleaseSnapshot, SnapshotItem } from "@/server/publishing/snapshot";

export interface ItemChange {
  itemId: string;
  kind: string;
  title: string;
  path: string | null;
  fields: string[];
}

export interface ChangeSummary {
  firstRelease: boolean;
  added: Array<{ itemId: string; kind: string; title: string; path: string | null }>;
  removed: Array<{ itemId: string; kind: string; title: string; path: string | null }>;
  changed: ItemChange[];
  removedRoutes: string[];
  addedRoutes: string[];
  newRedirects: Array<{ from: string; to: string }>;
  navigationChanged: { before: string[]; after: string[] } | null;
  configFields: string[];
  mediaAdded: string[];
  mediaRemoved: string[];
  /** Assets present in both releases whose published data changed (for example the focal point). */
  mediaChanged?: string[];
}

const fieldLabels: Record<string, string> = {
  title: "Title",
  slug: "Slug",
  summary: "Summary",
  body: "Body",
  featuredImageAssetId: "Featured image",
  metaTitle: "Meta title",
  metaDescription: "Meta description",
  indexable: "Indexability",
  sourceUrl: "Source URL",
  lastVerifiedOn: "Last verified date",
  attribution: "Attribution",
  sections: "Page sections",
  category: "Category",
  address: "Address",
  areaDescription: "Area description",
  website: "Website",
  phone: "Phone",
  hours: "Hours",
  nextAction: "Next action",
  startsAt: "Start",
  endsAt: "End",
  timeZone: "Time zone",
  venueItemId: "Venue",
  venueText: "Venue text",
  organizerName: "Organizer",
  organizerUrl: "Organizer URL",
  status: "Status",
  eventUrl: "Event URL",
  admission: "Admission",
  authorName: "Author",
  publishedOn: "Publication date",
  updatedOn: "Updated date",
  weeklyHours: "Weekly hours",
  exceptions: "Date exceptions",
  serviceItemIds: "Services",
  statusNote: "Status note",
  inquiryPrompt: "Inquiry prompt",
};

export function labelForField(field: string): string {
  return fieldLabels[field] ?? field;
}

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.keys(val).sort().reduce((o: Record<string, unknown>, k) => ((o[k] = (val as Record<string, unknown>)[k]), o), {}) : val));
}

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: string[] = [];
  for (const k of keys) {
    if (k === "schemaVersion") continue;
    if (stable(before[k]) !== stable(after[k])) out.push(k);
  }
  return out;
}

function pathOf(s: ReleaseSnapshot, itemId: string): string | null {
  return s.routes.find((r) => r.itemId === itemId)?.path ?? null;
}

/** Human-readable change summary between the base release and a manifest. */
export function summarizeChanges(base: ReleaseSnapshot | null, next: ReleaseSnapshot): ChangeSummary {
  const summary: ChangeSummary = {
    firstRelease: !base,
    added: [],
    removed: [],
    changed: [],
    removedRoutes: [],
    addedRoutes: [],
    newRedirects: [],
    navigationChanged: null,
    configFields: [],
    mediaAdded: [],
    mediaRemoved: [],
  };
  const describe = (s: ReleaseSnapshot, it: SnapshotItem) => ({ itemId: it.id, kind: kindRegistry[it.kind].label, title: it.title, path: pathOf(s, it.id) });
  for (const it of Object.values(next.items)) {
    const prev = base?.items[it.id];
    if (!prev) summary.added.push(describe(next, it));
    else if (prev.revisionId !== it.revisionId) {
      summary.changed.push({ ...describe(next, it), fields: changedFields(prev.payload, it.payload).map(labelForField) });
    }
  }
  if (base) {
    for (const it of Object.values(base.items)) if (!next.items[it.id]) summary.removed.push(describe(base, it));
    const basePaths = new Set(base.routes.map((r) => r.path));
    const nextPaths = new Set(next.routes.map((r) => r.path));
    summary.removedRoutes = [...basePaths].filter((p) => !nextPaths.has(p)).sort();
    summary.addedRoutes = [...nextPaths].filter((p) => !basePaths.has(p)).sort();
    const baseRedirects = new Set(base.redirects.map((r) => `${r.from}→${r.to}`));
    summary.newRedirects = next.redirects.filter((r) => !baseRedirects.has(`${r.from}→${r.to}`));
    const navBefore = base.config.navigation.items.map((n) => `${n.label} (${n.path})`);
    const navAfter = next.config.navigation.items.map((n) => `${n.label} (${n.path})`);
    if (navBefore.join("|") !== navAfter.join("|")) summary.navigationChanged = { before: navBefore, after: navAfter };
    if (base.config.navigation.showSearch !== next.config.navigation.showSearch) summary.configFields.push("navigation");
    for (const key of ["branding", "footer", "modules", "indexes", "metadata"] as const) {
      if (stable(base.config[key]) !== stable(next.config[key])) summary.configFields.push(key);
    }
    summary.mediaAdded = Object.keys(next.media).filter((id) => !base.media[id]);
    summary.mediaRemoved = Object.keys(base.media).filter((id) => !next.media[id]);
    summary.mediaChanged = Object.keys(next.media).filter((id) => base.media[id] && stable(base.media[id]) !== stable(next.media[id]));
  } else {
    summary.addedRoutes = next.routes.map((r) => r.path).sort();
    summary.mediaAdded = Object.keys(next.media);
  }
  return summary;
}
