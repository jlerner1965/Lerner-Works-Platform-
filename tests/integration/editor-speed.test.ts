import { afterAll, describe, expect, it, vi } from "vitest";
import { seedInfo, withUser, endPool } from "./helpers";
import { getItem } from "@/server/data/content";
import { loadCategories } from "@/server/data/editor-context";
import type { ContentKind } from "@/modules/registry";

/** Site-building programme B2-4: creating from a title with the site's defaults (quick add), duplicating an item, category suggestions. */
const { users, sites } = seedInfo();
const owner = users.owner;
const siteA = sites.pineHollow;
const siteB = sites.rangeAthletics;

let currentUser = owner;
vi.mock("@/server/auth/session", () => ({
  requireUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
  getSessionUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));

afterAll(async () => {
  await endPool();
});

/** Runs an action that redirects on success and returns the item id from the redirect, or the returned state. */
async function createVia(userId: string, fields: Record<string, string>): Promise<{ id: string | null; state: { error?: string; fieldErrors?: Record<string, string> } }> {
  const { createItemAction } = await import("@/server/actions/content");
  currentUser = userId;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  try {
    const state = await createItemAction({}, form);
    return { id: null, state };
  } catch (err) {
    return { id: /content\/([0-9a-f-]{36})$/.exec((err as Error).message)?.[1] ?? null, state: {} };
  }
}

async function duplicateVia(userId: string, siteId: string, itemId: string): Promise<{ id: string | null; error?: string }> {
  const { duplicateItemAction } = await import("@/server/actions/content");
  currentUser = userId;
  const form = new FormData();
  form.set("siteId", siteId);
  form.set("itemId", itemId);
  try {
    const state = await duplicateItemAction({}, form);
    return { id: null, error: state.error };
  } catch (err) {
    return { id: /content\/([0-9a-f-]{36})$/.exec((err as Error).message)?.[1] ?? null };
  }
}

async function latestReviewState(revisionId: string): Promise<string | null> {
  const rows = await withUser(owner, (db) => db<{ state: string }[]>`select state::text from public.reviews where revision_id = ${revisionId} order by created_at desc limit 1`);
  return rows[0]?.state ?? null;
}

describe("creating from a title with the site's defaults (quick add)", () => {
  const suffix = Date.now().toString(36);
  it("creates a draft of every kind of each preset from a title alone; articles are attributed to the site until a person is named", async () => {
    const cases: Array<{ siteId: string; kind: ContentKind; extra?: Record<string, string> }> = [
      { siteId: siteA, kind: "page" },
      { siteId: siteA, kind: "place", extra: { category: "Bakeries" } },
      { siteId: siteA, kind: "event" },
      { siteId: siteA, kind: "article" },
      { siteId: siteB, kind: "store" },
      { siteId: siteB, kind: "service" },
    ];
    for (const c of cases) {
      const created = await createVia(owner, { siteId: c.siteId, kind: c.kind, title: `Quick ${c.kind} ${suffix}`, ...(c.extra ?? {}) });
      expect(created.id, `${c.kind}: ${JSON.stringify(created.state)}`).toBeTruthy();
      const found = (await withUser(owner, (db) => getItem(db, created.id!)))!;
      expect(found.item.kind).toBe(c.kind);
      expect(found.revision.slug).toBe(`quick-${c.kind}-${suffix}`);
      if (c.kind === "article") expect(found.revision.payload.authorName).toBe("Pine Hollow Guide");
      if (c.kind === "event" || c.kind === "store") expect(found.revision.payload.timeZone).toBe("America/Denver");
      if (c.kind === "place") expect(found.revision.payload.category).toBe("Bakeries");
      // The owner's new item is approved on save (review off on the pilots).
      expect(await latestReviewState(found.revision.id)).toBe("approved");
    }
  });

  it("asks for a category when a place is added from the list, and suggests the site's existing ones", async () => {
    const refused = await createVia(owner, { siteId: siteA, kind: "place", title: `No category ${suffix}`, category: "  " });
    expect(refused.id).toBeNull();
    expect(refused.state.fieldErrors?.category).toContain("category");
    const categories = await withUser(owner, (db) => loadCategories(db, siteA));
    expect(categories).toContain("Bakeries");
    expect(categories.length).toBeGreaterThan(1);
    expect(new Set(categories).size).toBe(categories.length);
  });
});

describe("duplicating an item", () => {
  it("copies the saved version into a new draft with a free slug, approved on save for the owner, never for an editor", async () => {
    const suffix = Date.now().toString(36);
    const created = await createVia(owner, { siteId: siteA, kind: "place", title: `Original ${suffix}`, category: "Bakeries" });
    expect(created.id).toBeTruthy();
    // Give the original some detail so the copy proves it carries the payload.
    const { saveItemAction } = await import("@/server/actions/content");
    const original = (await withUser(owner, (db) => getItem(db, created.id!)))!;
    const saved = await saveItemAction({ itemId: original.item.id, baseRevisionId: original.revision.id, payload: { ...original.revision.payload, summary: "Sourdough and rye, baked before dawn every day of the week.", phone: "(303) 555-0100" } });
    expect(saved.status).toBe("saved");

    const first = await duplicateVia(owner, siteA, created.id!);
    expect(first.id).toBeTruthy();
    const copy = (await withUser(owner, (db) => getItem(db, first.id!)))!;
    expect(copy.item.kind).toBe("place");
    expect(copy.item.id).not.toBe(created.id);
    expect(copy.revision.title).toBe(`Original ${suffix} (copy)`);
    expect(copy.revision.slug).toBe(`original-${suffix}-copy`);
    expect(copy.revision.payload.summary).toBe("Sourdough and rye, baked before dawn every day of the week.");
    expect(copy.revision.payload.phone).toBe("(303) 555-0100");
    expect(copy.item.externalId).toBeNull();
    expect(await latestReviewState(copy.revision.id)).toBe("approved");

    // A second copy takes the next free slug.
    const second = await duplicateVia(owner, siteA, created.id!);
    const copy2 = (await withUser(owner, (db) => getItem(db, second.id!)))!;
    expect(copy2.revision.slug).toBe(`original-${suffix}-copy-2`);

    // An editor's copy is a plain draft.
    const byEditor = await duplicateVia(users.editorA, siteA, created.id!);
    expect(byEditor.id).toBeTruthy();
    const copy3 = (await withUser(users.editorA, (db) => getItem(db, byEditor.id!)))!;
    expect(copy3.revision.slug).toBe(`original-${suffix}-copy-3`);
    expect(await latestReviewState(copy3.revision.id)).toBeNull();

    // Nobody copies across sites: an item of site B through site A is refused.
    const stores = await withUser(owner, (db) => db<{ id: string }[]>`select id from public.content_items where site_id = ${siteB} and kind = 'store' limit 1`);
    const foreign = await duplicateVia(owner, siteA, stores[0]!.id);
    expect(foreign.id).toBeNull();
    expect(foreign.error).toContain("not found");
  });
});
