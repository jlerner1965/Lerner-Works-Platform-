import { describe, expect, it } from "vitest";
import { siteNavSections } from "@/server/data/site-nav";
import { computeCapabilities, type SiteContext, type SiteRow } from "@/server/data/access";

/** Site-building programme B1 (SB-03): the sidebar is grouped by task and hides what a role cannot use. */
function context(preset: SiteRow["preset"], orgRole: "owner" | null, siteRole: "editor" | "reviewer" | "publisher" | null): SiteContext {
  const site = { id: "11111111-1111-4111-8111-111111111111", organizationId: "o", key: "k", name: "Cedar Bend", preset, timeZone: "America/Denver", mode: "demo", status: "active", contactEmail: null, contactPhone: null, contactAddress: null, inquiryRecipients: [], currentConfigRevisionId: null, activeReleaseId: null, designDelegated: false, reviewRequired: false, demoContentLoadedAt: null, createdAt: new Date(), updatedAt: new Date() } as SiteRow;
  return { site, organization: { id: "o", name: "Org" }, capabilities: computeCapabilities(orgRole, siteRole) };
}

const labels = (ctx: SiteContext) => siteNavSections(ctx).map((s) => ({ title: s.title, items: s.items.map((i) => i.label) }));

describe("sidebar grouped by task", () => {
  it("offers an owner every task of a community guide, grouped", () => {
    expect(labels(context("community_guide", "owner", null))).toEqual([
      { title: "Cedar Bend", items: ["Overview"] },
      { title: "Content", items: ["Pages", "Places", "Events", "Articles", "Media", "Reviews"] },
      { title: "Site", items: ["Look", "Publish", "Inbox", "Settings"] },
      { title: "Manage", items: ["Team", "Import & export", "Activity log"] },
    ]);
  });

  it("lists the location business kinds and links each kind to its filtered list", () => {
    const sections = siteNavSections(context("location_business", "owner", null));
    const content = sections[1]!;
    expect(content.items.map((i) => i.label)).toEqual(["Pages", "Stores", "Services", "Media", "Reviews"]);
    expect(content.items[1]!.href).toMatch(/\/content\?kind=store$/);
  });

  it("hides what editors and reviewers cannot use", () => {
    expect(labels(context("community_guide", null, "editor"))).toEqual([
      { title: "Cedar Bend", items: ["Overview"] },
      { title: "Content", items: ["Pages", "Places", "Events", "Articles", "Media", "Reviews"] },
      { title: "Manage", items: ["Import & export"] },
    ]);
    expect(labels(context("community_guide", null, "reviewer"))).toEqual([
      { title: "Cedar Bend", items: ["Overview"] },
      { title: "Content", items: ["Pages", "Places", "Events", "Articles", "Reviews"] },
    ]);
  });

  it("gives publishers the site tasks but not the team", () => {
    const groups = labels(context("location_business", null, "publisher"));
    expect(groups.find((g) => g.title === "Site" && g.items.includes("Publish"))?.items).toEqual(["Look", "Publish", "Inbox", "Settings"]);
    expect(groups.find((g) => g.title === "Manage")?.items).toEqual(["Import & export", "Activity log"]);
  });
});
