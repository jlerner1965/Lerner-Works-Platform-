import { describe, expect, it } from "vitest";
import { classifyEvent, localDateKey, formatEventDate, formatEventTimeRange } from "@/lib/events";

describe("event time logic (TIME-02)", () => {
  const tz = "America/Denver";
  it("classifies upcoming, in-progress and past against a controllable clock", () => {
    const start = "2026-10-10T00:00:00-06:00"; // midnight local MDT
    const end = "2026-10-10T02:00:00-06:00";
    expect(classifyEvent(start, end, new Date("2026-10-09T23:59:00-06:00"))).toBe("upcoming");
    expect(classifyEvent(start, end, new Date("2026-10-10T00:00:00-06:00"))).toBe("in_progress");
    expect(classifyEvent(start, end, new Date("2026-10-10T02:00:00-06:00"))).toBe("past");
  });
  it("keeps a midnight event on its local date, not the UTC date", () => {
    expect(localDateKey(new Date("2026-10-10T00:30:00-06:00"), tz)).toBe("2026-10-10");
    expect(new Date("2026-10-10T00:30:00-06:00").toISOString().slice(0, 10)).toBe("2026-10-10");
    expect(localDateKey(new Date("2026-10-10T23:30:00-06:00"), tz)).toBe("2026-10-10");
    expect(new Date("2026-10-10T23:30:00-06:00").toISOString().slice(0, 10)).toBe("2026-10-11");
  });
  it("formats across the daylight-saving boundary in the event zone", () => {
    // 2026-11-01 01:30 MDT → after fall back 01:30 MST is a different instant.
    const before = "2026-11-01T07:30:00Z"; // 01:30 MDT
    const after = "2026-11-01T08:30:00Z"; // 01:30 MST
    expect(formatEventDate(before, tz)).toBe("Sun, Nov 1, 2026");
    expect(formatEventTimeRange(before, after, tz)).toBe("1:30 AM MDT – 1:30 AM MST");
    expect(formatEventTimeRange("2026-10-10T18:00:00-06:00", "2026-10-10T20:00:00-06:00", tz)).toBe("6:00 PM – 8:00 PM MDT");
    expect(classifyEvent(before, after, new Date("2026-11-01T08:00:00Z"))).toBe("in_progress");
  });
  it("orders events by instant regardless of display zone", () => {
    const a = { startsAt: "2026-06-01T18:00:00-06:00", tz: "America/Denver" };
    const b = { startsAt: "2026-06-01T21:00:00-04:00", tz: "America/New_York" };
    expect(Date.parse(a.startsAt) < Date.parse(b.startsAt)).toBe(true);
  });
});
