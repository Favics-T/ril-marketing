import { afterAll, describe, expect, it } from "vitest";
import {
  dateToZonedInput,
  formatInZone,
  formatZonedKey,
  shiftDayKey,
  shiftMonthKey,
  zonedDayKey,
  zonedMonthKey,
  zonedMonthRange,
  zonedWallTimeToDate,
  zonedWeekRange,
} from "@/lib/time";

const originalTz = process.env.TZ;
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

// The machine's own zone must not change any result: run everything under several.
const PROCESS_ZONES = ["UTC", "America/New_York", "Asia/Tokyo"] as const;
const JAN_OFFSET = { UTC: 0, "America/New_York": 300, "Asia/Tokyo": -540 } as const;

describe.each(PROCESS_ZONES)("with the process zone set to %s", (zone) => {
  const useZone = () => {
    process.env.TZ = zone;
    // Proves the switch took effect, so these tests really run under this zone.
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(JAN_OFFSET[zone]);
  };

  describe("zonedWallTimeToDate (WAT input)", () => {
    it("reads a datetime-local value as WAT", () => {
      useZone();
      expect(zonedWallTimeToDate("2026-10-12T09:00")?.toISOString()).toBe("2026-10-12T08:00:00.000Z");
    });

    it("maps midnight and just after midnight WAT to the previous UTC evening", () => {
      useZone();
      expect(zonedWallTimeToDate("2026-10-12T00:00")?.toISOString()).toBe("2026-10-11T23:00:00.000Z");
      expect(zonedWallTimeToDate("2026-10-12T00:30")?.toISOString()).toBe("2026-10-11T23:30:00.000Z");
    });

    it("rejects values that aren't real times", () => {
      useZone();
      expect(zonedWallTimeToDate("2026-11-31T09:00")).toBeNull();
      expect(zonedWallTimeToDate("2026-10-12T24:00")).toBeNull();
      expect(zonedWallTimeToDate("2026-10-12")).toBeNull();
      expect(zonedWallTimeToDate("next tuesday")).toBeNull();
    });

    it("round-trips with dateToZonedInput for pre-filling", () => {
      useZone();
      expect(dateToZonedInput("2026-10-11T23:30:00.000Z")).toBe("2026-10-12T00:30");
      expect(zonedWallTimeToDate(dateToZonedInput("2026-12-31T23:15:00.000Z"))?.toISOString()).toBe("2026-12-31T23:15:00.000Z");
      expect(dateToZonedInput(null)).toBe("");
    });
  });

  describe("day and month keys around midnight WAT", () => {
    it("puts 23:30 UTC on the next WAT day", () => {
      useZone();
      expect(zonedDayKey(new Date("2026-10-11T22:59:59Z"))).toBe("2026-10-11");
      expect(zonedDayKey(new Date("2026-10-11T23:00:00Z"))).toBe("2026-10-12");
      expect(zonedDayKey(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
    });

    it("moves the month and year at midnight WAT", () => {
      useZone();
      expect(zonedMonthKey(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
      expect(zonedMonthKey(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01");
      expect(zonedMonthKey(new Date("2026-12-31T22:59:59Z"))).toBe("2026-12");
    });
  });

  describe("zonedMonthRange (calendar month bounds)", () => {
    it("starts and ends the month at midnight WAT", () => {
      useZone();
      expect(zonedMonthRange("2026-11")).toEqual({ from: "2026-10-31T23:00:00.000Z", to: "2026-11-30T22:59:59.999Z" });
      expect(zonedMonthRange("2026-12")).toEqual({ from: "2026-11-30T23:00:00.000Z", to: "2026-12-31T22:59:59.999Z" });
    });

    it("includes 00:30 WAT on the 1st and excludes 00:30 WAT on the next 1st", () => {
      useZone();
      const { from, to } = zonedMonthRange("2026-11");
      const firstOfMonth = "2026-10-31T23:30:00.000Z";
      const firstOfNext = "2026-11-30T23:30:00.000Z";
      expect(firstOfMonth >= from && firstOfMonth <= to).toBe(true);
      expect(firstOfNext >= from && firstOfNext <= to).toBe(false);
    });
  });

  describe("zonedWeekRange (Monday-start week bounds)", () => {
    const week = { start: "2026-10-12", from: "2026-10-11T23:00:00.000Z", to: "2026-10-18T22:59:59.999Z" };

    it("runs Monday midnight WAT to the end of Sunday WAT", () => {
      useZone();
      expect(zonedWeekRange("2026-10-12")).toEqual(week);
    });

    it("maps every day of the week back to its Monday, Sunday included", () => {
      useZone();
      expect(zonedWeekRange("2026-10-14")).toEqual(week);
      expect(zonedWeekRange("2026-10-18")).toEqual(week);
      expect(zonedWeekRange("2026-10-19").start).toBe("2026-10-19");
    });

    it("crosses month and year boundaries", () => {
      useZone();
      const turnOfYear = { start: "2026-12-28", from: "2026-12-27T23:00:00.000Z", to: "2027-01-03T22:59:59.999Z" };
      expect(zonedWeekRange("2026-12-31")).toEqual(turnOfYear);
      expect(zonedWeekRange("2027-01-01")).toEqual(turnOfYear);
    });

    it("includes 00:30 WAT Monday and 23:30 WAT Sunday, and excludes 00:30 WAT the next Monday", () => {
      useZone();
      const { from, to } = zonedWeekRange("2026-10-14");
      const inWeek = (iso: string) => iso >= from && iso <= to;
      expect(inWeek("2026-10-11T23:30:00.000Z")).toBe(true);
      expect(inWeek("2026-10-18T22:30:00.000Z")).toBe(true);
      expect(inWeek("2026-10-18T23:30:00.000Z")).toBe(false);
    });

    it("rejects keys that aren't real days", () => {
      useZone();
      expect(() => zonedWeekRange("2026-13-01")).toThrow();
      expect(() => zonedWeekRange("2026-02-30")).toThrow();
      expect(() => zonedWeekRange("nope")).toThrow();
    });
  });

  describe("formatInZone", () => {
    it("shows WAT times whatever the process zone", () => {
      useZone();
      const justAfterMidnight = "2026-10-11T23:30:00Z";
      expect(formatInZone(justAfterMidnight, "time")).toBe("00:30");
      expect(formatInZone(justAfterMidnight, "date")).toBe("12 Oct 2026");
      expect(formatInZone(justAfterMidnight, "dateTime")).toBe("12 Oct 2026, 00:30 WAT");
      expect(formatInZone(justAfterMidnight, "shortDateTime")).toBe("Mon 12 Oct, 00:30 WAT");
      expect(formatInZone(justAfterMidnight, "dayHeading")).toBe("Monday 12 October");
    });

    it("only labels WAT when formatting in WAT", () => {
      useZone();
      expect(formatInZone("2026-10-11T23:30:00Z", "dateTime", "UTC")).toBe("11 Oct 2026, 23:30");
    });

    it("returns a dash for missing or invalid values", () => {
      useZone();
      expect(formatInZone(null, "date")).toBe("—");
      expect(formatInZone("nope", "dateTime")).toBe("—");
    });

    it("formats calendar keys without shifting the day", () => {
      useZone();
      expect(formatZonedKey("2026-10-12", "dayHeading")).toBe("Monday 12 October");
      expect(formatZonedKey("2026-11", "month")).toBe("November 2026");
    });
  });
});

describe("shiftDayKey", () => {
  it("crosses month, year and leap-day boundaries both ways", () => {
    expect(shiftDayKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDayKey("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftDayKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDayKey("2026-10-12", 7)).toBe("2026-10-19");
    expect(shiftDayKey("2026-10-12", 0)).toBe("2026-10-12");
  });
});

describe("shiftMonthKey", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2027-01", -1)).toBe("2026-12");
    expect(shiftMonthKey("2026-10", 0)).toBe("2026-10");
  });
});
