import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The workspace key comes from the environment here, so no database is read.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => { throw new Error("No database in these tests."); }) }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: vi.fn() }));
import { analyzeImageWithConfiguredProvider, IMAGE_ANALYSIS_MAX_TOKENS } from "./provider";
import { completionLimitParams } from "./openai-compatible";

const input = { organizationId: "org", mimeType: "image/png" as const, base64: "aW1n", system: "system", prompt: "prompt" };
const fakeFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const sentBody = (fetchMock: ReturnType<typeof fakeFetch>) => JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as Record<string, unknown>;

beforeEach(() => vi.stubEnv("AI_API_KEY", "test-key"));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("image analysis request parameters", () => {
  it("sends OpenAI max_completion_tokens and no temperature", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "gpt-6-luna");
    const fetchMock = fakeFetch({ choices: [{ message: { content: "{}" } }] });
    vi.stubGlobal("fetch", fetchMock);
    await analyzeImageWithConfiguredProvider(input);
    const body = sentBody(fetchMock);
    expect(body.max_completion_tokens).toBe(IMAGE_ANALYSIS_MAX_TOKENS);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("temperature");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("keeps max_tokens and a low temperature for Gemini's compatible endpoint", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("AI_MODEL", "gemini-3.8-flash");
    const fetchMock = fakeFetch({ choices: [{ message: { content: "{}" } }] });
    vi.stubGlobal("fetch", fetchMock);
    await analyzeImageWithConfiguredProvider(input);
    const body = sentBody(fetchMock);
    expect(body).toMatchObject({ max_tokens: IMAGE_ANALYSIS_MAX_TOKENS, temperature: 0.2 });
    expect(body).not.toHaveProperty("max_completion_tokens");
  });

  it("gives Claude room for the longer reply", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("AI_MODEL", "claude-sonnet-5");
    const fetchMock = fakeFetch({ content: [{ type: "text", text: "{}" }] });
    vi.stubGlobal("fetch", fetchMock);
    await analyzeImageWithConfiguredProvider(input);
    expect(sentBody(fetchMock).max_tokens).toBe(IMAGE_ANALYSIS_MAX_TOKENS);
  });
});

describe("completionLimitParams", () => {
  it("is the one rule text and image requests share", () => {
    expect(completionLimitParams("openai", 100, 0.3)).toEqual({ max_completion_tokens: 100 });
    expect(completionLimitParams("compatible", 100, 0.3)).toEqual({ max_tokens: 100, temperature: 0.3 });
    expect(completionLimitParams("compatible", 100)).toEqual({ max_tokens: 100 });
  });
});
