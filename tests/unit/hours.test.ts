import { describe, expect, it } from "vitest";
import { hoursStatusAt, formatWeeklyHours, localClock } from "@/lib/hours";
import type { WeeklyHours } from "@/modules/common";

const tz = "America/Denver";
const week: WeeklyHours = {
  mon: [{ open: "09:00", close: "18:00", closesNextDay: false }],
  tue: [{ open: "09:00", close: "18:00", closesNextDay: false }],
  wed: [{ open: "09:00", close: "12:00", closesNextDay: false }, { open: "13:00", close: "18:00", closesNextDay: false }],
  thu: [{ open: "09:00", close: "18:00", closesNextDay: false }],
  fri: [{ open: "20:00", close: "02:00", closesNextDay: true }],
  sat: [{ open: "10:00", close: "16:00", closesNextDay: false }],
  sun: [],
};
// 2026-11-26 is Thanksgiving (Thursday); 2026-11-27 is Friday.
const at = (iso: string) => new Date(iso);

describe("store hours (TIME-01)", () => {
  it("is open during a weekly interval and closed outside it", () => {
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz }, at("2026-11-24T17:00:00Z"))).toMatchObject({ state: "open", detail: "Closes 6 PM" }); // Tue 10:00 MST
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz }, at("2026-11-25T19:30:00Z"))).toMatchObject({ state: "closed", detail: "Opens 1 PM today" }); // Wed 12:30 lunch gap
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz }, at("2026-11-29T20:00:00Z"))).toMatchObject({ state: "closed", detail: "Opens tomorrow 9 AM" }); // Sun
  });
  it("handles overnight intervals with next-day end", () => {
    // Friday 23:00 MST = Sat 06:00Z
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz }, at("2026-11-28T06:00:00Z"))).toMatchObject({ state: "open", detail: "Closes 2 AM (tomorrow)" });
    // Saturday 01:30 MST = Sat 08:30Z still open from Friday's overnight interval
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz }, at("2026-11-28T08:30:00Z"))).toMatchObject({ state: "open", detail: "Closes 2 AM" });
    // Saturday 02:30 MST closed until 10 AM
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz }, at("2026-11-28T09:30:00Z"))).toMatchObject({ state: "closed", detail: "Opens 10 AM today" });
  });
  it("applies a holiday exception over the weekly pattern", () => {
    const exceptions = [{ date: "2026-11-26", label: "Thanksgiving", closed: true, intervals: [] }];
    const r = hoursStatusAt({ weeklyHours: week, exceptions, timeZone: tz }, at("2026-11-26T17:00:00Z")); // Thu 10:00 MST
    expect(r).toMatchObject({ state: "closed", source: "exception" });
    expect(r.detail).toContain("Thanksgiving");
    const short = [{ date: "2026-11-27", label: "Black Friday", closed: false, intervals: [{ open: "06:00", close: "22:00", closesNextDay: false }] }];
    expect(hoursStatusAt({ weeklyHours: week, exceptions: short, timeZone: tz }, at("2026-11-27T14:00:00Z"))).toMatchObject({ state: "open", source: "exception", detail: "Closes 10 PM" });
  });
  it("never claims open when hours are unknown, and honors closure status", () => {
    expect(hoursStatusAt({ weeklyHours: null, exceptions: [], timeZone: tz }, at("2026-11-24T17:00:00Z"))).toMatchObject({ state: "unknown", detail: "Hours not published" });
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz, status: "temporarily_closed" }, at("2026-11-24T17:00:00Z"))).toMatchObject({ state: "closed", detail: "Temporarily closed" });
    expect(hoursStatusAt({ weeklyHours: week, exceptions: [], timeZone: tz, status: "permanently_closed" }, at("2026-11-24T17:00:00Z"))).toMatchObject({ state: "closed", source: "status" });
  });
  it("formats the weekly table with closed days and multiple intervals", () => {
    const rows = formatWeeklyHours(week);
    expect(rows[2]).toEqual({ day: "Wednesday", text: "9 AM – 12 PM, 1 PM – 6 PM" });
    expect(rows[6]).toEqual({ day: "Sunday", text: "Closed" });
    expect(rows[4]!.text).toBe("8 PM – 2 AM (next day)");
  });
  it("computes local clock across daylight-saving changes", () => {
    // DST ends 2026-11-01 02:00 local. 2026-11-01T08:30Z = 01:30 MST (after fall back).
    expect(localClock(at("2026-11-01T08:30:00Z"), tz)).toMatchObject({ dateKey: "2026-11-01", weekday: "sun", minute: 90 });
    // 2026-03-08T09:30Z = 03:30 MDT (spring forward skipped 2:00-3:00)
    expect(localClock(at("2026-03-08T09:30:00Z"), tz)).toMatchObject({ dateKey: "2026-03-08", minute: 210 });
  });
});
