import { describe, expect, it } from "vitest";
import { cleanHashtags, failedResponseSnapshot, imageAnalysisInstructions, imageAnalysisSchema, MAX_FAILED_RESPONSE_LENGTH, MAX_HASHTAGS, parseImageAnalysis } from "@/lib/ai/image-analysis";

const caption = (overrides: Record<string, unknown> = {}) => ({
  platform: "instagram",
  caption: "Founders pitched their prototypes to the panel.",
  hashtags: ["#RIL"],
  rationale: "Shows the energy of the room.",
  ...overrides,
});

const captionWithout = (key: string) => Object.fromEntries(Object.entries(caption()).filter(([name]) => name !== key));

const response =(captions: Array<Record<string, unknown>>) => JSON.stringify({
  sceneSummary: "A presenter stands beside a projected slide in a full room.",
  altText: "Presenter speaking to a seated audience.",
  qualityNotes: [],
  captions,
});

describe("cleanHashtags", () => {
  it("adds the missing # to a full set of tags (the REN-425 failure)", () => {
    expect(cleanHashtags(["Startups", "Founders", "PitchDay", "RIL", "Lagos"])).toEqual(["#Startups", "#Founders", "#PitchDay", "#RIL", "#Lagos"]);
  });

  it("removes spaces inside a tag", () => {
    expect(cleanHashtags(["#Pitch Day", " Demo  Night "])).toEqual(["#PitchDay", "#DemoNight"]);
  });

  it("removes hyphens, punctuation and emoji", () => {
    expect(cleanHashtags(["#AI-for-good", "#RIL2026!", "#Founders'", "#🚀Launch"])).toEqual(["#AIforgood", "#RIL2026", "#Founders", "#Launch"]);
  });

  it("collapses repeated #", () => {
    expect(cleanHashtags(["##RIL"])).toEqual(["#RIL"]);
  });

  it("keeps non-Latin letters", () => {
    expect(cleanHashtags(["#Café", "東京", "#Lagos_Tech"])).toEqual(["#Café", "#東京", "#Lagos_Tech"]);
  });

  it("splits one string holding several tags", () => {
    expect(cleanHashtags("#Startups, #Founders #RIL;Lagos")).toEqual(["#Startups", "#Founders", "#RIL", "#Lagos"]);
    expect(cleanHashtags("Startups Founders")).toEqual(["#Startups", "#Founders"]);
  });

  it("splits an array item holding several tags", () => {
    expect(cleanHashtags(["#Startups #Founders", "RIL, Lagos"])).toEqual(["#Startups", "#Founders", "#RIL", "#Lagos"]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(cleanHashtags(["#RIL", "ril", "#Ril", "#PitchDay", "#pitchday"])).toEqual(["#RIL", "#PitchDay"]);
  });

  it(`caps the count at ${MAX_HASHTAGS}`, () => {
    const tags = Array.from({ length: 20 }, (_, i) => `Tag${i}`);
    expect(cleanHashtags(tags)).toEqual(tags.slice(0, MAX_HASHTAGS).map((tag) => `#${tag}`));
  });

  it("drops tags that stay unusable", () => {
    const tooLong = "a".repeat(51);
    expect(cleanHashtags(["#", "!!!", "  ", "2026", "#2026", tooLong, "#RIL"])).toEqual(["#RIL"]);
  });

  it("skips non-string items and returns [] for non-array values", () => {
    expect(cleanHashtags([null, 5, { tag: "#x" }, ["#y"], "#RIL"])).toEqual(["#RIL"]);
    expect(cleanHashtags(null)).toEqual([]);
    expect(cleanHashtags(undefined)).toEqual([]);
    expect(cleanHashtags(42)).toEqual([]);
    expect(cleanHashtags({ tags: ["#RIL"] })).toEqual([]);
  });
});

describe("parseImageAnalysis", () => {
  it("parses a caption whose tags all lack #", () => {
    const result = parseImageAnalysis(response([caption({ hashtags: ["Startups", "Founders", "PitchDay", "RIL"] })]));
    expect(result.captions[0].hashtags).toEqual(["#Startups", "#Founders", "#PitchDay", "#RIL"]);
  });

  it("keeps the caption and summary when every hashtag is unusable", () => {
    const result = parseImageAnalysis(response([caption({ hashtags: ["!!!", "#", "2026"] })]));
    expect(result.captions[0].hashtags).toEqual([]);
    expect(result.captions[0].caption).toBe("Founders pitched their prototypes to the panel.");
    expect(result.sceneSummary).toMatch(/presenter/);
    expect(result.altText).toMatch(/Presenter/);
  });

  it("treats missing, null or wrongly typed hashtags as none", () => {
    const result = parseImageAnalysis(response([
      captionWithout("hashtags"),
      caption({ platform: "linkedin", hashtags: null }),
      caption({ platform: "facebook", hashtags: 7 }),
    ]));
    expect(result.captions.map((item) => item.hashtags)).toEqual([[], [], []]);
  });

  it("caps hashtags per caption instead of failing", () => {
    const result = parseImageAnalysis(response([caption({ hashtags: Array.from({ length: 16 }, (_, i) => `#Tag${i}`) })]));
    expect(result.captions[0].hashtags).toHaveLength(MAX_HASHTAGS);
  });

  it("lowercases platforms and maps twitter to x", () => {
    const result = parseImageAnalysis(response([caption({ platform: "Instagram" }), caption({ platform: " Twitter " })]));
    expect(result.captions.map((item) => item.platform)).toEqual(["instagram", "x"]);
  });

  it("still rejects duplicate platforms after normalising", () => {
    expect(() => parseImageAnalysis(response([caption({ platform: "X" }), caption({ platform: "twitter" })]))).toThrow(/Caption platforms must be unique/);
  });

  it("parses JSON wrapped in a code fence", () => {
    const result = parseImageAnalysis("```json\n" + response([caption()]) + "\n```");
    expect(result.captions[0].hashtags).toEqual(["#RIL"]);
  });

  it("gives the same result when a saved analysis is parsed again", () => {
    const first = parseImageAnalysis(response([caption({ hashtags: ["Pitch Day", "#RIL", "ril"] })]));
    expect(imageAnalysisSchema.parse(first)).toEqual(first);
  });

  it("still rejects a missing caption, with a readable message", () => {
    expect(() => parseImageAnalysis(response([captionWithout("caption")]))).toThrow(/^Could not validate the image analysis: captions\.0\.caption: /);
  });

  it("still rejects an unknown platform", () => {
    expect(() => parseImageAnalysis(response([caption({ platform: "myspace" })]))).toThrow(/captions\.0\.platform/);
  });

  it("reports text with no JSON object", () => {
    expect(() => parseImageAnalysis("Sorry, I can't help with that.")).toThrow(/did not return the required structured result/);
  });

  it("reports malformed JSON", () => {
    expect(() => parseImageAnalysis('{"sceneSummary": "cut off')).toThrow(/did not return the required structured result/);
    expect(() => parseImageAnalysis('{"sceneSummary": }')).toThrow(/^Could not validate the image analysis: /);
  });
});

describe("failedResponseSnapshot", () => {
  it("leaves ordinary text unchanged", () => {
    const text = '{"sceneSummary": "A presenter on stage", "captions": "none"}';
    expect(failedResponseSnapshot(text)).toBe(text);
  });

  it(`truncates to ${MAX_FAILED_RESPONSE_LENGTH} characters`, () => {
    expect(failedResponseSnapshot("a".repeat(5000))).toBe("a".repeat(MAX_FAILED_RESPONSE_LENGTH));
  });

  it.each([
    ["an OpenAI key", `sk-${"A1b2".repeat(10)}`],
    ["an OpenAI project key", `sk-proj-${"A1b2_".repeat(10)}`],
    ["an Anthropic key", `sk-ant-api03-${"A1b2-".repeat(10)}`],
    ["a Google key", `AIza${"Sy0_-".repeat(7)}`],
    ["a JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlLXZhbHVl"],
  ])("redacts %s", (_label, secret) => {
    const snapshot = failedResponseSnapshot(`Slide text: ${secret} end`);
    expect(snapshot).toBe("Slide text: [redacted] end");
  });

  it("redacts bearer tokens", () => {
    expect(failedResponseSnapshot("Authorization: Bearer abcDEF123456ghiJKL789==")).toBe("Authorization: [redacted]");
  });

  it("redacts before truncating, so a key cut at the limit cannot leak", () => {
    const key = `sk-${"k".repeat(40)}`;
    const snapshot = failedResponseSnapshot(`${"a".repeat(MAX_FAILED_RESPONSE_LENGTH - 10)} ${key}`);
    expect(snapshot).toHaveLength(MAX_FAILED_RESPONSE_LENGTH);
    expect(snapshot).not.toContain("kkkkk");
  });
});

describe("imageAnalysisInstructions", () => {
  it("states the hashtag format and the counts for the requested platforms", () => {
    const text = imageAnalysisInstructions(["linkedin", "instagram"]);
    expect(text).toMatch(/starts with a single "#"/);
    expect(text).toMatch(/CamelCase/);
    expect(text).toMatch(/No duplicates/);
    expect(text).toMatch(/linkedin 3-5, instagram 5-10\./);
    expect(text).not.toMatch(/tiktok 3-6/);
  });
});
