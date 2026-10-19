import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { articleSeo, listWebsiteArticles, listWebsiteDeliveryIssues } from "./website-publishing";

beforeEach(() => vi.clearAllMocks());

describe("website publishing lists", () => {
  it("scopes article search, status, campaign and pagination to the caller workspace", async () => {
    const database = databaseMock(() => ({ data: [{ id: "article" }], count: 24 }));
    mocks.client.mockResolvedValue(database);
    const campaign = "11111111-1111-4111-8111-111111111111";
    expect(await listWebsiteArticles("workspace", { stage: "published", q: "Founder, launch)%", campaign, page: "2" })).toMatchObject({ total: 24, page: 2, stage: "published" });
    expect(database.queries[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "workspace" },
      { method: "or", column: "channel.eq.website,format.eq.blog", value: undefined },
      { method: "in", column: "status", value: ["published", "analysing"] },
      { method: "eq", column: "campaign_id", value: campaign },
      { method: "range", column: 10, value: 19 },
      { method: "or", column: "title.ilike.%Founder%,body.ilike.%Founder%", value: undefined },
    ]));
    expect(JSON.stringify(database.queries[0].filters)).not.toContain("launch)%");
  });

  it("rejects injected filters and reports database failure without private diagnostics", async () => {
    const database = databaseMock(() => ({ data: [], count: 0 }));
    mocks.client.mockResolvedValue(database);
    expect(await listWebsiteArticles("workspace", { stage: "review),id.neq.null", campaign: "bad", page: "-1" })).toMatchObject({ stage: "all", page: 1 });
    expect(JSON.stringify(database.queries)).not.toContain("id.neq.null");
    mocks.client.mockResolvedValue(databaseMock(() => ({ error: { message: "private database diagnostic" } })));
    await expect(listWebsiteArticles("workspace")).rejects.toThrow("Articles could not be loaded");
  });

  it("shows current CMS failures and overdue deliveries, excluding superseded failures and on-time schedules", async () => {
    const past = "2000-01-01T10:00:00Z";
    const rows = [
      { id: "old", status: "failed", asset: { metadata: { publishing: { publication_id: "new" } } } },
      { id: "failed", status: "failed", asset: { metadata: null } },
      { id: "missed", status: "missed", asset: { metadata: null } },
      { id: "pending", status: "scheduled", scheduled_for: past, asset: { metadata: null } },
      { id: "future", status: "scheduled", scheduled_for: "2099-01-01T00:00:00Z", asset: { metadata: null } },
      { id: "uncertain", status: "queued", error: "Receipt unavailable", asset: { metadata: null } },
    ];
    const database = databaseMock(() => ({ data: rows }));
    mocks.client.mockResolvedValue(database);
    const campaign = "11111111-1111-4111-8111-111111111111";
    expect((await listWebsiteDeliveryIssues("workspace", campaign)).map(row => row.id)).toEqual(["failed", "missed", "pending", "uncertain"]);
    expect(database.queries[0].columns).toContain("content_assets!inner");
    expect(database.queries[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "workspace" },
      { method: "in", column: "channel", value: ["wordpress", "strapi"] },
      { method: "eq", column: "asset.campaign_id", value: campaign },
    ]));
  });

  it("does not treat unavailable delivery data as a clear queue", async () => {
    mocks.client.mockResolvedValue(databaseMock(() => ({ error: { message: "private" } })));
    await expect(listWebsiteDeliveryIssues("workspace")).rejects.toThrow("Delivery issues could not be loaded");
  });

  it("handles incomplete or malformed SEO metadata without rendering objects", () => {
    expect(articleSeo({ seo: { title: "Article title", description: "Search summary" } })).toEqual({ title: "Article title", description: "Search summary" });
    expect(articleSeo({ seo: { title: {}, description: ["bad"] } })).toEqual({ title: "", description: "" });
    expect(articleSeo({ seo: null })).toEqual({ title: "", description: "" });
  });
});
