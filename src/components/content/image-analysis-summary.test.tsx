import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageAnalysisSummary, isMarketingAnalysis } from "@/components/content/image-analysis-summary";
import type { ImageAnalysisV2 } from "@/lib/ai/image-analysis-v2";

const BANNER = "Digital Skills Workshop — Week 3";
const analysis: ImageAnalysisV2 = {
  version: 2, runId: "41000000-0000-4000-8000-0000000000aa", timing: "past", today: "2026-10-21",
  purposeRepair: { from: "drive_registrations", to: "recap_past_event", reason: "The event date has passed." },
  imageType: "event_photo", subtype: "workshop_in_action",
  purpose: { primary: "recap_past_event", rationale: "The workshop has happened." },
  onImageText: { lines: [BANNER], eventName: BANNER, date: "12 Oct", venue: null, callToAction: null, partnerNames: ["Lagos Tech Hub"], conflicts: [{ field: "date", onImage: "12 Oct", activityRecord: "14 Oct 2026" }] },
  angles: [
    { title: "Hands-on", angle: "Participants practised together.", groundedIn: ["description"] },
    { title: "Momentum", angle: "Three weeks of steady progress.", groundedIn: [] },
  ],
  captions: [],
  otherUses: [{ use: "carousel_slide", note: "Second slide." }],
  usability: { blurry: true, smallTextOnMobile: false, identifiableFaces: true, notes: ["Crop the left edge."] },
  altText: `People at a table under a banner reading ${BANNER}.`,
  sceneSummary: "A workshop group at a table.",
};
const render = (value = analysis) => renderToStaticMarkup(<ImageAnalysisSummary analysis={value} model="gemini-3.8-flash" />);

describe("ImageAnalysisSummary", () => {
  it("shows type, purpose and timing, with a repaired purpose explained", () => {
    const html = render();
    expect(html).toContain("Event photo · workshop in action");
    expect(html).toContain("Recap past event");
    expect(html).toContain("Past");
    expect(html).toContain("Purpose changed from drive registrations: The event date has passed.");
  });
  it("lists usability flags with identifiable faces first", () => {
    const html = render();
    expect(html.indexOf("Identifiable faces")).toBeLessThan(html.indexOf("Blurry"));
    expect(html).not.toContain("Text too small on mobile");
    expect(html).toContain("Crop the left edge.");
  });
  it("shows text on the image exactly, and highlights conflicts with the activity record", () => {
    const html = render();
    expect(html).toContain(BANNER);
    expect(html).toContain("Lagos Tech Hub");
    expect(html).toContain("the image says “12 Oct”, the activity record says “14 Oct 2026”. Captions use the activity record.");
  });
  it("labels the alt text for human checking and lists angles and other uses", () => {
    const html = render();
    expect(html).toContain("Needs human check");
    expect(html).toContain("Hands-on");
    expect(html).toContain("Carousel slide: Second slide.");
  });
  it("leaves out empty sections", () => {
    const html = render({ ...analysis, purposeRepair: null, otherUses: [], usability: { blurry: false, smallTextOnMobile: false, identifiableFaces: false, notes: [] }, onImageText: { lines: [], eventName: null, date: null, venue: null, callToAction: null, partnerNames: [], conflicts: [] } });
    expect(html).not.toContain("Text on the image");
    expect(html).not.toContain("Other uses");
    expect(html).not.toContain("Usability checks");
    expect(html).not.toContain("Purpose changed");
  });
  it("recognises only v2 analyses as the marketing view", () => {
    expect(isMarketingAnalysis({ ...analysis })).toBe(true);
    expect(isMarketingAnalysis({ sceneSummary: "Old." })).toBe(false);
    expect(isMarketingAnalysis(null)).toBe(false);
  });
});
