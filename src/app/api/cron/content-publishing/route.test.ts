import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ process: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/jobs/content-publishing", () => ({ processContentPublishingBatch: mocks.process }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { GET } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("publishing status worker authorization", () => {
  it("rejects missing configuration without touching providers", async () => { vi.stubEnv("CRON_SECRET", ""); expect((await GET(new Request("https://app.example/api/cron/content-publishing"))).status).toBe(503); expect(mocks.process).not.toHaveBeenCalled(); });
  it("rejects an unauthorized caller", async () => { vi.stubEnv("CRON_SECRET", "test-secret"); expect((await GET(new Request("https://app.example/api/cron/content-publishing"))).status).toBe(401); expect(mocks.process).not.toHaveBeenCalled(); });
  it("runs the protected worker and refreshes content pages", async () => { vi.stubEnv("CRON_SECRET", "test-secret"); mocks.process.mockResolvedValue({ checked: 2, failed: 0 }); const response = await GET(new Request("https://app.example/api/cron/content-publishing", { headers: { authorization: "Bearer test-secret" } })); expect(await response.json()).toEqual({ ok: true, checked: 2, failed: 0 }); expect(mocks.revalidate).toHaveBeenCalledWith("/library/[id]", "page"); });
});
