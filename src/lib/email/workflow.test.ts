import { describe, expect, it } from "vitest";
import { describeDeliveryProblem, readDeliveryProblem, resumeStatus, shouldPauseForFailures } from "./workflow";

describe("resumeStatus", () => {
  it("returns a campaign paused while sending to sending", () => {
    expect(resumeStatus({ approved_by: "reviewer", metadata: { paused_from: "scheduled" } })).toBe("scheduled");
  });
  it("sends an approved campaign paused before paused_from was recorded back to approved", () => {
    expect(resumeStatus({ approved_by: "reviewer", metadata: {} })).toBe("approved");
  });
  it("sends a campaign with no approver back to draft, even if it claims to have been sending", () => {
    expect(resumeStatus({ approved_by: null, metadata: { paused_from: "scheduled" } })).toBe("draft");
    expect(resumeStatus({ approved_by: null, metadata: null })).toBe("draft");
  });
});

describe("shouldPauseForFailures", () => {
  it("pauses when every send of a finished campaign failed", () => {
    expect(shouldPauseForFailures({ attempted: 3, failed: 3, remaining: 0 })).toBe(true);
  });
  it("pauses mid-run once at least five sends failed and they are at least half", () => {
    expect(shouldPauseForFailures({ attempted: 8, failed: 5, remaining: 40 })).toBe(true);
  });
  it("waits mid-run while fewer than five sends failed", () => {
    expect(shouldPauseForFailures({ attempted: 4, failed: 4, remaining: 40 })).toBe(false);
  });
  it("does not pause when failures are under half", () => {
    expect(shouldPauseForFailures({ attempted: 20, failed: 9, remaining: 0 })).toBe(false);
  });
  it("does not pause without failures or attempts", () => {
    expect(shouldPauseForFailures({ attempted: 10, failed: 0, remaining: 0 })).toBe(false);
    expect(shouldPauseForFailures({ attempted: 0, failed: 0, remaining: 0 })).toBe(false);
  });
});

describe("delivery problem metadata", () => {
  it("reads and describes a recorded problem", () => {
    const problem = readDeliveryProblem({ delivery_problem: { failed: 12, attempted: 15, last_error: "Domain not verified", detected_at: "2026-10-20T10:00:00Z" } });
    expect(problem).toEqual({ failed: 12, attempted: 15, last_error: "Domain not verified", detected_at: "2026-10-20T10:00:00Z" });
    expect(describeDeliveryProblem(problem!)).toBe("Delivery paused automatically: 12 of 15 sends failed. Last error: Domain not verified Fix the cause, then resume delivery.");
  });
  it("ignores missing or malformed records", () => {
    expect(readDeliveryProblem(null)).toBeNull();
    expect(readDeliveryProblem({ delivery_problem: "bad" })).toBeNull();
    expect(readDeliveryProblem({ delivery_problem: { failed: "1" } })).toBeNull();
  });
});
