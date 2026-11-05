import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { listNeedsAttention } from "./assets";

const ORG = "org-a";
const now = new Date("2026-11-04T09:00:00Z");
const blog = { id: "a1", organization_id: ORG, title: "Launch recap", channel: "website", platform: null, format: "blog", status: "scheduled", scheduled_for: "2026-11-03T08:00:00Z", published_at: null };

afterEach(() => vi.clearAllMocks());

function setup(resolve: (query: Query) => QueryResult) {
  const db = databaseMock(resolve);
  mocks.client.mockResolvedValue(db);
  return db;
}

const isFailureQuery = (q: Query) => q.table === "publications" && q.filters.some((f) => f.method === "in" && f.column === "status");
const isPublishedQuery = (q: Query) => q.table === "publications" && q.filters.some((f) => f.method === "eq" && f.column === "status");
const scopedTo = (q: Query) => q.filters.find((f) => f.method === "eq" && f.column === "organization_id")?.value;

describe("listNeedsAttention (REN-421)", () => {
  it("scopes every query to the workspace and combines failures with overdue posts", async () => {
    const db = setup((q) => {
      if (isFailureQuery(q)) return { data: [{ id: "p1", organization_id: ORG, content_asset_id: "a1", channel: "wordpress", status: "failed", error: "WordPress request failed: HTTP 500", created_at: "2026-11-04T08:00:00Z", asset: blog }], error: null };
      if (isPublishedQuery(q)) return { data: [], error: null };
      return { data: [blog], error: null, count: 1 };
    });
    const result = await listNeedsAttention(ORG, now);
    expect(result.total).toBe(1);
    expect(result.items).toEqual([expect.objectContaining({ kind: "failed", assetId: "a1", dueAt: "2026-11-03T08:00:00Z" })]);
    expect(db.queries).toHaveLength(3);
    for (const query of db.queries) expect(scopedTo(query)).toBe(ORG);
    const overdue = db.queries.find((q) => q.table === "content_assets")!;
    expect(overdue.filters).toEqual(expect.arrayContaining([
      { method: "in", column: "status", value: ["approved", "scheduled"] },
      { method: "lt", column: "scheduled_for", value: now.toISOString() },
    ]));
    expect(db.queries.find(isFailureQuery)!.filters).toContainEqual({ method: "in", column: "status", value: ["failed", "missed"] });
    expect(db.queries.find(isPublishedQuery)!.filters).toContainEqual({ method: "in", column: "content_asset_id", value: ["a1"] });
  });

  it("skips the publish-history lookup when nothing failed", async () => {
    const db = setup((q) => (q.table === "publications" ? { data: [], error: null } : { data: [], error: null, count: 0 }));
    expect(await listNeedsAttention(ORG, now)).toEqual({ items: [], total: 0 });
    expect(db.queries.filter(isPublishedQuery)).toEqual([]);
  });

  it("throws when a query fails, so the panel can show its own error", async () => {
    setup((q) => (isFailureQuery(q) ? { data: null, error: { message: "permission denied" } } : { data: [], error: null, count: 0 }));
    await expect(listNeedsAttention(ORG, now)).rejects.toThrow("Failed to load failed publishes");
  });
});
