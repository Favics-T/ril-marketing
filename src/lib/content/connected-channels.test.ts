import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { channelsFromConnections, getConnectedChannelOptions } from "./connected-channels";
beforeEach(() => vi.resetAllMocks());
describe("connector-driven content channels", () => {
  it("normalizes provider aliases, deduplicates accounts, and excludes unavailable accounts", () => {
    expect(channelsFromConnections([{ key: "buffer", status: "connected", config: { accessToken: "private", channels: [
      { id: "one", service: "twitter" }, { id: "two", service: "x" }, { id: "three", service: "instagram", isDisconnected: true },
      { id: "four", service: "linkedin", isLocked: true }, { id: "five", service: "threads", isQueuePaused: true },
      { id: "six", service: "unknown-service" }, null, { service: "facebook" },
    ] } }])).toEqual([["x", "X"], ["threads", "Threads"]]);
  });
  it("includes website and email only when the corresponding providers are connected", () => {
    expect(channelsFromConnections([
      { key: "cms_wordpress", status: "connected", config: {} }, { key: "cms_strapi", status: "connected", config: {} },
      { key: "email_resend", status: "connected", config: {} }, { key: "google_analytics", status: "connected", config: {} },
      { key: "buffer", status: "error", config: { channels: [{ id: "one", service: "instagram" }] } },
    ])).toEqual([["website", "Website / blog"], ["email", "Email / newsletter"]]);
    expect(channelsFromConnections([])).toEqual([]);
  });
  it("scopes connector reads to the caller workspace and returns no configuration secrets", async () => {
    const database = databaseMock(() => ({ data: [{ key: "buffer", status: "connected", config: { accessToken: "private-key", channels: [{ id: "one", service: "linkedin" }] } }] }));
    mocks.client.mockResolvedValue(database);
    const result = await getConnectedChannelOptions("workspace");
    expect(result).toEqual([["linkedin", "LinkedIn"]]);
    expect(JSON.stringify(result)).not.toContain("private-key");
    expect(database.queries[0].filters).toContainEqual({ method: "eq", column: "organization_id", value: "workspace" });
  });
  it("shows a connection-loading error instead of substituting a static channel list", async () => {
    mocks.client.mockResolvedValue(databaseMock(() => ({ error: { message: "Unavailable" } })));
    await expect(getConnectedChannelOptions("workspace")).rejects.toThrow("Could not load connected channels");
  });
});
