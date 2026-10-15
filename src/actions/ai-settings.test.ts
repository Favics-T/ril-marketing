import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ role: vi.fn(), org: vi.fn(), check: vi.fn(), single: vi.fn(), upsert: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role, requireReviewer: vi.fn(), isReviewerRole: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ testAiConnection: mocks.check, generateRepurposing: vi.fn(), completeWithConfiguredProvider: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.single }) }) }), upsert: mocks.upsert, update: mocks.update }) }) }));
import { connectAiProvider, disconnectAiProvider, saveAiSettings } from "./content";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";
import { defaultModel } from "@/lib/ai/providers";
function form(provider = "openai", key = "test-key-1234") {
  const data = new FormData(); data.set("provider", provider); data.set("model", defaultModel(provider as "openai" | "anthropic")); data.set("apiKey", key); return data;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AI_API_KEY", ""); vi.stubEnv("AI_CONFIG_SECRET", "test-encryption-secret");
  mocks.role.mockResolvedValue("owner"); mocks.org.mockResolvedValue("org"); mocks.single.mockResolvedValue({ data: null, error: null }); mocks.check.mockResolvedValue({ ok: true }); mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: () => ({ eq: async () => ({ error: null }) }) });
});
afterEach(() => vi.unstubAllEnvs());
describe("AI settings mutations", () => {
  it("keeps and rechecks encrypted keys when changing a model", async () => {
    mocks.single.mockResolvedValue({ data: { config: { provider: "openai", apiKey: encryptSecret("saved-key-5678") } }, error: null });
    const result = await connectAiProvider(form("openai", ""));
    expect(result.ok).toBe(true); expect(result.last4).toBe("5678");
    expect(mocks.check).toHaveBeenCalledWith({ provider: "openai", model: defaultModel("openai"), apiKey: "saved-key-5678" });
    expect(decryptSecret(mocks.upsert.mock.calls[0][0].config.apiKey)).toBe("saved-key-5678");
  });
  it("never saves a rejected model/key, including through the legacy action", async () => {
    mocks.check.mockResolvedValue({ ok: false, error: "Model unavailable" });
    expect((await saveAiSettings(form())).ok).toBe(false); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("never reuses another provider's key", async () => {
    mocks.single.mockResolvedValue({ data: { config: { provider: "openai", apiKey: "saved" } } });
    expect((await connectAiProvider(form("anthropic", ""))).ok).toBe(false); expect(mocks.check).not.toHaveBeenCalled();
  });
  it("rejects non-manager writes and disconnects", async () => {
    mocks.role.mockResolvedValue("leadership");
    expect((await connectAiProvider(form())).ok).toBe(false); expect((await disconnectAiProvider()).ok).toBe(false); expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reports database failures without success", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "Save failed" } });
    expect(await connectAiProvider(form())).toMatchObject({ ok: false, error: "Save failed" }); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("does not save ineffective overrides of server-managed settings", async () => {
    vi.stubEnv("AI_API_KEY", "server-key");
    expect((await connectAiProvider(form())).ok).toBe(false); expect((await disconnectAiProvider()).ok).toBe(false); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("removes the stored key on disconnect and allows a new connection afterwards", async () => {
    expect((await disconnectAiProvider()).ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ status: "not_connected", config: { provider: "openai" } });
    expect((await connectAiProvider(form())).ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
});
