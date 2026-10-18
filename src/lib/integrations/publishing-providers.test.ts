import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
import { DeliveryRejected } from "./delivery-error";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), lookup: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
import { publishToBuffer, getBufferPost, bufferDelivery, connectBufferApiKey } from "./buffer";
import { publishWordPressPost, getWordPressPost, wordPressDelivery, validateWordPressSiteUrl } from "./wordpress";

const config = { siteUrl: "https://site.example", username: "editor", applicationPassword: "test-password" };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); fetchMock.mockReset(); vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-15T09:00:00Z")); vi.stubGlobal("fetch", fetchMock);
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mocks.admin.mockReturnValue(databaseMock(() => ({ data: { id: "connection", config: { accessToken: "test-key" } } })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("provider delivery contracts", () => {
  it("passes Buffer a custom UTC dueAt without claiming a scheduled post is published", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { createPost: { post: { id: "post", status: "scheduled", dueAt: "2026-10-15T10:00:00Z" } } } }));
    expect(await publishToBuffer("org", "channel", "Approved copy", "2026-10-15T10:00:00Z")).toMatchObject({ status: "queued", id: "post" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables.input).toMatchObject({ mode: "customScheduled", dueAt: "2026-10-15T10:00:00Z", schedulingType: "automatic", text: "Approved copy" });
  });
  it("sends an immediate request using shareNow", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { createPost: { post: { id: "post", status: "sending" } } } }));
    expect((await publishToBuffer("org", "channel", "Copy")).status).toBe("queued");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables.input).toMatchObject({ mode: "shareNow" });
  });
  it("checks a Buffer post using its recorded ID and actual sent timestamp", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { post: { id: "post", status: "sent", sentAt: "2026-10-15T10:01:00Z" } } }));
    expect(await getBufferPost("org", "post")).toMatchObject({ status: "published", publishedAt: "2026-10-15T10:01:00Z" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables).toEqual({ input: { id: "post" } });
  });
  it("treats provider errors as failed and unknown statuses conservatively as queued", () => { expect(bufferDelivery({ id: "post", status: "error" }).status).toBe("failed"); expect(bufferDelivery({ id: "post", status: "unknown" }).status).toBe("queued"); expect(() => bufferDelivery()).toThrow(); });
  it("preserves the social channel and public URL only after Buffer confirms delivery", () => {
    expect(bufferDelivery({ id: "post", channelId: "channel", status: "sent", externalLink: "https://www.linkedin.com/feed/update/123", sentAt: "2026-10-18T10:00:00Z" })).toMatchObject({ status: "published", sourceChannelId: "channel", url: "https://www.linkedin.com/feed/update/123" });
    expect(bufferDelivery({ id: "post", status: "sent", externalLink: "javascript:alert(1)" }).url).toBeUndefined();
    expect(bufferDelivery({ id: "post", status: "error", error: { message: "Reconnect this account" } }).error).toBe("Reconnect this account");
  });
  it("does not save an invalid API key or contact Buffer without encryption configured", async () => {
    vi.stubEnv("AI_CONFIG_SECRET", ""); await expect(connectBufferApiKey("org", "key")).rejects.toThrow("AI_CONFIG_SECRET"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("identifies an HTTP authentication rejection as a confirmed failure", async () => { fetchMock.mockResolvedValueOnce(Response.json({ error: "Unauthorized" }, { status: 401 })); await expect(publishToBuffer("org", "channel", "Copy")).rejects.toBeInstanceOf(DeliveryRejected); });
  it("identifies a failed WordPress preflight as an unsent request", async () => { fetchMock.mockRejectedValueOnce(new Error("Timeout")); await expect(publishWordPressPost(config, { title: "Article", body: "Copy", excerpt: "Description", slug: "ril-asset" })).rejects.toBeInstanceOf(DeliveryRejected); expect(fetchMock).toHaveBeenCalledTimes(1); });
  it("verifies an API key with read-only calls and encrypts it before storage", async () => {
    vi.stubEnv("AI_CONFIG_SECRET", "test-encryption-secret");
    const database = databaseMock(() => ({ data: { id: "connection", config: {} } })); mocks.admin.mockReturnValue(database);
    fetchMock.mockResolvedValueOnce(Response.json({ data: { account: { organizations: [{ id: "buffer-org", name: "RIL" }] } } }));
    fetchMock.mockResolvedValueOnce(Response.json({ data: { channels: [{ id: "channel", service: "linkedin" }] } }));
    expect(await connectBufferApiKey("org", "test-personal-key")).toHaveLength(1);
    const write = database.queries.find(q => q.operation === "update")!;
    expect((write.payload as { config: { accessToken: string } }).config.accessToken).toMatch(/^enc:v1:/);
    expect(fetchMock.mock.calls.every(([, init]) => !JSON.parse(init.body).query.includes("mutation"))).toBe(true);
  });
  it("creates a WordPress future post with UTC date_gmt and semantic article content", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json({ id: 123, link: "https://site.example/article", status: "future", date_gmt: "2026-10-15T10:00:00" }));
    expect(await publishWordPressPost(config, { title: "Article", body: "## Heading\n\nSource copy", excerpt: "SEO description", slug: "ril-asset", scheduledFor: "2026-10-15T10:00:00.000Z" })).toMatchObject({ status: "queued", id: 123, scheduledFor: "2026-10-15T10:00:00Z" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ status: "future", date_gmt: "2026-10-15T10:00:00.000", content: "<h2>Heading</h2>\n<p>Source copy</p>", excerpt: "SEO description" });
  });
  it("links an existing scheduled article without creating a duplicate", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ id: 123, link: "https://site.example/article", status: "future", date_gmt: "2026-10-15T10:00:00" }]));
    expect((await publishWordPressPost(config, { title: "Article", body: "Copy", excerpt: "Description", slug: "ril-asset", scheduledFor: "2026-10-15T10:00:00Z" })).status).toBe("queued"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("republishes a withdrawn draft by updating the same WordPress ID", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ id: 123, link: "https://site.example/article", status: "draft" }])).mockResolvedValueOnce(Response.json({ id: 123, link: "https://site.example/article", status: "publish" }));
    expect((await publishWordPressPost(config, { title: "Article", body: "Copy", excerpt: "Description", slug: "ril-asset" })).status).toBe("published"); expect(fetchMock.mock.calls[1][0]).toContain("/posts/123");
  });
  it("reads confirmed publication and detects a withdrawn WordPress post", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: 123, link: "https://site.example/article", status: "publish", date_gmt: "2026-10-15T10:01:00" }));
    expect(await getWordPressPost(config, 123)).toMatchObject({ status: "published", publishedAt: "2026-10-15T10:01:00Z" });
    expect(wordPressDelivery({ id: 123, link: "https://site.example/article", status: "draft" }).status).toBe("failed");
  });
  it("blocks private network destinations before sending credentials", async () => { mocks.lookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]); await expect(getWordPressPost(config, 123)).rejects.toThrow("public network"); expect(fetchMock).not.toHaveBeenCalled(); });
  it.each(["https://renaissance-labs.example", "https://cms.test", "https://cms.localhost", "https://cms.invalid"])("rejects a placeholder address as a publishing site: %s", url => expect(() => validateWordPressSiteUrl(url)).toThrow());
});
