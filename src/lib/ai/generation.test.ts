import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, buildPrompt } from "@/lib/ai/prompt";
import { extractJsonObject, parseStructured } from "@/lib/ai/parse";
import { LlmGenerator, createLimiter } from "@/lib/ai/llm-generator";
import { resolveOptions, specFor } from "@/lib/ai/specs";
import { xQuality } from "@/lib/ai/specs/social";
import { clipQuality } from "@/lib/ai/specs/short-form";
import { chunkText, condenseSourceMaterial } from "@/lib/ai/source";
import { materialsFromAnalyses } from "@/lib/content/source-material";
import { SOCIAL_PLATFORMS, type GenerationContext, type LlmClient, type LlmRequest, type RepurposeKind } from "@/lib/ai/types";
import { z } from "zod";

const NOW = new Date("2026-10-06T09:00:00Z");

const TRANSCRIPT =
  'Ada Obi: "Founders who ship weekly learn faster than founders who plan quarterly." She told the room that the cohort shipped 40 prototypes in six weeks.';

const ctx: GenerationContext = {
  organizationName: "RIL",
  activityTitle: "Founders Demo Day",
  activityDescription: "Ten startups pitched to investors.",
  outcomes: "Three teams received follow-up meetings.",
  speakers: ["Ada Obi"],
  partners: [],
  eventDate: "2026-09-01",
  segmentName: "Early-stage Founders",
  topics: [],
  formats: [],
  platforms: [],
  hooks: [],
  ctas: [],
  registrationUrl: "https://ril.example/apply",
  sourceMaterial: [{ kind: "transcript", label: "Transcript — demo.mp4", text: TRANSCRIPT, timestamped: false }],
};

const words = (n: number, word = "insight") => Array.from({ length: n }, () => word).join(" ");

/** Minimal valid replies, one per generation unit. */
function validReply(key: string): Record<string, unknown> {
  const notes = { interpretationNotes: [], missingInformation: [] };
  switch (key) {
    case "blog":
      return {
        title: "What Demo Day taught us",
        seoTitle: "Founders Demo Day: lessons from shipping weekly",
        metaDescription: "Ten startups pitched at RIL's Founders Demo Day. Here's what weekly shipping taught the cohort and why it matters for early-stage founders.",
        keywords: ["demo day", "founders", "shipping weekly", "startups", "RIL"],
        outline: ["Ship weekly", "What investors noticed"],
        hook: "Forty prototypes in six weeks.",
        body: `Intro ${words(300)}\n\n## Ship weekly\n${words(300)}\n\n## What investors noticed\n${words(300)}`,
        cta: "Apply for the next cohort",
        topic: "demo day",
        internalLinkSuggestions: [{ anchorText: "our programs", suggestedPath: "/programs/founders", reason: "related" }, { anchorText: "bad", suggestedPath: "https://x.com", reason: "" }],
        ...notes,
      };
    case "newsletter":
      return {
        subjectLines: ["Forty prototypes later", "What Demo Day taught us", "Demo Day recap"],
        previewText: "Ten startups, three follow-up meetings, one big lesson.",
        intro: `Hello founders. ${words(60)}`,
        highlights: [1, 2, 3].map((i) => ({ heading: `Highlight ${i}`, paragraph: words(100) })),
        quotes: [
          { text: "Founders who ship weekly learn faster than founders who plan quarterly.", speaker: "Ada Obi" },
          { text: "We raised ten million dollars.", speaker: "Someone" },
        ],
        links: [{ label: "Apply", url: "https://ril.example/apply" }, { label: "Invented", url: "https://made-up.example" }],
        cta: "Apply now",
        closing: "Onwards!",
        topic: "demo day",
        ...notes,
      };
    case "social:linkedin":
      return { title: "LinkedIn", hook: "Forty prototypes in six weeks.", post: words(200), takeaway: "Ship weekly.", cta: "Apply", hashtags: ["Startups", "#Founders", "RIL"], topic: "t", ...notes };
    case "social:instagram":
      return { title: "IG", hook: "40 prototypes.", caption: words(150), cta: "Apply", hashtags: ["a", "b", "c", "d", "e"], topic: "t", ...notes };
    case "social:x":
      return { title: "X", post: "Forty prototypes in six weeks. Ship weekly.", thread: [], cta: null, topic: "t", ...notes };
    case "social:youtube":
      return { videoTitle: "Founders Demo Day recap", description: words(200), chapters: [{ time: "00:00", label: "Intro" }], tags: ["demo day"], cta: "Subscribe", topic: "t", ...notes };
    case "social:tiktok":
      return { title: "TikTok", hook: "POV: 40 prototypes", caption: "Six weeks, forty prototypes.", onScreenText: ["6 weeks", "40 prototypes", "1 lesson"], cta: "Follow", hashtags: ["a", "b", "c"], topic: "t", ...notes };
    case "short_form":
      return { clips: [], noStrongClipReason: "The source has no standout moment.", topic: "t", ...notes };
    default:
      throw new Error(`no fixture for ${key}`);
  }
}

