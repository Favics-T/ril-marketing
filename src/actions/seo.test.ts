import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), org: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/brand/knowledge", () => ({ getBrandGuidance: async () => [] }));
vi.mock("@/lib/ai/provider", () => ({ completeWithConfiguredProvider: mocks.complete }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { analyzeSeoAsset, applySeoMetadata } from "./seo";

const id = "00000000-0000-4000-8000-000000000001";
function setup(status = "editing", stale = false) {
  let asset = { id, title: "Founders learning together", body: "Founders share practical lessons from building businesses in Port Harcourt.", topic: "founders", cta: null, format: "blog", channel: "website", status, updated_at: "version", metadata: {} };
  const database = databaseMock(q => {
    if (q.operation === "select") return { data: q.table === "landing_pages" ? [] : asset };
    if (q.operation === "update" && !stale) { asset = { ...asset, ...q.payload }; return { data: { id } }; }
    return { data: null };
  });
  mocks.client.mockResolvedValue(database); mocks.admin.mockReturnValue(database); return database;
}
beforeEach(() => { vi.clearAllMocks(); mocks.org.mockResolvedValue("org"); mocks.complete.mockResolvedValue(null); });
describe("website SEO preparation", () => {
  it("works before connecting AI, with grounded local suggestions that can be applied", async () => {
    const database = setup(); expect(await analyzeSeoAsset(id, null, new FormData())).toMatchObject({ ok: true, audit: { model: "local-content-checks", focusKeywords: expect.arrayContaining(["founders"]) } });
    expect((await applySeoMetadata(id, null, new FormData())).ok).toBe(true);
    expect(database.queries.filter(q => q.operation === "update").every(q => q.filters.some(f => f.column === "updated_at" && f.value === "version"))).toBe(true);
  });
  it.each(["review", "approved", "scheduled", "published"])("does not modify reviewed or provider-owned status %s", async status => { const database = setup(status); expect((await analyzeSeoAsset(id, null, new FormData())).ok).toBe(false); expect((await applySeoMetadata(id, null, new FormData())).ok).toBe(false); expect(database.queries.some(q => q.operation === "update")).toBe(false); });
  it("rejects a stale generated audit instead of overwriting newer copy or approval metadata", async () => { setup("editing", true); expect((await analyzeSeoAsset(id, null, new FormData())).ok).toBe(false); });
  it("does not silently substitute content when a configured AI provider fails", async () => { const database = setup(); mocks.complete.mockRejectedValueOnce(new Error("Provider unavailable")); expect((await analyzeSeoAsset(id, null, new FormData())).ok).toBe(false); expect(database.queries.some(q => q.operation === "update")).toBe(false); });
});
