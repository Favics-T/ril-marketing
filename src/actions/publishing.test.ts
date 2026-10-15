import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), org: vi.fn(), reviewer: vi.fn(), role: vi.fn(), connect: vi.fn(), channels: vi.fn(), buffer: vi.fn(), wordpress: vi.fn(), wpConfig: vi.fn(), revalidate: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", () => ({ requireReviewer: mocks.reviewer, getUserRole: mocks.role }));
vi.mock("@/lib/integrations/buffer", () => ({ getBufferChannels: mocks.channels, publishToBuffer: mocks.buffer, getBufferPost: mocks.status, disconnectBuffer: vi.fn(), connectBufferApiKey: mocks.connect }));
vi.mock("@/lib/integrations/wordpress", () => ({ getWordPressConfig: mocks.wpConfig, publishWordPressPost: mocks.wordpress, getWordPressPost: mocks.status, validateWordPressSiteUrl: vi.fn(), verifyWordPressConnection: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { publishAssetViaBuffer, refreshPublicationStatus, recoverPublishingRequest, saveBufferApiKey } from "./integrations";
import { publishApprovedBlog, scheduleApprovedBlog } from "./wordpress";

const channel = { id: "channel", name: "RIL", service: "linkedin", isLocked: false, isDisconnected: false, isQueuePaused: false };
function setup(overrides: Record<string, unknown> = {}, fail?: (query: Query) => boolean) {
  let asset: Record<string, unknown> = { id: "asset", title: "Approved article", body: "Approved source copy", channel: "linkedin", platform: "linkedin", format: "social post", status: "approved", metadata: { source: "activity" }, updated_at: "2026-10-14T12:00:00Z", ...overrides };
  let publication: Record<string, unknown> | null = null;
  const database = databaseMock(query => {
    if (fail?.(query)) return { data: null, error: { message: "Database unavailable" } };
    if (query.table === "content_assets" && query.operation === "select") return { data: asset };
    if (query.table === "content_assets" && query.operation === "update") { asset = { ...asset, ...query.payload }; return { data: { id: "asset" } }; }
    if (query.table === "publications" && query.operation === "insert") publication = query.payload as Record<string, unknown>;
    if (query.table === "publications" && query.operation === "update") publication = { ...publication, ...query.payload };
    if (query.table === "publications" && query.operation === "select") return { data: publication };
    return { data: { id: "saved" }, error: null };
  });
  mocks.client.mockResolvedValue({ ...database, auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) } });
  mocks.admin.mockReturnValue(database);
  return { database, asset: () => asset, publication: () => publication };
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.org.mockResolvedValue("org"); mocks.reviewer.mockResolvedValue("owner"); mocks.role.mockResolvedValue("owner"); mocks.channels.mockResolvedValue([channel]); mocks.wpConfig.mockResolvedValue({ siteUrl: "https://site.example" });
  mocks.buffer.mockResolvedValue({ id: "buffer-post", status: "queued", scheduledFor: "2026-10-15T09:00:00Z" });
  mocks.wordpress.mockResolvedValue({ id: "123", status: "queued", url: "https://site.example/article", scheduledFor: "2026-10-15T09:00:00Z" });
});

