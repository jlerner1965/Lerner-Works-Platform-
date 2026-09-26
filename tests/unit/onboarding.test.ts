import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildOnboardingTemplate, siteSheetKeys } from "@/server/import/onboarding";
import { csvSpecs, importableKinds, templateCsv } from "@/server/import/csv-spec";
import { parseCsv, rowToPayload, autoMap } from "@/server/import/csv";
import { kindRegistry } from "@/modules/registry";

/** Site-building programme B2-2: the onboarding package template and the row conversions behind it. */
describe("onboarding package template", () => {
  it("holds one sheet per content kind of the preset, the settings sheet, the images sheet and a readme", () => {
    const guide = unzipSync(buildOnboardingTemplate("community_guide", "Cedar Bend Guide"));
    expect(Object.keys(guide).sort()).toEqual(["README.md", "articles.csv", "events.csv", "images.csv", "images/README.txt", "places.csv", "site.csv"]);
    const retail = unzipSync(buildOnboardingTemplate("location_business", "Northfork Outfitters"));
    expect(Object.keys(retail).sort()).toEqual(["README.md", "images.csv", "images/README.txt", "services.csv", "site.csv", "stores.csv"]);
    expect(strFromU8(guide["README.md"]!)).toContain("Cedar Bend Guide");
    expect(strFromU8(guide["places.csv"]!)).toBe(templateCsv("place"));
    // The settings sheet names every key with its explanation; values are left for the client.
    const sheet = parseCsv(strFromU8(guide["site.csv"]!));
    expect(sheet.headers).toEqual(["key", "value", "notes"]);
    expect(sheet.rows.map((r) => r.key)).toEqual(siteSheetKeys.map((k) => k.key));
    expect(sheet.rows.every((r) => r.value === "" && (r.notes ?? "").length > 10)).toBe(true);
    const images = parseCsv(strFromU8(guide["images.csv"]!));
    expect(images.headers).toEqual(["file", "alt_text", "title", "license", "attribution", "source_url", "decorative"]);
  });

  it("gives every importable kind body and image columns, and covers articles and services", () => {
    expect([...importableKinds].sort()).toEqual(["article", "event", "place", "service", "store"]);
    for (const kind of importableKinds) {
      const keys = csvSpecs[kind].map((c) => c.key);
      expect(keys, kind).toContain("body");
      expect(keys, kind).toContain("image");
      expect(keys, kind).toContain("image_alt");
      expect(new Set(keys).size, `${kind} has no duplicate columns`).toBe(keys.length);
      expect(kindRegistry[kind]).toBeDefined();
    }
    expect(csvSpecs.article.filter((c) => c.required).map((c) => c.key)).toEqual(["external_id", "title", "author_name", "published_on"]);
    expect(csvSpecs.service.filter((c) => c.required).map((c) => c.key)).toEqual(["external_id", "title"]);
  });
});

describe("rows become payloads", () => {
  const site = { timeZone: "America/Denver" };
  const convert = (kind: (typeof importableKinds)[number], row: Record<string, string>, services = new Map<string, string>()) => {
    const mapping = autoMap(kind, Object.keys(row));
    return rowToPayload(kind, row, mapping, site, services);
  };

  it("turns body text into blocks and names the featured image", () => {
    const r = convert("article", { external_id: "A-1", title: "Trail day", author_name: "Maya Ortiz", published_on: "2026-09-01", body: "## Why we went\n\nFirst paragraph.\n\n- one\n- two", image: "trail.png", image_alt: "Volunteers on the trail" });
    expect(r.errors).toEqual([]);
    expect(r.image).toBe("trail.png");
    expect(r.imageAlt).toBe("Volunteers on the trail");
    expect(r.payload).toMatchObject({ title: "Trail day", slug: "trail-day", authorName: "Maya Ortiz", publishedOn: "2026-09-01", updatedOn: "", featuredImageAssetId: null });
    expect(r.payload!.body).toEqual([
      { type: "heading", level: 2, text: "Why we went" },
      { type: "paragraph", text: "First paragraph." },
      { type: "list", style: "bullet", items: ["one", "two"] },
    ]);
  });

  it("checks article dates and fills a service", () => {
    expect(convert("article", { external_id: "A-2", title: "Undated", author_name: "X", published_on: "September 1" }).errors).toEqual(["published_on: use YYYY-MM-DD"]);
    const s = convert("service", { external_id: "S-1", title: "Shoe fitting", inquiry_prompt: "Ask about a fitting." });
    expect(s.errors).toEqual([]);
    expect(s.payload).toMatchObject({ slug: "shoe-fitting", inquiryPrompt: "Ask about a fitting.", body: [] });
  });

  it("keeps a store's reference to a service the same package brings", () => {
    const r = convert("store", { external_id: "ST-1", title: "Longmont", address_line1: "1 Main", locality: "Longmont", services: "shoe-fitting" }, new Map([["shoe-fitting", "pending:shoe-fitting"]]));
    expect(r.errors).toEqual([]);
    expect(r.payload!.serviceItemIds).toEqual(["pending:shoe-fitting"]);
  });
});
