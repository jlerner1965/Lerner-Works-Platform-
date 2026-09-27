import type { ContentKind } from "@/modules/registry";

export interface ColumnSpec {
  key: string;
  required?: boolean;
  description: string;
  example: string;
}

const hoursColumns: ColumnSpec[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => ({
  key: `hours_${d}`,
  description: `Intervals for ${d}: "09:00-18:00", several separated by ";" ("09:00-13:00;14:00-18:00"), "closed", or "unknown" (any day marked unknown makes the whole week unknown). An interval ending at or before it starts closes the next day.`,
  example: d === "sun" ? "closed" : "09:00-18:00",
}));

export const importableKinds = ["store", "service", "place", "event", "article", "link"] as const satisfies readonly ContentKind[];
export type ImportableKind = (typeof importableKinds)[number];

const common: ColumnSpec[] = [
  { key: "external_id", required: true, description: "Your stable identifier for this record (scoped to this site and type). Repeated imports update the same item.", example: "STORE-001" },
  { key: "title", required: true, description: "Display name.", example: "Range Athletics Longmont" },
  { key: "slug", description: "URL slug; generated from the title when empty.", example: "longmont" },
  { key: "summary", description: "Short description for listings (up to 500 characters).", example: "Flagship store with the full shoe wall." },
];

/** The longer text of an item: paragraphs separated by a blank line, "## " for a heading, "- " for a list item (site-building programme B2). */
const bodyColumn: ColumnSpec = { key: "body", description: 'The page text. Separate paragraphs with a blank line; start a line with "## " for a heading and with "- " for a list item. No HTML.', example: "" };

/** Featured image from the onboarding package's images folder, and documents from its documents folder (both empty in a plain CSV import). */
const imageColumns: ColumnSpec[] = [
  { key: "image", description: "File name of the featured image in the onboarding package's images folder (for example storefront.jpg). Leave empty in a CSV import without a package.", example: "" },
  { key: "image_alt", description: "Alternative text for that image, used when images.csv does not give one: what the picture shows, for people who cannot see it.", example: "" },
  { key: "attachments", description: "PDF files in the onboarding package's documents folder, separated by \";\" (for example menu.pdf;price-list.pdf), listed as downloads under the text. Leave empty in a CSV import without a package.", example: "" },
];

export const csvSpecs: Record<ImportableKind, ColumnSpec[]> = {
  store: [
    ...common,
    { key: "address_line1", required: true, description: "Street address.", example: "4100 Foothills Way" },
    { key: "address_line2", description: "Suite, floor.", example: "Suite 100" },
    { key: "locality", required: true, description: "City.", example: "Longmont" },
    { key: "region", description: "State or region.", example: "CO" },
    { key: "postal_code", description: "Postal code.", example: "80501" },
    { key: "phone", description: "Phone number as displayed.", example: "(720) 555-0191" },
    { key: "time_zone", description: "IANA time zone; defaults to the site time zone.", example: "America/Denver" },
    { key: "status", description: "open, temporarily_closed or permanently_closed (default open).", example: "open" },
    { key: "status_note", description: "Shown with a closure.", example: "" },
    ...hoursColumns,
    { key: "services", description: "Semicolon-separated slugs of service items on this site (services in the same package are imported first).", example: "shoe-fitting;bike-service" },
    bodyColumn,
    ...imageColumns,
  ],
  service: [
    ...common,
    { key: "inquiry_prompt", description: "Optional sentence inviting an inquiry, shown on the service page.", example: "Ask about a fitting appointment." },
    bodyColumn,
    ...imageColumns,
  ],
  place: [
    ...common,
    { key: "category", required: true, description: "Directory category.", example: "Eat & Drink" },
    { key: "address_line1", description: "Street address (leave empty and use area_description when no exact address should be shown).", example: "14 Creek Path" },
    { key: "locality", description: "City.", example: "Pine Hollow" },
    { key: "region", description: "State or region.", example: "CO" },
    { key: "postal_code", description: "Postal code.", example: "80999" },
    { key: "area_description", description: "Approximate location text.", example: "" },
    { key: "website", description: "https URL.", example: "https://creekside.example" },
    { key: "phone", description: "Phone number as displayed.", example: "(303) 555-0112" },
    { key: "source_url", description: "Where the details were verified.", example: "" },
    { key: "last_verified_on", description: "YYYY-MM-DD.", example: "2026-09-01" },
    ...hoursColumns,
    bodyColumn,
    ...imageColumns,
  ],
  event: [
    ...common,
    { key: "starts_at", required: true, description: "Start in the event time zone: YYYY-MM-DD HH:MM (24h) or an ISO instant.", example: "2026-10-07 09:00" },
    { key: "ends_at", required: true, description: "End, same format; must be after the start.", example: "2026-10-07 16:00" },
    { key: "time_zone", description: "IANA time zone; defaults to the site time zone.", example: "America/Denver" },
    { key: "venue_text", description: "Where it happens (free text).", example: "Aspen Street" },
    { key: "organizer_name", description: "Organizer.", example: "Growers' Circle" },
    { key: "organizer_url", description: "https URL.", example: "" },
    { key: "status", description: "scheduled, cancelled or postponed (default scheduled).", example: "scheduled" },
    { key: "event_url", description: "https URL with details.", example: "" },
    { key: "admission", description: "Admission as supplied by the organizer.", example: "Free" },
    bodyColumn,
    ...imageColumns,
  ],
  article: [
    ...common,
    { key: "author_name", required: true, description: "The author, or the organization when nobody is named.", example: "Pine Hollow Guide" },
    { key: "published_on", required: true, description: "Original publication date, YYYY-MM-DD.", example: "2026-09-01" },
    { key: "updated_on", description: "Date of the last update, YYYY-MM-DD, if any.", example: "" },
    bodyColumn,
    ...imageColumns,
  ],
  link: [
    ...common,
    { key: "url", required: true, description: "The full https:// address of the other website; the card and the button open it.", example: "https://www.example.org/trail-maps" },
    { key: "category", description: "Grouping on the links page (for example Partners, Town services).", example: "Town services" },
    { key: "cta_label", description: "The button's words on the link's own page; empty reads \"Visit <the other site>\".", example: "Open the trail maps" },
    { key: "source_url", description: "Where the details were verified, if not the address itself.", example: "" },
    { key: "last_verified_on", description: "YYYY-MM-DD.", example: "2026-09-01" },
    bodyColumn,
    ...imageColumns,
  ],
};

export function isImportableKind(v: string): v is ImportableKind {
  return (importableKinds as readonly string[]).includes(v);
}

/** Downloadable template: header row plus one example row. */
export function templateCsv(kind: ImportableKind): string {
  const cols = csvSpecs[kind];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [cols.map((c) => c.key).join(","), cols.map((c) => esc(c.example)).join(",")].join("\r\n") + "\r\n";
}
