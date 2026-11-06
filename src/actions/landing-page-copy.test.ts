import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), brand: vi.fn(), complete: vi.fn(), reviewer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: async () => "workspace" }));
vi.mock("@/lib/audience/access", () => ({ requireReviewer: mocks.reviewer }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/brand/knowledge", () => ({ getBrandGuidance: mocks.brand }));
vi.mock("@/lib/ai/provider", () => ({ completeWithConfiguredProvider: mocks.complete }));
import { applyLandingPageCopy, suggestLandingPageCopy } from "./landing-page-copy";

const id = "0ae379a3-9723-4780-869a-51dbee4dc256";
const variations = [1, 2, 3].map(n => ({ headline: `Meet your peers ${n}`, description: "A programme for founders.", cta_label: "Register interest" }));
function setup(patch: Record<string, unknown> = {}, conflict = false) {
  const page = { id, headline: "Meet your peers", body: "Programme facts", cta_label: "Register", status: "draft", updated_at: "v1", metadata: { automation: { preserved: true }, builder: { description: "For founders" } }, ...patch };
  const db = databaseMock(q => q.operation === "select" ? { data: page } : { data: conflict ? null : { id } });
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: { id: "editor" } } }) } });
  mocks.admin.mockReturnValue(databaseMock(() => ({ data: null })));
  return db;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.reviewer.mockResolvedValue("marketing_manager");
  mocks.brand.mockResolvedValue(["Brand voice: Clear and direct"]);
  mocks.complete.mockResolvedValue({ model: "test-model", text: JSON.stringify({ variations }) });
});
describe("brand-grounded landing page suggestions", () => {
  it("uses only public draft fields and brand guidance, preserving existing metadata", async () => {
    const db = setup({ secret: "never send this", title: "Internal budget discussion", metadata: { automation: { preserved: true }, private_contact: "private@example.com" } });
    expect((await suggestLandingPageCopy(id, "v1")).ok).toBe(true);
    const prompt = mocks.complete.mock.calls[0][2];
    expect(prompt).toContain("Programme facts");
    expect(prompt).toContain("Clear and direct");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).not.toContain("Internal budget");
    expect(db.queries.find(q => q.operation === "update")?.payload).toMatchObject({ metadata: { automation: { preserved: true }, copy_suggestions: { model: "test-model" } } });
    expect(db.queries.every(q => q.table !== "leads")).toBe(true);
  });
  it("requires brand knowledge and a configured provider without changing the draft", async () => {
    const db = setup(); mocks.brand.mockResolvedValue([]);
    expect((await suggestLandingPageCopy(id, "v1")).error).toMatch(/Brand Knowledge/);
    expect(mocks.complete).not.toHaveBeenCalled();
    mocks.brand.mockResolvedValue(["Voice: clear"]); mocks.complete.mockResolvedValue(null);
    expect((await suggestLandingPageCopy(id, "v1")).error).toMatch(/Connect an AI provider/);
    expect(db.queries.some(q => q.operation === "update")).toBe(false);
  });
  it("does not save malformed output or overwrite a concurrent edit", async () => {
    const db = setup(); mocks.complete.mockResolvedValue({ model: "test", text: "bad response" });
    expect((await suggestLandingPageCopy(id, "v1")).ok).toBe(false);
    expect(db.queries.some(q => q.operation === "update")).toBe(false);
    setup({}, true); mocks.complete.mockResolvedValue({ model: "test", text: JSON.stringify({ variations }) });
    expect((await suggestLandingPageCopy(id, "v1")).error).toMatch(/changed/);
  });
  it("applies only a saved variation to a matching private draft and labels provenance", async () => {
    const db = setup({ metadata: { automation: "keep", copy_suggestions: { variations, model: "test", generatedAt: "now", brandSources: ["Voice"] } } });
    expect((await applyLandingPageCopy(id, 1, "v1")).ok).toBe(true);
    const write = db.queries.find(q => q.operation === "update")!;
    expect(write.payload).toMatchObject({ headline: variations[1].headline, metadata: { automation: "keep", ai_copy: { model: "test", variation: 1 }, last_edited_by: "editor" } });
    expect(write.filters).toContainEqual({ method: "eq", column: "status", value: "draft" });
    expect(write.filters).toContainEqual({ method: "eq", column: "organization_id", value: "workspace" });
    expect(write.filters).toContainEqual({ method: "eq", column: "updated_at", value: "v1" });
  });
  it.each([{ status: "published" }, { updated_at: "v2" }])("refuses stale or non-draft copy changes %o", async patch => {
    const db = setup(patch);
    expect((await applyLandingPageCopy(id, 0, "v1")).ok).toBe(false);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(db.queries.some(q => q.operation === "update")).toBe(false);
  });
  it("rejects callers without reviewer access before querying or generating", async () => {
    setup(); mocks.reviewer.mockRejectedValue(new Error("Forbidden"));
    expect((await suggestLandingPageCopy(id, "v1")).ok).toBe(false);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
