import type { Db } from "@/server/data/db";
import type { SiteRow } from "@/server/data/access";
import type { EditorContext, RelatedItem, AssetOption } from "@/components/admin/editor/types";
import { moduleIndexRoutes } from "@/modules/registry";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { themeKeyFor } from "@/themes/capabilities";

/** The categories the site's places use (current working revisions, not archived), most used first, for suggestions. */
export async function loadCategories(db: Db, siteId: string): Promise<string[]> {
  const rows = await db<{ category: string }[]>`
    select r.payload->>'category' as category from public.content_items i
    join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${siteId} and i.kind = 'place' and i.archived_at is null and coalesce(r.payload->>'category', '') <> ''
    group by 1 order by count(*) desc, 1`;
  return rows.map((r) => r.category);
}

/** Related items, ready assets, known routes and category suggestions for pickers, all scoped to one site. */
export async function loadEditorContext(db: Db, site: SiteRow): Promise<EditorContext> {
  const rows = await db<Array<RelatedItem & { kind: string }>>`
    select i.id, i.kind::text, r.title, r.slug from public.content_items i
    join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${site.id} and i.archived_at is null
    order by r.title`;
  const related: EditorContext["related"] = {};
  for (const row of rows) {
    const k = row.kind as keyof EditorContext["related"];
    (related[k] ??= []).push({ id: row.id, title: row.title, slug: row.slug });
  }
  const assets = await db<Array<{ id: string; title: string | null; altText: string | null; width: number; height: number; status: string; derivatives: Record<string, { key: string }> }>>`
    select id, title, alt_text, width, height, status::text, derivatives from public.media_assets where site_id = ${site.id} and status <> 'withdrawn' order by created_at desc limit 200`;
  const assetOptions: AssetOption[] = assets.map((a) => ({
    id: a.id,
    title: a.title ?? "",
    alt: a.altText ?? "",
    width: a.width,
    height: a.height,
    status: a.status,
    thumbUrl: a.derivatives.w480 ? `/app/sites/${site.id}/media/${a.id}/file/w480` : null,
  }));
  const config = await getCurrentSiteConfig(db, site.id);
  const routes: string[] = ["/"];
  for (const page of related.page ?? []) if (page.slug !== "home") routes.push(`/${page.slug}`);
  if (config) for (const idx of moduleIndexRoutes) if (config.config.modules[idx.module]) routes.push(idx.path);
  const categories = related.place ? await loadCategories(db, site.id) : [];
  return { siteId: site.id, timeZone: site.timeZone, related, assets: assetOptions, routes, categories, themeKey: themeKeyFor(site.preset, config?.config.design) };
}
