import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedInfo, withUser, endPool } from "./helpers";
import { createContentItem, getItem } from "@/server/data/content";
import { createSiteFromPreset } from "@/server/data/sites";

/**
 * Site-building programme B1 (docs/SITE-BUILDING-PLAN.md): the review policy and approval on
 * save (SB-01, SB-02) and one-step publishing (SB-01). The tests work on a page created here in
 * pilot A and on a fresh site created here, so whatever other files do to the fixtures (slug
 * changes, blocked revisions) cannot affect them.
 */
const { users, sites, organizations } = seedInfo();
const owner = users.owner;
const siteA = sites.pineHollow;
const siteB = sites.rangeAthletics;

// The actions read the signed-in user from the request; tests switch the user per call.
let currentUser = owner;
vi.mock("@/server/auth/session", () => ({
  requireUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
  getSessionUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));

/** A page of pilot A created for these tests (editors of pilot A may edit it). */
let pageA = "";
/** A fresh community guide created for the publishing tests: three approved starter pages, no release. */
let siteS = "";

beforeAll(async () => {
  const suffix = Date.now().toString(36);
  const created = await withUser(owner, (db) =>
    createContentItem(db, {
      siteId: siteA,
      organizationId: organizations.pineHollow,
      kind: "page",
      payload: { schemaVersion: 1, title: "Approval on save check", slug: `approval-on-save-${suffix}`, summary: "A page created by the site-building tests.", body: [], featuredImageAssetId: null, metaTitle: "", metaDescription: "", indexable: true, sourceUrl: "", lastVerifiedOn: "", attribution: "", sections: [] },
      authorId: owner,
    }),
  );
  pageA = created.item.id;
  siteS = (await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: `sb-${suffix}`, name: "Site-building check", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} })).siteId;
});

afterAll(async () => {
  currentUser = owner;
  await setPolicy(siteA, false);
  await endPool();
});

