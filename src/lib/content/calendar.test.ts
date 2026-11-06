import { describe, expect, it } from "vitest";
import { calendarDays, candidatePublishingTimes, shiftDay } from "./calendar";

describe("calendar ranges and suggested times", () => {
  it("starts weeks on Monday across year boundaries", () => {
    expect(calendarDays("2027-01-01", "week")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("covers all of a month with complete weeks", () => {
    const days = calendarDays("2026-10-15", "month");
    expect(days[0]).toBe("2026-09-28"); expect(days.at(-1)).toBe("2026-11-01");
    expect(calendarDays("2026-10-15", "day")).toEqual(["2026-10-15"]);
  });
  it("excludes occupied and past times and uses WAT independently of the server zone", () => {
    const now = new Date("2026-10-15T08:30:00Z");
    const slots = candidatePublishingTimes([{ scheduled_for: "2026-10-15T11:00:00Z", published_at: "2026-10-01T13:00:00Z" }], now);
    expect(slots.every(s => Date.parse(s.at) > now.getTime() + 3600000)).toBe(true);
    expect(slots.some(s => s.at === "2026-10-15T11:00:00.000Z")).toBe(false);
    expect(slots[0].at).toBe("2026-10-15T13:00:00.000Z");
  });
});
