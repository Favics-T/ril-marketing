import { describe, expect, it } from "vitest";
import { calendarAt, calendarFlag } from "@/lib/content/calendar";

const asset = (scheduled_for: string | null, overrides: Partial<Parameters<typeof calendarFlag>[0]> = {}) => ({
  status: "scheduled",
  channel: "website",
  platform: null,
  format: "blog",
  scheduled_for,
  published_at: null,
  ...overrides,
});

describe("calendarAt", () => {
  it("uses the planned time first, then when it went out", () => {
    expect(calendarAt({ scheduled_for: "2026-10-12T08:00:00Z", published_at: "2026-10-12T09:00:00Z" })).toBe("2026-10-12T08:00:00Z");
    expect(calendarAt({ scheduled_for: null, published_at: "2026-10-12T09:00:00Z" })).toBe("2026-10-12T09:00:00Z");
    expect(calendarAt({ scheduled_for: null, published_at: null })).toBeNull();
  });
});

describe("calendarFlag", () => {
  const now = new Date("2026-10-09T09:00:00Z"); // 10:00 WAT

  it("flags any content type whose time has passed as overdue", () => {
    expect(calendarFlag(asset("2026-10-09T08:00:00Z"), now)).toBe("overdue");
    expect(calendarFlag(asset("2026-10-01T08:00:00Z", { channel: "email", format: "newsletter" }), now)).toBe("overdue");
    expect(calendarFlag(asset("2026-10-01T08:00:00Z", { channel: null, format: null }), now)).toBe("overdue");
  });

  it("flags an approved asset whose date passed without going out", () => {
    expect(calendarFlag(asset("2026-10-08T08:00:00Z", { status: "approved" }), now)).toBe("overdue");
  });

  it("keeps the social reminder, including due today", () => {
    const social = { channel: "linkedin", format: "social post" };
    expect(calendarFlag(asset("2026-10-09T15:00:00Z", social), now)).toBe("due_today");
    expect(calendarFlag(asset("2026-10-09T08:00:00Z", social), now)).toBe("overdue");
  });

  it("only gives due today to social posts", () => {
    expect(calendarFlag(asset("2026-10-09T15:00:00Z"), now)).toBeNull();
  });

  it("never flags published, future or undated assets", () => {
    expect(calendarFlag(asset("2026-10-01T08:00:00Z", { status: "published", published_at: "2026-10-01T08:00:00Z" }), now)).toBeNull();
    expect(calendarFlag(asset("2026-10-11T09:00:00Z"), now)).toBeNull();
    expect(calendarFlag(asset(null, { status: "approved" }), now)).toBeNull();
    expect(calendarFlag(asset("not a date"), now)).toBeNull();
  });
});