async function itemBySlug(userId: string, siteId: string, slug: string) {
  return withUser(userId, async (db) => {
    const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and r.slug = ${slug} and i.archived_at is null`;
    if (!row) throw new Error(`no item with slug ${slug} in site ${siteId}`);
    return (await getItem(db, row.id))!;
  });
}

async function latestReview(revisionId: string): Promise<{ state: string; actorId: string; comment: string | null } | undefined> {
  const rows = await withUser(owner, (db) => db<{ state: string; actorId: string; comment: string | null }[]>`select state::text, actor_id, comment from public.reviews where revision_id = ${revisionId} order by created_at desc limit 1`);
  return rows[0];
}

async function auditCount(action: string, entityId: string): Promise<number> {
  const rows = await withUser(owner, (db) => db<{ n: number }[]>`select count(*)::int as n from public.audit_events where action = ${action} and entity_id = ${entityId}`);
  return rows[0]?.n ?? 0;
}

async function setPolicy(siteId: string, required: boolean) {
  const { setReviewPolicyAction } = await import("@/server/actions/settings");
  const form = new FormData();
  form.set("siteId", siteId);
  if (required) form.set("reviewRequired", "on");
  return setReviewPolicyAction({}, form);
}

/** Saves a new summary on the item as the given user through the real action. */
async function saveSummary(userId: string, itemId: string) {
  const { saveItemAction } = await import("@/server/actions/content");
  currentUser = userId;
  const found = (await withUser(userId, (db) => getItem(db, itemId)))!;
  return saveItemAction({ itemId: found.item.id, baseRevisionId: found.revision.id, payload: { ...found.revision.payload, summary: `Approval on save check ${Date.now()}` } });
}

describe("approval on save under the site's review policy (SB-01, SB-02)", () => {
  it("approves an owner's save on a site that does not require review, in the same transaction, audited", async () => {
    const result = await saveSummary(owner, pageA);
    expect(result.status).toBe("saved");
    expect(result.approved).toBe(true);
    const review = await latestReview(result.revisionId!);
    expect(review?.state).toBe("approved");
    expect(review?.actorId).toBe(owner);
    expect(review?.comment).toContain("Approved on save");
    expect(await auditCount("review.approved_on_save", result.revisionId!)).toBe(1);
  });

  it("never approves an editor's save", async () => {
    const result = await saveSummary(users.editorA, pageA);
    expect(result.status).toBe("saved");
    expect(result.approved).toBe(false);
    const review = await latestReview(result.revisionId!);
    expect(review?.state ?? "unsubmitted").not.toBe("approved");
    expect(await auditCount("review.approved_on_save", result.revisionId!)).toBe(0);
  });

  it("with review required, an owner's own save waits for an explicit approval; only owners change the policy", async () => {
    currentUser = users.editorA;
    expect((await setPolicy(siteA, true)).error).toContain("Only organization owners");
    currentUser = owner;
    expect((await setPolicy(siteA, true)).message).toContain("Review required");
    expect(await auditCount("site.review_policy_changed", siteA)).toBeGreaterThanOrEqual(1);
    const result = await saveSummary(owner, pageA);
    expect(result.status).toBe("saved");
    expect(result.approved).toBe(false);
    expect((await latestReview(result.revisionId!))?.state ?? "unsubmitted").not.toBe("approved");
    currentUser = owner;
    expect((await setPolicy(siteA, false)).message).toContain("not required");
    const again = await saveSummary(owner, pageA);
    expect(again.approved).toBe(true);
  });

  it("approves a publisher's newly created item and a new site's starter pages", async () => {
    const { createItemAction } = await import("@/server/actions/content");
    currentUser = users.publisherB;
    const form = new FormData();
    form.set("siteId", siteB);
    form.set("kind", "service");
    form.set("title", `Approval on save service ${Date.now().toString(36)}`);
    let newId: string | null = null;
    try {
      await createItemAction({}, form);
    } catch (err) {
      newId = /content\/([0-9a-f-]{36})$/.exec((err as Error).message)?.[1] ?? null;
    }
    expect(newId).toBeTruthy();
    const created = await withUser(users.publisherB, (db) => getItem(db, newId!));
    const review = await latestReview(created!.revision.id);
    expect(review?.state).toBe("approved");
    expect(review?.actorId).toBe(users.publisherB);

    // The fresh site's starter pages were approved when the site was created (the owner may publish, review is off).
    const pages = await withUser(owner, (db) => db<{ revisionId: string }[]>`select i.current_revision_id as revision_id from public.content_items i where i.site_id = ${siteS}`);
    expect(pages.length).toBe(3);
    for (const p of pages) expect((await latestReview(p.revisionId))?.state).toBe("approved");
  });
});

describe("one-step publishing from the computed next release (SB-01)", () => {
  async function candidateCount(siteId: string): Promise<number> {
    const rows = await withUser(owner, (db) => db<{ n: number }[]>`select count(*)::int as n from public.release_candidates where site_id = ${siteId}`);
    return rows[0]?.n ?? 0;
  }
  async function publishNow(userId: string, siteId: string, note = "") {
    const { publishNowAction } = await import("@/server/actions/publishing");
    currentUser = userId;
    const form = new FormData();
    form.set("siteId", siteId);
    if (note) form.set("note", note);
    return publishNowAction({}, form);
  }

  it("computes the next release without writing, then publishes it in one action with the note in the release history", async () => {
    const { previewCandidate } = await import("@/server/publishing/candidates");
    const { loadSiteContext } = await import("@/server/data/access");
    const home = await itemBySlug(owner, siteS, "home");
    const saved = await saveSummary(owner, home.item.id);
    expect(saved.approved).toBe(true);
    const before = await candidateCount(siteS);
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteS)))!;
    const preview = await withUser(owner, (db) => previewCandidate(db, ctx.site));
    expect(preview.differs).toBe(true);
    expect(preview.state).toBe("ready");
    // The first release lists everything as added; later ones list the change.
    expect([...preview.summary.added, ...preview.summary.changed].some((c) => c.title === "Home")).toBe(true);
    expect(await candidateCount(siteS)).toBe(before);

    const result = await publishNow(owner, siteS, "Home summary written");
    expect(result.outcome).toBe("activated");
    expect(result.releaseId).toBeTruthy();
    expect(await candidateCount(siteS)).toBe(before + 1);
    const release = await withUser(owner, (db) => db<{ reason: string | null; active: boolean }[]>`select r.reason, (s.active_release_id = r.id) as active from public.releases r join public.sites s on s.id = r.site_id where r.id = ${result.releaseId!}`);
    expect(release[0]?.reason).toBe("Home summary written");
    expect(release[0]?.active).toBe(true);

    // Publishing again with nothing new writes no candidate and no release.
    const again = await publishNow(owner, siteS);
    expect(again.outcome).toBe("nothing");
    expect(await candidateCount(siteS)).toBe(before + 1);
  });

  it("refuses to publish while a blocker exists and names it, without building a candidate", async () => {
    const { saveItemAction } = await import("@/server/actions/content");
    currentUser = owner;
    const about = await itemBySlug(owner, siteS, "about");
    const sections = [...(about.revision.payload.sections as Array<Record<string, unknown>>), { id: `s-${Date.now().toString(36)}`, type: "cta_banner", heading: "Incomplete call to action", text: "", ctaLabel: "", ctaPath: "", secondaryLabel: "", secondaryPath: "" }];
    const broken = await saveItemAction({ itemId: about.item.id, baseRevisionId: about.revision.id, payload: { ...about.revision.payload, sections } });
    expect(broken.status).toBe("saved");
    const before = await candidateCount(siteS);
    const result = await publishNow(owner, siteS);
    expect(result.outcome).toBe("blocked");
    expect(result.error).toContain("block publishing");
    expect(await candidateCount(siteS)).toBe(before);
    // Put the page back and confirm publishing works again.
    const fixed = await saveItemAction({ itemId: about.item.id, baseRevisionId: broken.revisionId!, payload: about.revision.payload });
    expect(fixed.status).toBe("saved");
    const ok = await publishNow(owner, siteS, "About restored");
    expect(ok.outcome).toBe("activated");
  });

  it("is refused for editors", async () => {
    const result = await publishNow(users.editorA, siteA);
    expect(result.outcome).toBe("failed");
    expect(result.error).toContain("permission");
  });
});
