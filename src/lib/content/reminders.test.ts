import { describe, expect, it } from "vitest";
import { isSocialAsset, reminderState, zonedDayKey } from "@/lib/content/reminders";

const post = (scheduled_for: string | null, overrides: Partial<Parameters<typeof reminderState>[0]> = {}) => ({
  status: "scheduled",
  channel: "linkedin",
  platform: null,
  format: "social post",
  scheduled_for,
  ...overrides,
});

describe("isSocialAsset", () => {
  it("recognises social channels, aliases and formats", () => {
    expect(isSocialAsset({ channel: "LinkedIn", platform: null, format: null })).toBe(true);
    expect(isSocialAsset({ channel: "twitter", platform: null, format: null })).toBe(true);
    expect(isSocialAsset({ channel: null, platform: "Instagram", format: null })).toBe(true);
    expect(isSocialAsset({ channel: null, platform: null, format: "short-form video" })).toBe(true);
  });

  it("leaves blogs, newsletters and unknown channels out", () => {
    expect(isSocialAsset({ channel: "website", platform: null, format: "blog" })).toBe(false);
    expect(isSocialAsset({ channel: "email", platform: null, format: "newsletter" })).toBe(false);
    expect(isSocialAsset({ channel: "events", platform: null, format: null })).toBe(false);
    expect(isSocialAsset({ channel: null, platform: null, format: null })).toBe(false);
  });
});

describe("zonedDayKey", () => {
  it("uses the workspace day, not the UTC day", () => {
    // 23:30 UTC on 8 Oct is 00:30 on 9 Oct in Lagos (UTC+1).
    expect(zonedDayKey(new Date("2026-10-08T23:30:00Z"))).toBe("2026-10-09");
    expect(zonedDayKey(new Date("2026-10-08T23:30:00Z"), "UTC")).toBe("2026-10-08");
  });
});

describe("reminderState", () => {
  const now = new Date("2026-10-09T09:00:00Z"); // 10:00 WAT

  it("flags a post whose time has passed as overdue", () => {
    expect(reminderState(post("2026-10-09T08:00:00Z"), now)).toBe("overdue");
    expect(reminderState(post("2026-10-01T08:00:00Z"), now)).toBe("overdue");
  });

  it("flags a post later today as due today", () => {
    expect(reminderState(post("2026-10-09T15:00:00Z"), now)).toBe("due_today");
    // 22:59 UTC is still 9 Oct in Lagos.
    expect(reminderState(post("2026-10-09T22:59:00Z"), now)).toBe("due_today");
  });

  it("does not flag tomorrow's posts, even when the UTC date is today", () => {
    // 23:30 UTC on 9 Oct is 00:30 on 10 Oct in Lagos.
    expect(reminderState(post("2026-10-09T23:30:00Z"), now)).toBeNull();
    expect(reminderState(post("2026-10-11T09:00:00Z"), now)).toBeNull();
  });

  it("ignores anything that isn't a scheduled social post", () => {
    expect(reminderState(post("2026-10-09T08:00:00Z", { status: "published" }), now)).toBeNull();
    expect(reminderState(post("2026-10-09T08:00:00Z", { status: "approved" }), now)).toBeNull();
    expect(reminderState(post("2026-10-09T08:00:00Z", { channel: "website", format: "blog" }), now)).toBeNull();
    expect(reminderState(post(null), now)).toBeNull();
    expect(reminderState(post("not a date"), now)).toBeNull();
  });
});
