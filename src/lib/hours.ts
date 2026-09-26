import { weekdayKeys, type HoursException, type HoursInterval, type WeeklyHours, type WeekdayKey } from "@/modules/common";
import { localDateKey } from "@/lib/events";

export type OpenState = "open" | "closed" | "unknown";

export interface HoursStatus {
  state: OpenState;
  /** Human-readable next transition, e.g. "Closes 6:00 PM" or "Opens Tue 9:00 AM". */
  detail: string;
  /** Which rule decided: a weekly interval, a date exception, or nothing. */
  source: "weekly" | "exception" | "unknown" | "status";
}

const dayNames: Record<WeekdayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const shortDay: Record<WeekdayKey, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatTime(t: string): string {
  const m = minutes(t);
  const h24 = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function formatInterval(i: HoursInterval): string {
  return `${formatTime(i.open)} – ${formatTime(i.close)}${i.closesNextDay ? " (next day)" : ""}`;
}

/** Rows for a weekly hours table. Empty days read "Closed"; multiple intervals join with commas. */
export function formatWeeklyHours(hours: WeeklyHours): Array<{ day: string; text: string }> {
  return weekdayKeys.map((k) => ({ day: dayNames[k], text: hours[k].length ? hours[k].map(formatInterval).join(", ") : "Closed" }));
}

/** Local weekday key and minutes-since-midnight of an instant in a time zone. */
export function localClock(instant: Date, timeZone: string): { dateKey: string; weekday: WeekdayKey; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday").slice(0, 3).toLowerCase() as WeekdayKey;
  const minute = Number(get("hour")) * 60 + Number(get("minute"));
  return { dateKey: localDateKey(instant, timeZone), weekday, minute };
}

function previousWeekday(k: WeekdayKey): WeekdayKey {
  const i = weekdayKeys.indexOf(k);
  return weekdayKeys[(i + 6) % 7]!;
}
function nextWeekday(k: WeekdayKey): WeekdayKey {
  const i = weekdayKeys.indexOf(k);
  return weekdayKeys[(i + 1) % 7]!;
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days, 12));
  return dt.toISOString().slice(0, 10);
}

/** Effective intervals for a local date: an exception overrides the weekly pattern for that date. */
export function intervalsForDate(hours: WeeklyHours | null, exceptions: HoursException[], dateKey: string, weekday: WeekdayKey): { intervals: HoursInterval[]; source: "weekly" | "exception"; label?: string } | null {
  const ex = exceptions.find((e) => e.date === dateKey);
  if (ex) return { intervals: ex.closed ? [] : ex.intervals, source: "exception", label: ex.label };
  if (!hours) return null;
  return { intervals: hours[weekday], source: "weekly" };
}

/**
 * Open/closed state at an instant, in the store's time zone. Overnight intervals from the
 * previous local date count. Unknown hours never produce an "open" claim.
 */
export function hoursStatusAt(
  input: { weeklyHours: WeeklyHours | null; exceptions: HoursException[]; timeZone: string; status?: "open" | "temporarily_closed" | "permanently_closed" },
  now: Date,
): HoursStatus {
  if (input.status === "permanently_closed") return { state: "closed", detail: "Permanently closed", source: "status" };
  if (input.status === "temporarily_closed") return { state: "closed", detail: "Temporarily closed", source: "status" };
  const { dateKey, weekday, minute } = localClock(now, input.timeZone);
  const today = intervalsForDate(input.weeklyHours, input.exceptions, dateKey, weekday);
  const yesterday = intervalsForDate(input.weeklyHours, input.exceptions, shiftDateKey(dateKey, -1), previousWeekday(weekday));
  if (!today && !yesterday) return { state: "unknown", detail: "Hours not published", source: "unknown" };

  // Overnight spill from yesterday.
  for (const i of yesterday?.intervals ?? []) {
    if (i.closesNextDay && minute < minutes(i.close)) {
      return { state: "open", detail: `Closes ${formatTime(i.close)}`, source: yesterday!.source };
    }
  }
  if (today) {
    for (const i of today.intervals) {
      const open = minutes(i.open);
      const close = i.closesNextDay ? 24 * 60 + minutes(i.close) : minutes(i.close);
      if (minute >= open && minute < close) {
        return { state: "open", detail: `Closes ${formatTime(i.close)}${i.closesNextDay ? " (tomorrow)" : ""}`, source: today.source };
      }
    }
    const upcoming = today.intervals.filter((i) => minutes(i.open) > minute).sort((a, b) => minutes(a.open) - minutes(b.open))[0];
    if (upcoming) {
      return { state: "closed", detail: `Opens ${formatTime(upcoming.open)} today`, source: today.source };
    }
    if (today.source === "exception" && today.intervals.length === 0) {
      return { state: "closed", detail: today.label ? `Closed today (${today.label})` : "Closed today", source: "exception" };
    }
  }
  // Find the next open day within a week.
  let key = dateKey;
  let wd = weekday;
  for (let d = 1; d <= 7; d++) {
    key = shiftDateKey(key, 1);
    wd = nextWeekday(wd);
    const day = intervalsForDate(input.weeklyHours, input.exceptions, key, wd);
    const first = day?.intervals.slice().sort((a, b) => minutes(a.open) - minutes(b.open))[0];
    if (first) return { state: "closed", detail: `Opens ${d === 1 ? "tomorrow" : shortDay[wd]} ${formatTime(first.open)}`, source: today?.source ?? "weekly" };
  }
  return { state: "closed", detail: "Closed", source: today?.source ?? "weekly" };
}

export function upcomingExceptions(exceptions: HoursException[], now: Date, timeZone: string, days = 60): HoursException[] {
  const today = localDateKey(now, timeZone);
  const limit = shiftDateKey(today, days);
  return exceptions.filter((e) => e.date >= today && e.date <= limit).sort((a, b) => a.date.localeCompare(b.date));
}
