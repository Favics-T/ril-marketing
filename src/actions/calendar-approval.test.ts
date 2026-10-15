import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), org: vi.fn(), role: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/audience/access")>(), getUserRole: mocks.role }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { transitionAsset } from "./content";
function form(to: string, scheduledFor?: string) { const fd = new FormData(); fd.set("to", to); if (scheduledFor) fd.set("scheduled_for", scheduledFor); return fd; }
function setup(overrides: Record<string, unknown> = {}, mutation?: (q: Query) => { data: unknown; error: null }) {
  const database = databaseMock(q => {
    if (q.operation === "select") return { data: q.table === "asset_approvals" ? [{ actor_id: "other-reviewer" }] : { id: "asset", status: "approved", sensitivity: "normal", channel: "website", platform: "website", metadata: {}, updated_at: "version", ...overrides } };
    return mutation?.(q) ?? { data: { id: "asset" }, error: null };
  });
  mocks.client.mockResolvedValue({ ...database, auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) } });
  return database;
}
beforeEach(() => { vi.clearAllMocks(); mocks.org.mockResolvedValue("org"); mocks.role.mockResolvedValue("owner"); });
describe("calendar and approval gates", () => {
  it("reserves a future UTC slot with version and organization guards", async () => { const database = setup(); const date = new Date(Date.now() + 86400000).toISOString(); expect((await transitionAsset("asset", form("scheduled", date))).ok).toBe(true); expect(database.queries.find(q => q.operation === "update")?.payload).toMatchObject({ status: "scheduled", scheduled_for: date }); });
  it.each(["invalid", "2020-01-01T10:00:00Z", "2026-10-15T10:00"])("rejects invalid or ambiguous scheduling: %s", async date => { const database = setup(); expect((await transitionAsset("asset", form("scheduled", date))).ok).toBe(false); expect(database.queries.some(q => q.operation === "update")).toBe(false); });
  it("requires a reviewer for scheduling", async () => { setup(); mocks.role.mockResolvedValueOnce("member"); expect((await transitionAsset("asset", form("scheduled", new Date(Date.now() + 86400000).toISOString()))).ok).toBe(false); });
  it("blocks bypassing a provider-owned scheduled request", async () => { const database = setup({ status: "scheduled", metadata: { publishing: { provider: "buffer" } } }); expect((await transitionAsset("asset", form("approved"))).ok).toBe(false); expect(database.queries.some(q => q.operation === "update")).toBe(false); });
  it("requires a second named approver for high-sensitivity review", async () => { setup({ status: "review", sensitivity: "high" }); expect((await transitionAsset("asset", form("approved"))).ok).toBe(true); });
  it("does not report success for a stale asset version", async () => { setup({}, () => ({ data: null, error: null })); expect((await transitionAsset("asset", form("editing"))).ok).toBe(false); });
  it("clears a calendar reservation when returning to approved", async () => { const database = setup({ status: "scheduled" }); expect((await transitionAsset("asset", form("approved"))).ok).toBe(true); expect(database.queries.find(q => q.operation === "update")?.payload).toMatchObject({ scheduled_for: null }); });
  it("allows manual calendar planning after a confirmed provider failure", async () => { setup({ status: "scheduled", metadata: { publishing: { provider: "buffer", state: "failed" } } }); expect((await transitionAsset("asset", form("approved"))).ok).toBe(true); });
});
