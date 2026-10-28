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
  resolutions: [], missingDetails: [],
};
const render = (value = analysis) => renderToStaticMarkup(<ImageAnalysisSummary analysis={value} model="gemini-3.8-flash" />);
const DEMO_DAY = { field: "eventName", onImage: "DEMO DAY", activityRecord: "Testing" };
const demoDay: ImageAnalysisV2 = {
  ...analysis, timing: "upcoming", purposeRepair: null,
  purpose: { primary: "drive_registrations", rationale: "The flyer invites founders to register for DEMO DAY." },
  onImageText: { lines: ["DEMO DAY"], eventName: "DEMO DAY", date: null, venue: null, callToAction: "Register now", partnerNames: [], conflicts: [DEMO_DAY] },
  usability: { blurry: false, smallTextOnMobile: false, identifiableFaces: false, notes: ["The image says DEMO DAY but the activity record says Testing.", "Check DEMO DAY is spelled the same on the banner."] },
};

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
    expect(html).toContain("the image says “12 Oct”, the activity record says “14 Oct 2026”.");
    expect(html).toContain("Caption drafts are on hold until you choose.");
  });
  it("marks an open conflict as needing resolution and says the drafts are on hold", () => {
    const html = render(demoDay);
    expect(html).toContain("Needs resolution");
    expect(html).toContain("<span class=\"font-semibold\">Event name:</span> the image says “DEMO DAY”, the activity record says “Testing”.");
    expect(html).toContain("Caption drafts are on hold until the conflicts above are resolved");
    expect(html).not.toContain("Caption drafts are in the Content Library");
  });
  it("renders the conflict actions it is given, only for open conflicts", () => {
    const actions = (conflict: { onImage: string }) => <button type="button">Use “{conflict.onImage}”</button>;
    expect(renderToStaticMarkup(<ImageAnalysisSummary analysis={demoDay} model="m" conflictActions={actions} />)).toContain("<button type=\"button\">Use “DEMO DAY”</button>");
    const chosen = { ...demoDay, resolutions: [{ field: "eventName", key: "eventName" as const, value: "DEMO DAY", recordValue: "Testing", choice: "image" as const, recordKey: "k" }] };
    const html = renderToStaticMarkup(<ImageAnalysisSummary analysis={chosen} model="m" conflictActions={actions} />);
    expect(html).not.toContain("<button");
    expect(html).toContain("Choice saved: use “DEMO DAY” from the image.");
    expect(html).not.toContain("Needs resolution");
  });
  it("labels the event name as detected on the image, with the record's value beside it on a conflict", () => {
    const html = render(demoDay);
    expect(html).toContain("<dt>Event name (detected on image)</dt><dd class=\"text-foreground\">DEMO DAY<span class=\"text-destructive\"> · activity record: “Testing”</span></dd>");
    const agreed = render({ ...demoDay, onImageText: { ...demoDay.onImageText, conflicts: [] } });
    expect(agreed).toContain("<dd class=\"text-foreground\">DEMO DAY</dd>");
  });
  it("hides a usability note that restates a conflict, but keeps notes that only mention the event name", () => {
    const html = render(demoDay);
    expect(html).not.toContain("The image says DEMO DAY but the activity record says Testing.");
    expect(html).toContain("Check DEMO DAY is spelled the same on the banner.");
  });
  it("shows choices settled on an earlier run", () => {
    const settled = { ...demoDay, onImageText: { ...demoDay.onImageText, conflicts: [] }, resolutions: [{ field: "eventName", key: "eventName" as const, value: "DEMO DAY", recordValue: "Testing", choice: "record_updated" as const, recordKey: "k" }] };
    expect(render(settled)).toContain("Event name: the activity record was updated to “DEMO DAY”.");
  });
  it("lists what a registration graphic is missing and whether the record fills the gap", () => {
    const html = render({ ...demoDay, missingDetails: [{ detail: "date", inRecord: true }, { detail: "venue", inRecord: false }, { detail: "registration", inRecord: false }] });
    expect(html).toContain("Missing from the graphic");
    expect(html).toContain("Date: captions use the activity record&#x27;s date.");
    expect(html).toContain("Venue: the activity record has no venue");
    expect(html).toContain("Registration link: not in the activity record either.");
  });
  it("renders an analysis saved before conflict choices existed", () => {
    const older = { ...demoDay, resolutions: undefined, missingDetails: undefined } as unknown as ImageAnalysisV2;
    expect(render(older)).toContain("Needs resolution");
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
