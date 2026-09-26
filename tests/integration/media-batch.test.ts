import { afterAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { seedInfo, withUser, endPool } from "./helpers";
import { ingestImage } from "@/server/media/ingest";

/** Site-building programme B2-3 (SB-05): alternative text for many uploaded images saved in one pass. */
const { users, sites, organizations } = seedInfo();
const owner = users.owner;
const siteA = sites.pineHollow;
const siteB = sites.rangeAthletics;

let currentUser = owner;
vi.mock("@/server/auth/session", () => ({
  requireUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
  getSessionUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

afterAll(async () => {
  await endPool();
});

async function upload(siteId: string, organizationId: string, name: string, colour: string): Promise<string> {
  const bytes = await sharp({ create: { width: 640, height: 480, channels: 3, background: colour } }).png().toBuffer();
  const result = await withUser(owner, (db) => ingestImage(db, { siteId, organizationId, userId: owner, bytes: new Uint8Array(bytes), filename: name, declaredMime: "image/png", license: "CC0" }));
  if (!result.ok) throw new Error(result.error);
  return result.asset.id;
}

async function altOf(assetId: string): Promise<{ altText: string | null; decorative: boolean } | undefined> {
  const rows = await withUser(owner, (db) => db<{ altText: string | null; decorative: boolean }[]>`select alt_text, decorative from public.media_assets where id = ${assetId}`);
  return rows[0];
}

describe("alternative text in one pass after a multi-file upload", () => {
  it("saves text or the decorative mark per image, reports the ones still missing, and never touches another site's image", async () => {
    const { updateAltTextBatchAction } = await import("@/server/actions/media");
    const ids = await Promise.all([upload(siteA, organizations.pineHollow, "bakery-front.png", "#2f5d3a"), upload(siteA, organizations.pineHollow, "divider.png", "#a4502b"), upload(siteA, organizations.pineHollow, "trail.png", "#25302a")]);
    const foreign = await upload(siteB, organizations.rangeAthletics, "store.png", "#12213a");
    const form = new FormData();
    form.set("siteId", siteA);
    for (const id of [...ids, foreign]) form.append("assetId", id);
    form.set(`alt_${ids[0]}`, "The bakery's front window at dawn");
    form.set(`decorative_${ids[1]}`, "on");
    // ids[2] gets nothing: reported, not saved.
    form.set(`alt_${foreign}`, "Someone else's store");
    currentUser = owner;
    const result = await updateAltTextBatchAction({}, form);
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Saved alternative text for 2 images");
    expect(result.failed).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: ids[2], reason: expect.stringContaining("Enter alternative text") }),
      expect.objectContaining({ assetId: foreign, reason: expect.stringContaining("could not be updated") }),
    ]));
    expect(await altOf(ids[0]!)).toEqual({ altText: "The bakery's front window at dawn", decorative: false });
    expect(await altOf(ids[1]!)).toEqual({ altText: null, decorative: true });
    expect(await altOf(ids[2]!)).toEqual({ altText: null, decorative: false });
    expect(await altOf(foreign)).toEqual({ altText: null, decorative: false });

    // An editor of site A may finish the pass; a stranger to the site cannot.
    const again = new FormData();
    again.set("siteId", siteA);
    again.append("assetId", ids[2]!);
    again.set(`alt_${ids[2]}`, "A trail through aspens");
    currentUser = users.editorA;
    expect((await updateAltTextBatchAction({}, again)).message).toContain("Saved alternative text for 1 image");
    expect(await altOf(ids[2]!)).toEqual({ altText: "A trail through aspens", decorative: false });
    currentUser = users.publisherB;
    expect((await updateAltTextBatchAction({}, again)).error).toContain("edit access");
  });
});
