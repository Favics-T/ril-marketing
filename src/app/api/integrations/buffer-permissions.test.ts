import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ role: vi.fn(), stage: vi.fn(), finish: vi.fn() }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role }));
vi.mock("@/lib/supabase/organization", () => ({ getCallerOrganizationId: async () => "org" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) } }) }));
vi.mock("@/lib/integrations/buffer", () => ({ bufferEnv: () => ({ clientId: "test-client" }), stageBufferHandshake: mocks.stage, finishBufferHandshake: mocks.finish }));
vi.mock("@/lib/integrations/oauth", () => ({ getOAuthProvider: () => ({ id: "buffer" }), buildAuthorizeUrl: () => "https://buffer.example/authorize" }));
import { GET as connect } from "./[key]/connect/route";
import { GET as callback } from "./[key]/callback/route";
beforeEach(() => { vi.clearAllMocks(); });
describe("Buffer OAuth connection permissions", () => {
  it.each(["member", "leadership"])("blocks a %s from staging or replacing publishing credentials", async role => {
    mocks.role.mockResolvedValue(role); const context = { params: Promise.resolve({ key: "buffer" }) };
    expect((await connect(new Request("https://app.example/api/integrations/buffer/connect"), context)).status).toBe(403);
    const response = await callback(new Request("https://app.example/api/integrations/buffer/callback?code=test-code&state=test-state"), context);
    expect(response.headers.get("location")).toContain("connect_error"); expect(mocks.stage).not.toHaveBeenCalled(); expect(mocks.finish).not.toHaveBeenCalled();
  });
  it("allows an owner to finish the already authorized handshake", async () => {
    mocks.role.mockResolvedValue("owner"); const response = await callback(new Request("https://app.example/api/integrations/buffer/callback?code=test-code&state=test-state"), { params: Promise.resolve({ key: "buffer" }) });
    expect(response.headers.get("location")).toContain("connected=buffer"); expect(mocks.finish).toHaveBeenCalledWith("org", "test-state", "test-code", "https://app.example/api/integrations/buffer/callback");
  });
});
