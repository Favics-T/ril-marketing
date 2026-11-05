import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), kpis: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/audience/kpis", () => ({ getKpiProgress: mocks.kpis }));
import { analyticsPeriod } from "./marketing";
import { loadMarketingAnalytics } from "./load-marketing";
beforeEach(() => { vi.resetAllMocks(); mocks.kpis.mockResolvedValue([]); });
const period = analyticsPeriod({ period: "28" }, new Date("2026-10-26"));
describe("workspace analytics data access", () => {
  it("scopes every query to the authenticated workspace and selects no lead contact details or secrets", async () => {
    const db = databaseMock(() => ({ data: [], count: 0, error: null })); mocks.client.mockResolvedValue(db);
    await loadMarketingAnalytics("workspace-a", period);
    expect(db.queries).toHaveLength(6);
    for (const query of db.queries) {
      expect(query.filters).toContainEqual({ method: "eq", column: "organization_id", value: "workspace-a" });
      const columns = query.columns?.split(",") ?? [];
      for (const forbidden of ["email", "name", "phone", "interest", "config", "body", "api_key"]) {
        if (query.table !== "campaigns" && query.table !== "audience_segments") expect(columns).not.toContain(forbidden);
      }
    }
    expect(db.queries.find(q => q.table === "leads")?.filters).toContainEqual({ method: "gte", column: "created_at", value: period.previousFrom });
    expect(db.queries.find(q => q.table === "content_assets")?.filters).toContainEqual({ method: "gte", column: "created_at", value: period.from });
    expect(db.queries.find(q => q.table === "analytics_events")?.filters).toContainEqual({ method: "or", column: "metadata->>path.eq./,metadata->>path.like./p/%", value: undefined });
    expect(mocks.kpis).toHaveBeenCalledWith("workspace-a");
  });
  it("keeps other sections available when visits and goal loading fail", async () => {
    const db = databaseMock(query => query.table === "analytics_events" ? { data: null, error: { message: "Read failed" } } : { data: [], count: 0 }); mocks.client.mockResolvedValue(db); mocks.kpis.mockRejectedValue(new Error("Unavailable"));
    const result = await loadMarketingAnalytics("workspace-a", period);
    expect(result.analytics.unavailable).toMatchObject({ visits: true, leads: false, content: false });
    expect(result.goalsUnavailable).toBe(true);
    expect(result.goals).toEqual([]);
  });
});
