import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn(), organization: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.organization }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { recordManualPost } from "./manual-posting";
import { isSocialAsset, parseLivePostUrl } from "@/lib/content/manual-posting";

function form(url = "https://www.linkedin.com/feed/update/urn:li:activity:123") {
  const data = new FormData(); data.set("live_url", url); data.set("confirm_posted", "on"); return data;
}
function setup(overrides: Record<string, unknown> = {}, mutation?: (query: Query) => QueryResult) {
  const database = databaseMock(query => {
    if (query.operation === "select") return { data: { id: "asset", status: "approved", channel: "linkedin", platform: null, body: "Approved post copy", metadata: { source_activity_id: "source" }, updated_at: "2026-10-07T10:00:00Z", ...overrides }, error: null };
    return mutation?.(query) ?? { data: { id: "asset" }, error: null };
  });
  mocks.client.mockResolvedValue({ ...database, auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) } });
  return database;
}
beforeEach(() => { vi.clearAllMocks(); mocks.organization.mockResolvedValue("org"); });

describe("manual social posting", () => {
  it("saves status, link, recorder and timestamp together, scoped to the workspace and version", async () => {
    const database = setup();
    expect((await recordManualPost("asset", form())).ok).toBe(true);
    const update = database.queries.find(q => q.operation === "update")!;
    expect(update.filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "org" }, { method: "eq", column: "status", value: "approved" }, { method: "eq", column: "updated_at", value: "2026-10-07T10:00:00Z" },
    ]));
    expect(update.payload).toMatchObject({ status: "published", metadata: { source_activity_id: "source", manual_post: { recorded_by: "actor", url: "https://www.linkedin.com/feed/update/urn:li:activity:123", from_status: "approved" } } });
    expect(database.queries.find(q => q.table === "asset_approvals")?.payload).toMatchObject({ actor_id: "actor", to_status: "published" });
  });
  it.each(["editing", "review", "published"])("blocks unapproved or already published status %s", async status => {
    const database = setup({ status }); expect((await recordManualPost("asset", form())).ok).toBe(false);
    expect(database.queries.some(q => q.operation === "update")).toBe(false);
  });
  it("allows scheduled content without an external publishing connection", async () => { setup({ status: "scheduled" }); expect((await recordManualPost("asset", form())).ok).toBe(true); });
  it("does not overwrite a pending provider request with a manual post record", async () => { const database = setup({ status: "scheduled", metadata: { publishing: { provider: "buffer", publication_id: "request" } } }); expect((await recordManualPost("asset", form())).ok).toBe(false); expect(database.queries.some(q => q.operation === "update")).toBe(false); });
  it("requires the user to confirm the post is live", async () => { const database = setup(); const data = form(); data.delete("confirm_posted"); expect((await recordManualPost("asset", data)).ok).toBe(false); expect(database.queries).toHaveLength(0); });
  it("does not mark content posted after a write failure or stale version", async () => {
    for (const result of [{ data: null, error: { message: "Unavailable" } }, { data: null, error: null }]) {
      const database = setup({}, () => result); expect((await recordManualPost("asset", form())).ok).toBe(false);
      expect(database.queries.some(q => q.table === "asset_approvals")).toBe(false);
    }
  });
  it("reports an audit failure honestly after the atomic post record succeeds", async () => {
    setup({}, q => q.table === "asset_approvals" ? { error: { message: "Unavailable" } } : { data: { id: "asset" } });
    expect(await recordManualPost("asset", form())).toMatchObject({ ok: true, warning: expect.any(String) });
  });
  it("blocks non-social assets and empty copy", async () => {
    for (const override of [{ channel: "email" }, { body: " " }]) { const database = setup(override); expect((await recordManualPost("asset", form())).ok).toBe(false); expect(database.queries.some(q => q.operation === "update")).toBe(false); }
  });
  it.each(["javascript:alert(1)", "http://social.example/post/1", "https://user:password@social.example/post/1", "https://localhost/post/1", "https://127.0.0.1/post/1", "https://social.example/"])("rejects invalid live links: %s", url => { expect(parseLivePostUrl(url)).toBeNull(); });
  it("recognizes social channel aliases", () => { expect(isSocialAsset(null, "Instagram")).toBe(true); expect(isSocialAsset("twitter", null)).toBe(true); expect(isSocialAsset("website", null)).toBe(false); });
});
