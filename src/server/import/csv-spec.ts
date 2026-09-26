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

export const importableKinds = ["store", "place", "event"] as const satisfies readonly ContentKind[];
export type ImportableKind = (typeof importableKinds)[number];

const common: ColumnSpec[] = [
  { key: "external_id", required: true, description: "Your stable identifier for this record (scoped to this site and type). Repeated imports update the same item.", example: "STORE-001" },
  { key: "title", required: true, description: "Display name.", example: "Range Athletics Longmont" },
  { key: "slug", description: "URL slug; generated from the title when empty.", example: "longmont" },
  { key: "summary", description: "Short description for listings (up to 500 characters).", example: "Flagship store with the full shoe wall." },
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
    { key: "services", description: "Semicolon-separated slugs of existing service items on this site.", example: "shoe-fitting;bike-service" },
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
  ],
};

export function isImportableKind(v: string): v is ImportableKind {
  return (importableKinds as readonly string[]).includes(v);
}

/** Downloadable template: header row plus one example row and a comment row of descriptions. */
export function templateCsv(kind: ImportableKind): string {
  const cols = csvSpecs[kind];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [cols.map((c) => c.key).join(","), cols.map((c) => esc(c.example)).join(",")].join("\r\n") + "\r\n";
}
