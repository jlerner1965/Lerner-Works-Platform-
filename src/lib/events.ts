/** Event time helpers. Instants are ISO strings; display uses the event's IANA time zone. */

export type EventPhase = "upcoming" | "in_progress" | "past";

export function classifyEvent(startsAt: string, endsAt: string, now: Date): EventPhase {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (now.getTime() < start) return "upcoming";
  if (now.getTime() < end) return "in_progress";
  return "past";
}

export function isUpcomingOrInProgress(startsAt: string, endsAt: string, now: Date): boolean {
  return classifyEvent(startsAt, endsAt, now) !== "past";
}

const dateFmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let f = dateFmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    dateFmtCache.set(key, f);
  }
  return f;
}

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDateKey(instant: Date, timeZone: string): string {
  const parts = fmt(timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatEventDate(startsAt: string, timeZone: string): string {
  return fmt(timeZone, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(startsAt));
}

export function formatEventTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = localDateKey(start, timeZone) === localDateKey(end, timeZone);
  const time = (d: Date) => fmt(timeZone, { hour: "numeric", minute: "2-digit" }).format(d);
  const zone = (d: Date) => fmt(timeZone, { timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  const startZone = zone(start);
  const endZone = zone(end);
  // Across a daylight-saving change the two ends carry different abbreviations; show both.
  const startText = startZone === endZone ? time(start) : `${time(start)} ${startZone}`;
  if (sameDay) return `${startText} – ${time(end)} ${endZone}`;
  return `${fmt(timeZone, { month: "short", day: "numeric" }).format(start)} ${startText} – ${fmt(timeZone, { month: "short", day: "numeric" }).format(end)} ${time(end)} ${endZone}`;
}

export function formatDateOnly(dateKey: string, timeZone = "UTC"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return dateKey;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d) + (timeZone ? "" : "");
}
