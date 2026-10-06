import { describe, expect, it } from "vitest";
import {
  defaultModel,
  getProvider,
  isProviderKey,
  isSupportedModel,
  PROVIDER_KEYS,
} from "@/lib/ai/providers";
import {
  canTransitionAsset,
  isHighSensitivityApprover,
  isValidAssetStatus,
} from "@/lib/content/transitions";
import { scoreLead } from "@/lib/leads/scoring";
import { TemplateProvider } from "@/lib/ai/template";

describe("provider registry", () => {
  it("offers OpenAI, Claude and Gemini with curated models", () => {
    expect([...PROVIDER_KEYS].sort()).toEqual(["anthropic", "gemini", "openai"]);
    for (const key of PROVIDER_KEYS) {
      const def = getProvider(key);
      expect(def.models.length).toBeGreaterThanOrEqual(2);
      expect(def.models.some((m) => m.id === def.defaultModel)).toBe(true);
      expect(isSupportedModel(key, def.defaultModel)).toBe(true);
      expect(isSupportedModel(key, "not-a-real-model")).toBe(false);
    }
    // Defaults are pinned so a model refresh is always a deliberate edit.
    expect(defaultModel("openai")).toBe("gpt-6-luna");
    expect(defaultModel("anthropic")).toBe("claude-sonnet-5");
    expect(defaultModel("gemini")).toBe("gemini-3.8-flash");
  });

  it("falls back to OpenAI on unknown keys", () => {
    expect(getProvider("unknown").key).toBe("openai");
    expect(getProvider(null).key).toBe("openai");
    expect(isProviderKey("anthropic")).toBe(true);
    expect(isProviderKey("azure")).toBe(false);
  });
});

describe("canTransitionAsset", () => {
  it("enforces the §11 pipeline order", () => {
    expect(canTransitionAsset("editing", "review")).toBe(true);
    expect(canTransitionAsset("review", "approved")).toBe(true);
    expect(canTransitionAsset("approved", "scheduled")).toBe(true);
    expect(canTransitionAsset("scheduled", "published")).toBe(true);
    // Skips and backward jumps are blocked…
    expect(canTransitionAsset("editing", "approved")).toBe(false);
    expect(canTransitionAsset("idea", "published")).toBe(false);
    // …but rework loops are allowed.
    expect(canTransitionAsset("review", "editing")).toBe(true);
    expect(canTransitionAsset("approved", "editing")).toBe(true);
    expect(canTransitionAsset("scheduled", "approved")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidAssetStatus("idea")).toBe(true);
    expect(isValidAssetStatus("deleted")).toBe(false);
    expect(canTransitionAsset("idea", "deleted")).toBe(false);
  });
});

describe("isHighSensitivityApprover", () => {
  it("requires the named second tier", () => {
    expect(isHighSensitivityApprover("leadership")).toBe(true);
    expect(isHighSensitivityApprover("owner")).toBe(true);
    expect(isHighSensitivityApprover("marketing_manager")).toBe(false);
    expect(isHighSensitivityApprover("member")).toBe(false);
  });
});

describe("scoreLead", () => {
  it("classifies with an explanation", () => {
    expect(
      scoreLead({ is_qualified: false, is_converted: true, funnel_stage: "converted", eventCount: 0 }).score
    ).toBe("converted");
    expect(
      scoreLead({ is_qualified: true, is_converted: false, funnel_stage: "nurturing", eventCount: 1 }).score
    ).toBe("qualified");
    expect(
      scoreLead({ is_qualified: false, is_converted: false, funnel_stage: "nurturing", eventCount: 5 })
    ).toMatchObject({ score: "hot" });
    expect(
      scoreLead({ is_qualified: false, is_converted: false, funnel_stage: "captured", eventCount: 0 }).score
    ).toBe("cold");
    const warm = scoreLead({ is_qualified: false, is_converted: false, funnel_stage: "captured", eventCount: 2 });
    expect(warm.score).toBe("warm");
    expect(warm.reason.length).toBeGreaterThan(10);
  });
});

describe("TemplateProvider", () => {
  const ctx = {
    organizationName: "RIL",
    activityTitle: "Demo Day",
    activityDescription: "Ten startups pitched.",
    outcomes: "200 attendees.",
    speakers: ["Ada"],
    partners: [],
    eventDate: "2026-09-01",
    segmentName: "Early-stage Founders",
    topics: ["fundraising"],
    formats: ["short-form video"],
    platforms: ["linkedin"],
    hooks: ["Founder story"],
    ctas: ["Apply now"],
  };

  it("grounds every draft in source facts, never invents", async () => {
    const provider = new TemplateProvider();
    expect(provider.modelLabel).toBe("template-v1");
    for (const kind of ["blog", "newsletter", "social_pack", "short_form"] as const) {
      const { drafts } = await provider.generate(kind, ctx);
      expect(drafts.length).toBeGreaterThan(0);
      for (const d of drafts) {
        // Source facts present…
        expect(d.body).toContain("Demo Day");
        // …interpretation labelled as suggestion/draft.
        expect(d.body).toMatch(/suggestion|DRAFT/i);
      }
    }
  });

  it("degrades honestly without audience data", async () => {
    const provider = new TemplateProvider();
    const { drafts } = await provider.generate("blog", {
      ...ctx,
      topics: [],
      hooks: [],
      ctas: [],
      segmentName: null,
    });
    expect(drafts[0].body).toContain("Demo Day");
  });
});
