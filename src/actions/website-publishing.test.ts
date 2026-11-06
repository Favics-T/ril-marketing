import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";

const mocks = vi.hoisted(() => ({ client: vi.fn(), org: vi.fn(), role: vi.fn(), reviewer: vi.fn(), wp: vi.fn(), wpTest: vi.fn(), strapi: vi.fn(), strapiTest: vi.fn(), sync: vi.fn(), revalidate: vi.fn(), claim: vi.fn(), save: vi.fn(), uncertain: vi.fn(), strapiPublish: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: mocks.role, requireReviewer: mocks.reviewer }));
vi.mock("@/lib/integrations/wordpress", () => ({ getWordPressConfig: mocks.wp }));
vi.mock("@/lib/integrations/wordpress-diagnostics", () => ({ runWordPressConnectionTest: mocks.wpTest }));
vi.mock("@/lib/integrations/strapi", () => ({ getStrapiConfig: mocks.strapi, verifyStrapiConnection: mocks.strapiTest, publishStrapiEntry: mocks.strapiPublish, sanitizeCollection: vi.fn(), validateStrapiUrl: vi.fn() }));
vi.mock("@/lib/content/publishing", () => ({ syncPublication: mocks.sync, claimPublication: mocks.claim, saveDelivery: mocks.save, noteUncertainDelivery: mocks.uncertain }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { checkWebsiteDeliveries, saveWebsiteSeo, testWebsiteConnection } from "./website-publishing";
import { publishApprovedToStrapi } from "./strapi";

const assetId = "11111111-1111-4111-8111-111111111111";
const expected = "2026-10-19T10:00:00Z";
const baseAsset = { id: assetId, title: "Approved article", body: "Source copy", channel: "website", platform: "website", format: "blog", status: "editing", updated_at: expected, metadata: { source: "activity", seo: { title: "Previous title", keywords: ["founders"], internalLinks: ["/programmes"], audit: { old: true } } } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.org.mockResolvedValue("workspace"); mocks.role.mockResolvedValue("owner"); mocks.reviewer.mockResolvedValue("owner");
  mocks.wp.mockResolvedValue(null); mocks.strapi.mockResolvedValue(null); mocks.sync.mockResolvedValue("Checked");
  mocks.claim.mockResolvedValue("publication"); mocks.save.mockResolvedValue(undefined); mocks.uncertain.mockResolvedValue(undefined);
});

function form() {
  const data = new FormData(); data.set("expected_updated_at", expected); data.set("seo_title", "Updated search title"); data.set("seo_description", "Updated search description"); return data;
}

describe("website publishing actions", () => {
  it("does not let ordinary members use saved publishing credentials for connection tests", async () => {
    mocks.role.mockResolvedValue("member");
    expect(await testWebsiteConnection("wordpress")).toMatchObject({ ok: false });
    expect(mocks.wp).not.toHaveBeenCalled(); expect(mocks.wpTest).not.toHaveBeenCalled();
  });

  it("checks a saved WordPress connection without returning its secret", async () => {
    mocks.wp.mockResolvedValue({ siteUrl: "https://site.example", username: "editor", applicationPassword: "test-credential" });
    mocks.wpTest.mockResolvedValue({ ok: true, checks: [{ label: "Login", status: "pass", detail: "Verified" }] });
    const result = await testWebsiteConnection("wordpress");
    expect(result.ok).toBe(true); expect(JSON.stringify(result)).not.toContain("test-credential");
    expect(mocks.wpTest).toHaveBeenCalledWith(expect.objectContaining({ seoPlugin: "none" }));
    expect(mocks.wp).toHaveBeenCalledWith("workspace");
  });

  it("handles absent connections and distinguishes read access from Strapi create permission", async () => {
    expect(await testWebsiteConnection("strapi")).toMatchObject({ ok: false, error: expect.stringContaining("Connect Strapi") });
    mocks.strapi.mockResolvedValue({ apiToken: "test-token" });
    expect(await testWebsiteConnection("strapi")).toMatchObject({ ok: true, message: expect.stringContaining("Create permission is checked when you publish") });
    expect(mocks.strapiPublish).not.toHaveBeenCalled();
    expect(await testWebsiteConnection("other")).toMatchObject({ ok: false });
  });

  it("changes only search metadata and preserves copy, channel, approvals and other metadata", async () => {
    const database = databaseMock(query => ({ data: query.operation === "update" ? { id: assetId } : baseAsset }));
    mocks.client.mockResolvedValue(database);
    expect(await saveWebsiteSeo(assetId, null, form())).toMatchObject({ ok: true });
    const query = database.queries.find(query => query.operation === "update")!;
    expect(Object.keys(query.payload!)).toEqual(["metadata"]);
    expect(query.payload).toMatchObject({ metadata: { source: "activity", seo: { title: "Updated search title", description: "Updated search description", keywords: ["founders"], internalLinks: ["/programmes"], audit: null } } });
    expect(query.filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "workspace" },
      { method: "eq", column: "status", value: "editing" },
      { method: "eq", column: "updated_at", value: expected },
    ]));
  });

  it.each(["review", "approved", "scheduled", "published"])("cannot edit SEO on a %s article", async status => {
    const database = databaseMock(() => ({ data: { ...baseAsset, status } })); mocks.client.mockResolvedValue(database);
    expect(await saveWebsiteSeo(assetId, null, form())).toMatchObject({ ok: false, error: expect.stringContaining("Editing") });
    expect(database.queries.some(query => query.operation === "update")).toBe(false);
  });

  it("rejects stale writes, foreign/missing assets and oversized metadata", async () => {
    const database = databaseMock(query => ({ data: query.operation === "update" ? null : baseAsset })); mocks.client.mockResolvedValue(database);
    expect(await saveWebsiteSeo(assetId, null, form())).toMatchObject({ ok: false, error: expect.stringContaining("changed") });
    mocks.client.mockResolvedValue(databaseMock(() => ({ data: null })));
    expect(await saveWebsiteSeo(assetId, null, form())).toMatchObject({ ok: false, error: expect.stringContaining("workspace") });
    const oversized = form(); oversized.set("seo_title", "x".repeat(71));
    const invalid = databaseMock(() => ({ data: baseAsset })); mocks.client.mockResolvedValue(invalid);
    expect((await saveWebsiteSeo(assetId, null, oversized)).ok).toBe(false);
    expect(invalid.queries.some(query => query.operation === "update")).toBe(false);
  });

  it("reconciles only this workspace's CMS deliveries and does not prepare recurring content", async () => {
    const database = databaseMock(() => ({ data: [{ content_asset_id: "first" }, { content_asset_id: "first" }, { content_asset_id: "second" }] })); mocks.client.mockResolvedValue(database);
    mocks.sync.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect(await checkWebsiteDeliveries()).toMatchObject({ ok: false, message: expect.stringContaining("1 delivery checked") });
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    expect(mocks.sync).toHaveBeenCalledWith("workspace", "first");
    expect(database.queries[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "workspace" },
      { method: "in", column: "channel", value: ["wordpress", "strapi"] },
    ]));
    expect(database.queries.map(query => query.table)).toEqual(["publications"]);
    expect(mocks.revalidate).toHaveBeenCalledWith("/audience/landing-pages");
  });

  it("blocks delivery checks before database access when reviewer authorization fails", async () => {
    mocks.reviewer.mockRejectedValue(new Error("Denied"));
    expect((await checkWebsiteDeliveries()).ok).toBe(false); expect(mocks.client).not.toHaveBeenCalled();
  });

  it("records definitive Strapi rejection as failed while preserving uncertain requests", async () => {
    const database = databaseMock(() => ({ data: { ...baseAsset, status: "approved", metadata: {} } }));
    mocks.client.mockResolvedValue({ ...database, auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) } });
    mocks.strapi.mockResolvedValue({ apiToken: "test-token" });
    mocks.strapiPublish.mockRejectedValueOnce(new DeliveryRejected("Permission denied"));
    expect(await publishApprovedToStrapi(assetId)).toMatchObject({ ok: false, error: expect.stringContaining("Approved") });
    expect(mocks.save).toHaveBeenCalledWith("workspace", "publication", assetId, expect.objectContaining({ status: "failed" }));
    expect(mocks.uncertain).not.toHaveBeenCalled();
    expect(mocks.strapiPublish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ seo: { title: baseAsset.title, description: baseAsset.body } }));
    mocks.strapiPublish.mockRejectedValueOnce(new Error("Connection dropped"));
    expect(await publishApprovedToStrapi(assetId)).toMatchObject({ ok: false, error: expect.stringContaining("reserved") });
    expect(mocks.uncertain).toHaveBeenCalledTimes(1);
  });
});
