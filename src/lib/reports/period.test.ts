import { describe, expect, it } from "vitest";
import { completedReportPeriod } from "./period";

describe("complete reporting periods", () => {
  it.each([
    ["2026-10-21", "2026-10-12", "2026-10-18"],
    ["2026-10-19", "2026-10-12", "2026-10-18"],
    ["2026-10-18", "2026-10-05", "2026-10-11"],
    ["2026-01-01", "2025-12-22", "2025-12-28"],
  ])("excludes the incomplete week on %s", (today, start, end) => {
    expect(completedReportPeriod(today, "weekly")).toEqual({ start, end });
  });
  it.each([
    ["2026-10-21", "2026-09-01", "2026-09-30"],
    ["2026-01-01", "2025-12-01", "2025-12-31"],
    ["2024-03-31", "2024-02-01", "2024-02-29"],
  ])("handles month and year boundaries on %s", (today, start, end) => {
    expect(completedReportPeriod(today, "monthly")).toEqual({ start, end });
  });
});
