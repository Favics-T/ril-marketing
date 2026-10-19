import { describe, expect, it } from "vitest";
import { formatAutomationResult } from "./result-summary";

describe("automation result display", () => {
  it("shows a deferred reason instead of serialized flags", () => {
    expect(formatAutomationResult({ reason: "Lead recorded for follow-up.", deferred: true })).toBe("Lead recorded for follow-up.");
  });
  it("summarizes completed jobs without exposing internal IDs", () => {
    expect(formatAutomationResult({ campaignId: "internal-id", generatedAssets: 3, emailDrafts: 1, landingPages: 1 })).toBe("3 content drafts created · 1 email draft created · 1 landing page created.");
    expect(formatAutomationResult({ enrolled: 0, sequences: [] })).toBe("0 nurture enrolments.");
    expect(formatAutomationResult({ drafts_created: 4, generation_id: "internal-id" })).toBe("4 content drafts created.");
  });
  it("handles legacy serialized messages, plain text, and missing results", () => {
    expect(formatAutomationResult('{"reason":"Nurture is off","deferred":true}')).toBe("Nurture is off");
    expect(formatAutomationResult("Already processed.")).toBe("Already processed.");
    expect(formatAutomationResult(null)).toBe("No additional details.");
  });
});