describe("approved publishing workflows", () => {
  it.each(["member", "leadership"])("does not let a %s replace publishing credentials", async role => { mocks.role.mockResolvedValueOnce(role); const fd = new FormData(); fd.set("api_key", "test-buffer-key"); expect((await saveBufferApiKey(fd)).ok).toBe(false); expect(mocks.connect).not.toHaveBeenCalled(); });
  it("records Buffer acceptance as scheduled, with a durable receipt and workspace/version guards", async () => {
    const state = setup(); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(true);
    expect(state.asset()).toMatchObject({ status: "scheduled", published_at: null });
    expect(state.publication()).toMatchObject({ status: "queued", external_id: "buffer-post" });
    const claim = state.database.queries.find(q => q.table === "content_assets" && q.operation === "update")!;
    expect(claim.filters).toEqual(expect.arrayContaining([{ method: "eq", column: "organization_id", value: "org" }, { method: "eq", column: "status", value: "approved" }, { method: "eq", column: "updated_at", value: "2026-10-14T12:00:00Z" }]));
  });
  it("blocks a repeated submission once the first is queued", async () => { setup(); await publishAssetViaBuffer("asset", "channel"); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(mocks.buffer).toHaveBeenCalledTimes(1); });
  it.each(["editing", "review", "published", "scheduled"])("blocks status %s before calling a provider", async status => { setup({ status }); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(mocks.buffer).not.toHaveBeenCalled(); });
  it("blocks an unauthorized caller", async () => { const state = setup(); mocks.reviewer.mockRejectedValueOnce(new Error("Reviewer required")); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(state.database.queries).toHaveLength(0); expect(mocks.buffer).not.toHaveBeenCalled(); });
  it.each([{ id: "foreign" }, { isDisconnected: true }, { isQueuePaused: true }, { isLocked: true }, { service: "instagram" }, { service: "x" }])("rejects foreign, unavailable, media-only and mismatched channels: %j", async override => { setup(); mocks.channels.mockResolvedValue([{ ...channel, ...override }]); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(mocks.buffer).not.toHaveBeenCalled(); });
  it("does not send empty copy or a short-form script as a text post", async () => { for (const override of [{ body: " " }, { format: "short-form video" }]) { setup(override); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); } expect(mocks.buffer).not.toHaveBeenCalled(); });
  it("does not call providers when the asset cannot be claimed or the receipt table is unavailable", async () => {
    for (const fail of [(q: Query) => q.table === "content_assets" && q.operation === "update", (q: Query) => q.table === "publications" && q.operation === "insert"]) { setup({}, fail); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); }
    expect(mocks.buffer).not.toHaveBeenCalled();
  });
  it("keeps an uncertain network result locked and never automatically resends", async () => { const state = setup(); mocks.buffer.mockRejectedValueOnce(new Error("Timeout")); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(state.asset().status).toBe("scheduled"); expect(state.publication()).toMatchObject({ status: "queued", error: expect.stringContaining("not confirmed") }); await publishAssetViaBuffer("asset", "channel"); expect(mocks.buffer).toHaveBeenCalledTimes(1); });
  it("returns a confirmed provider rejection to approved without claiming publication", async () => { const state = setup(); mocks.buffer.mockRejectedValueOnce(new DeliveryRejected("Post too long")); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(state.asset().status).toBe("approved"); expect(state.publication()?.status).toBe("failed"); });
  it("marks an accepted post published only after a subsequent sent confirmation", async () => { const state = setup(); await publishAssetViaBuffer("asset", "channel"); mocks.status.mockResolvedValueOnce({ id: "buffer-post", status: "published", publishedAt: "2026-10-15T09:01:00Z" }); expect((await refreshPublicationStatus("asset")).ok).toBe(true); expect(state.asset()).toMatchObject({ status: "published", published_at: "2026-10-15T09:01:00Z" }); expect(state.publication()?.status).toBe("published"); expect(mocks.buffer).toHaveBeenCalledTimes(1); });
  it("supports WordPress scheduling with an explicit UTC time", async () => { const state = setup({ format: "blog", channel: "website", platform: "website" }); const date = new Date(Date.now() + 86400000).toISOString(); expect((await scheduleApprovedBlog("asset", date)).ok).toBe(true); expect(mocks.wordpress).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scheduledFor: date, slug: "ril-asset" })); expect(state.asset().status).toBe("scheduled"); });
  it("confirms immediate WordPress publication and preserves the live URL", async () => { const state = setup({ format: "blog", channel: "website" }); mocks.wordpress.mockResolvedValueOnce({ id: "123", status: "published", url: "https://site.example/article", publishedAt: "2026-10-14T12:01:00Z" }); expect((await publishApprovedBlog("asset")).ok).toBe(true); expect(state.asset()).toMatchObject({ status: "published", metadata: { published_url: "https://site.example/article", source: "activity" } }); });
  it("rejects a past WordPress schedule before creating a request", async () => { const state = setup(); expect((await scheduleApprovedBlog("asset", "2020-01-01T10:00:00Z")).ok).toBe(false); expect(state.database.queries).toHaveLength(0); expect(mocks.wordpress).not.toHaveBeenCalled(); });
  it("handles a provider receipt write failure without a second external submission", async () => { setup({}, q => q.table === "publications" && q.operation === "update"); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); expect(mocks.buffer).toHaveBeenCalledTimes(1); });
  it("recovers a timeout receipt only after verifying the approved post copy", async () => {
    const state = setup(); mocks.buffer.mockRejectedValueOnce(new Error("Timeout")); await publishAssetViaBuffer("asset", "channel");
    const fd = new FormData(); fd.set("external_id", "recovered-post");
    mocks.status.mockResolvedValueOnce({ id: "recovered-post", status: "published", sourceText: "Different post copy" });
    expect((await recoverPublishingRequest("asset", fd)).ok).toBe(false); expect(state.asset().status).toBe("scheduled");
    mocks.status.mockResolvedValueOnce({ id: "recovered-post", status: "published", sourceText: "Approved source copy", publishedAt: "2026-10-15T10:00:00Z" });
    expect((await recoverPublishingRequest("asset", fd)).ok).toBe(true); expect(state.asset().status).toBe("published"); expect(mocks.buffer).toHaveBeenCalledTimes(1);
  });
  it("keeps failures reviewable when the provider rejects a post and the database also fails", async () => { setup({}, q => q.table === "publications" && q.operation === "update"); mocks.buffer.mockRejectedValueOnce(new DeliveryRejected("Post rejected")); expect((await publishAssetViaBuffer("asset", "channel")).ok).toBe(false); });
});