function keyFromPrompt(prompt: string): string {
  const task = prompt.match(/# Task: (.+)/)?.[1] ?? "";
  return (
    {
      "Blog post": "blog",
      Newsletter: "newsletter",
      "LinkedIn post": "social:linkedin",
      "Instagram caption": "social:instagram",
      "X post": "social:x",
      "YouTube metadata": "social:youtube",
      "TikTok post": "social:tiktok",
      "Short-form clips": "short_form",
    } as Record<string, string>
  )[task];
}

class FakeClient implements LlmClient {
  readonly model = "fake-model";
  requests: LlmRequest[] = [];
  constructor(private readonly reply: (request: LlmRequest, call: number) => string) {}
  async complete(request: LlmRequest) {
    this.requests.push(request);
    return { text: this.reply(request, this.requests.length), truncated: false };
  }
}

const happyClient = () => new FakeClient((request) => JSON.stringify(validReply(keyFromPrompt(request.messages[0].content))));

describe("buildPrompt", () => {
  const cases: Array<[RepurposeKind, string | undefined, RegExp]> = [
    ["blog", undefined, /800–1200 words/],
    ["newsletter", undefined, /exactly 3 distinct options/],
    ["short_form", undefined, /Never force a weak clip/],
    ["social_pack", "linkedin", /thought-leadership post of 150–300 words/],
    ["social_pack", "instagram", /5–10 relevant hashtags/],
    ["social_pack", "x", /at most 280 characters/],
    ["social_pack", "youtube", /"videoTitle"/],
    ["social_pack", "tiktok", /onScreenText/],
  ];

  it.each(cases)("%s %s includes its spec, example, shape and the source material", (kind, platform, specText) => {
    const prompt = buildPrompt(kind, ctx, platform as never, NOW);
    expect(prompt).toMatch(specText);
    expect(prompt).toContain("# Quality bar");
    expect(prompt).toContain("# Return format");
    expect(prompt).toContain('kind="transcript"');
    expect(prompt).toContain(TRANSCRIPT);
    expect(prompt).toContain("Registration link: https://ril.example/apply");
  });

  it("puts source material first and the task last", () => {
    const prompt = buildPrompt("blog", ctx, undefined, NOW);
    expect(prompt.indexOf("# Source material")).toBeLessThan(prompt.indexOf("# Task"));
    expect(prompt.indexOf("# Task")).toBeLessThan(prompt.indexOf("# Return format"));
  });

  it("tells the model when there is no source material instead of leaving a gap", () => {
    expect(buildPrompt("blog", { ...ctx, sourceMaterial: [] }, undefined, NOW)).toMatch(/No transcript, document or media notes were supplied/);
  });

  it("applies generation options and sensible defaults", () => {
    const tuned = buildPrompt("blog", { ...ctx, options: { length: "long", seoFocusKeyword: "demo day", tone: "playful" } }, undefined, NOW);
    expect(tuned).toMatch(/1500–2000 words/);
    expect(tuned).toContain('containing the focus keyword "demo day"');
    expect(tuned).toContain("Tone: playful");
    const defaults = resolveOptions(ctx, NOW);
    expect(defaults).toMatchObject({ length: "standard", audience: "Early-stage Founders", newsletterStyle: "event_recap", hasTimestamps: false });
    expect(resolveOptions({ ...ctx, eventDate: "2026-12-01" }, NOW)).toMatchObject({ newsletterStyle: "program_promotion", objective: "drive registrations for the upcoming activity" });
  });

  it("uses the campaign's audience and funnel stage, with the brief taking precedence", () => {
    const withCampaign = { ...ctx, campaignAudience: "University students in Lagos", campaignFunnelStage: "lead_capture" };
    const prompt = buildPrompt("blog", withCampaign, undefined, NOW);
    expect(prompt).toContain("Campaign target audience: University students in Lagos");
    expect(prompt).toContain("Campaign funnel stage: lead capture");
    expect(resolveOptions(withCampaign, NOW).audience).toBe("University students in Lagos");
    expect(resolveOptions({ ...withCampaign, options: { audience: "Hiring managers" } }, NOW).audience).toBe("Hiring managers");
  });

  it("only offers chapters and clip times when the source has timestamps", () => {
    expect(buildPrompt("social_pack", ctx, "youtube", NOW)).toMatch(/return \[\] — never guess times/);
    const timed = { ...ctx, sourceMaterial: [{ kind: "key_moments" as const, label: "Key moments", text: "00:42 — pitch", timestamped: true }] };
    expect(buildPrompt("short_form", timed, undefined, NOW)).toMatch(/use ONLY timestamps that appear in the source/);
  });

  it("system prompt keeps grounding rules and no longer asks for short copy", () => {
    expect(SYSTEM_PROMPT).toMatch(/Never invent speakers, names, dates, numbers, statistics, quotes, outcomes/);
    expect(SYSTEM_PROMPT).toMatch(/interpretationNotes/);
    expect(SYSTEM_PROMPT).not.toMatch(/keep it short/i);
  });
});

describe("response parsing", () => {
  const schema = z.object({ title: z.string().min(3) });

  it("accepts bare, fenced and prose-wrapped JSON", () => {
    expect(extractJsonObject('{"title":"Hello"}')).toEqual({ ok: true, value: { title: "Hello" } });
    expect(parseStructured(schema, '```json\n{"title":"Hello"}\n```')).toEqual({ ok: true, value: { title: "Hello" } });
    expect(parseStructured(schema, 'Here you go:\n{"title":"Hello"}\nThanks!')).toEqual({ ok: true, value: { title: "Hello" } });
  });

  it("explains invalid JSON and schema mismatches for the retry prompt", () => {
    const broken = parseStructured(schema, '{"title": ');
    expect(broken.ok).toBe(false);
    const missing = parseStructured(schema, '{"title": "x"}');
    expect(missing).toMatchObject({ ok: false });
    expect(!missing.ok && missing.error).toMatch(/title:/);
  });

  it("validates a full blog reply and maps SEO fields where the editor reads them", () => {
    const result = specFor("blog").parseAndBuild(JSON.stringify(validReply("blog")), ctx, resolveOptions(ctx, NOW));
    expect(result.ok).toBe(true);
    const draft = result.ok ? result.value.drafts[0] : null;
    expect(draft).toMatchObject({ channel: "website", format: "blog", title: "What Demo Day taught us" });
    expect(draft?.metadata.seo).toMatchObject({ keywords: expect.arrayContaining(["demo day"]), internalLinks: ["/programs/founders"] });
  });
});

describe("LlmGenerator", () => {
  it("generates the social pack as one distinct call per platform", async () => {
    const client = happyClient();
    const { drafts, warnings } = await new LlmGenerator(client, { now: () => NOW }).generate("social_pack", ctx);
    expect(client.requests).toHaveLength(SOCIAL_PLATFORMS.length);
    expect(drafts.map((d) => d.platform).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
    expect(warnings).toEqual([]);
    for (const draft of drafts) expect(draft.metadata).toMatchObject({ generator: "fake-model", ai_generated: true });
    const linkedin = drafts.find((d) => d.platform === "linkedin");
    expect(linkedin?.body).toContain("#Startups #Founders #RIL");
  });

  it("retries once with the validation error, then succeeds", async () => {
    const client = new FakeClient((request, call) => (call === 1 ? '{"title": "too thin"}' : JSON.stringify(validReply("blog"))));
    const { drafts } = await new LlmGenerator(client, { now: () => NOW }).generate("blog", ctx);
    expect(client.requests).toHaveLength(2);
    const retry = client.requests[1].messages;
    expect(retry[1]).toEqual({ role: "assistant", content: '{"title": "too thin"}' });
    expect(retry[2].content).toMatch(/could not be used: The JSON did not match the required shape/);
    expect(drafts[0].metadata.attempts).toBe(2);
  });

  it("throws after a second invalid reply so the caller can report it", async () => {
    const client = new FakeClient(() => "not json at all");
    await expect(new LlmGenerator(client).generate("blog", ctx)).rejects.toThrow(/Blog post: The reply did not contain a JSON object/);
    expect(client.requests).toHaveLength(2);
  });

  it("keeps the platforms that worked when one fails", async () => {
    const client = new FakeClient((request) => {
      const key = keyFromPrompt(request.messages[0].content);
      return key === "social:tiktok" ? "{}" : JSON.stringify(validReply(key));
    });
    const { drafts, warnings } = await new LlmGenerator(client, { now: () => NOW }).generate("social_pack", ctx);
    expect(drafts).toHaveLength(4);
    expect(warnings.join(" ")).toMatch(/TikTok post: .* not generated/);
  });

  it("returns no forced clips when the model finds none", async () => {
    const { drafts, warnings } = await new LlmGenerator(happyClient(), { now: () => NOW }).generate("short_form", ctx);
    expect(drafts).toEqual([]);
    expect(warnings[0]).toMatch(/No strong short-form clip found: The source has no standout moment/);
  });

  it("uses per-kind token budgets", async () => {
    const client = happyClient();
    const generator = new LlmGenerator(client, { now: () => NOW });
    await generator.generate("blog", ctx);
    await generator.generate("social_pack", ctx);
    expect(client.requests[0].maxTokens).toBe(7000);
    expect(Math.max(...client.requests.slice(1).map((r) => r.maxTokens))).toBeLessThan(7000);
  });
});

describe("quality checks", () => {
  const opts = resolveOptions(ctx, NOW);

  it("flags X posts and thread posts over 280 characters", () => {
    const flags = xQuality({ title: "x", post: "a".repeat(281), thread: ["b".repeat(300), "ok", "ok", "ok"], cta: null, topic: null, interpretationNotes: [], missingInformation: [] });
    expect(flags.filter((f) => f.code === "over_platform_limit")).toHaveLength(2);
    expect(xQuality({ title: "x", post: `${"a".repeat(250)} https://example.com/a-very-long-path-that-counts-as-23`, thread: [], cta: null, topic: null, interpretationNotes: [], missingInformation: [] })).toEqual([]);
  });

  it("flags a blog under the minimum length", () => {
    const short = { ...validReply("blog"), body: `## One\n${words(100)}\n\n## Two\n${words(100)}` };
    const result = specFor("blog").parseAndBuild(JSON.stringify(short), ctx, opts);
    const flags = result.ok ? (result.value.drafts[0].metadata.quality_flags as Array<{ code: string }>) : [];
    expect(flags.some((f) => f.code === "under_length")).toBe(true);
  });

  it("flags quotes not in the source and removes invented links from newsletters", () => {
    const result = specFor("newsletter").parseAndBuild(JSON.stringify(validReply("newsletter")), ctx, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const draft = result.value.drafts[0];
    const flags = draft.metadata.quality_flags as Array<{ code: string; message: string }>;
    expect(flags.filter((f) => f.code === "quote_not_in_source")).toHaveLength(1);
    expect(flags.some((f) => f.code === "unverified_link" && f.message.includes("made-up.example"))).toBe(true);
    expect(draft.body).toContain("https://ril.example/apply");
    expect(draft.body).not.toContain("made-up.example");
    expect(draft.title).toBe("Forty prototypes later");
    expect(draft.metadata.subject_lines).toHaveLength(3);
  });

  it("strips guessed clip times when the source has no timestamps", () => {
    const clip = { title: "Clip", start: "00:10", end: "00:40", hook: "Hook line", caption: "A caption here", cta: "Apply", platform: "tiktok" as const, objective: "awareness", reason: "Strong quotable line" };
    expect(clipQuality(clip, false)).toMatchObject({ clip: { start: null, end: null }, flags: [{ code: "timestamps_unavailable" }] });
    expect(clipQuality({ ...clip, start: "00:50" }, true).flags[0].code).toBe("off_spec");
    expect(clipQuality(clip, true).flags).toEqual([]);
  });
});

describe("source material", () => {
  it("maps media analyses to transcripts, timestamped key moments and photo notes", () => {
    const materials = materialsFromAnalyses([
      { attachment_id: "a", attachment: { file_name: "talk.mp4", mime_type: "video/mp4" }, analysis: { transcript: "Hello world", summary: "A talk", keyMoments: [{ time: "00:01:10", note: "Big claim" }], suggestedClips: [] } },
      { attachment_id: "b", attachment: [{ file_name: "stage.jpg", mime_type: "image/jpeg" }], analysis: { sceneSummary: "A full room", altText: "Audience" } },
    ]);
    expect(materials.map((m) => [m.kind, m.timestamped])).toEqual([["transcript", false], ["key_moments", true], ["image_notes", false]]);
    expect(materials[1].text).toContain("00:01:10 — Big claim");
  });

  it("chunks on natural boundaries", () => {
    const chunks = chunkText(`${"a".repeat(80)}\n\n${"b".repeat(80)}`, 100);
    expect(chunks).toEqual(["a".repeat(80), "b".repeat(80)]);
  });

  it("passes small sources through and summarises oversized ones instead of dropping them", async () => {
    const small = [{ kind: "notes" as const, label: "Notes", text: "short", timestamped: false }];
    expect((await condenseSourceMaterial(small, null, 100)).materials).toEqual(small);

    const big = [{ kind: "transcript" as const, label: "Long talk", text: "word ".repeat(100), timestamped: false }];
    const calls: number[] = [];
    const { materials, notes } = await condenseSourceMaterial(big, async ({ part }) => (calls.push(part), `notes ${part}`), 200);
    expect(materials[0]).toMatchObject({ condensed: true, text: "notes 1" });
    expect(calls).toEqual([1]);
    expect(notes[0]).toMatch(/summarised to fit/);
  });

  it("truncates with an explicit marker when summarising isn't possible", async () => {
    const big = [{ kind: "document" as const, label: "Report", text: "x".repeat(500), timestamped: false }];
    const { materials, notes } = await condenseSourceMaterial(big, null, 100);
    expect(materials[0].text).toMatch(/more characters of this source were omitted/);
    expect(notes[0]).toMatch(/shortened by 400 characters/);
  });
});

describe("createLimiter", () => {
  it("never runs more than the limit at once", async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active--;
        })
      )
    );
    expect(peak).toBe(2);
  });
});
