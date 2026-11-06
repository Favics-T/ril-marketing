import { afterEach, describe, expect, it, vi } from "vitest";
import { checkProviderModel } from "./connection-check";
import { defaultModel } from "./providers";

afterEach(() => vi.unstubAllGlobals());

describe("AI model connection checks", () => {
  it.each(["openai", "anthropic", "gemini"] as const)("checks %s model access without generation or putting keys in URLs", async provider => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: defaultModel(provider), name: `models/${defaultModel(provider)}`, supportedGenerationMethods: ["generateContent"] })));
    vi.stubGlobal("fetch", fetcher);
    expect(await checkProviderModel(provider, defaultModel(provider), "private-key")).toEqual({ ok: true });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain(`/models/${defaultModel(provider)}`);
    expect(url).not.toContain("private-key");
    expect(options.body).toBeUndefined();
    expect(Object.values(options.headers)).toContain(provider === "openai" ? "Bearer private-key" : "private-key");
  });
  it.each([401, 403, 404, 429, 500])("rejects HTTP %i", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    expect((await checkProviderModel("openai", defaultModel("openai"), "key")).ok).toBe(false);
  });
  it("does not contact a provider for an invalid model", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await checkProviderModel("openai", "fake-model", "key")).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects invalid provider responses and non-generation Gemini models", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}")).mockResolvedValueOnce(new Response(JSON.stringify({ name: "models/test", supportedGenerationMethods: ["embedContent"] })));
    vi.stubGlobal("fetch", fetcher);
    expect((await checkProviderModel("openai", defaultModel("openai"), "key")).ok).toBe(false);
    expect((await checkProviderModel("gemini", defaultModel("gemini"), "key")).ok).toBe(false);
  });
  it("returns a safe error after network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private-key in request")));
    const result = await checkProviderModel("openai", defaultModel("openai"), "private-key");
    expect(result.ok).toBe(false); expect(result.error).not.toContain("private-key");
  });
});
