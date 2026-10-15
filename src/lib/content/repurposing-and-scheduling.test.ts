import { describe, expect, it } from "vitest";
import { futureSchedule, localSchedule } from "./scheduling";
import { audioVideoSchema } from "./media-repurposing";
import { articleHtml } from "./article-html";

describe("publishing times", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  it("converts an explicit local offset to UTC", () => expect(futureSchedule("2026-10-15T09:00:00+01:00", now)).toBe("2026-10-15T08:00:00.000Z"));
  it.each(["", "invalid", "2026-10-15T09:00", "2026-10-14T11:00:00Z", "2026-10-14T12:00:20Z"])("rejects invalid, ambiguous or elapsed times: %s", date => expect(() => futureSchedule(date, now)).toThrow());
  it("rejects an empty browser time", () => expect(() => localSchedule("")).toThrow());
});

describe("media repurposing contract", () => {
  const pairs = [["blog", "website"], ["newsletter", "email"], ["social post", "linkedin"], ["short-form video", "youtube"]];
  const analysis = { transcript: "Source speech", summary: "A factual recording summary", drafts: pairs.map(([format, platform]) => ({ title: "Source-linked draft", body: "Factual source copy for human review. ".repeat(4), format, platform })) };
  it("requires all four review outputs, including the short-form script", () => expect(audioVideoSchema.parse(analysis).drafts).toHaveLength(4));
  it("does not treat the old three-output analysis as complete", () => expect(audioVideoSchema.safeParse({ ...analysis, drafts: analysis.drafts.slice(0, 3) }).success).toBe(false));
  it("rejects four repeated formats masquerading as four outputs", () => expect(audioVideoSchema.safeParse({ ...analysis, drafts: analysis.drafts.map(() => analysis.drafts[0]) }).success).toBe(false));
});

describe("website article formatting", () => {
  it("keeps semantic headings and lists without a second page h1", () => expect(articleHtml("# Overview\n\nFirst line\nSecond line\n\n- A\n- B\n\n1. C\n2. D")).toBe("<h2>Overview</h2>\n<p>First line<br>Second line</p>\n<ul><li>A</li><li>B</li></ul>\n<ol><li>C</li><li>D</li></ol>"));
  it("escapes source HTML and entities instead of executing them", () => expect(articleHtml('<script>alert("x")</script> & <img src=x onerror=alert(1)>')).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;img src=x onerror=alert(1)&gt;</p>"));
});
