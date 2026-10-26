import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), page: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/landing-pages", () => ({ getPublishedLandingPage: mocks.page }));
import { POST } from "./route";
beforeEach(() => vi.resetAllMocks());
let count = 0;
const request = (path: string) => new NextRequest("http://localhost/api/track/view", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${++count}`, "User-Agent": "Mozilla/5.0" }, body: JSON.stringify({ path }) });
describe("landing-page analytics attribution", () => {
  it("attributes a published page to its own workspace and campaign without accepting browser IDs", async () => {
    const db = databaseMock(() => ({ data: null })); mocks.admin.mockReturnValue(db);
    mocks.page.mockResolvedValue({ id: "page", organization_id: "correct-workspace", campaign_id: "campaign" });
    expect((await POST(request("/p/programme?email=must-not-save@example.com"))).status).toBe(200);
    expect(db.queries[0].payload).toMatchObject({ organization_id: "correct-workspace", metadata: { path: "/p/programme", landing_page_id: "page", campaign_id: "campaign" } });
    expect(JSON.stringify(db.queries)).not.toContain("must-not-save");
    expect(db.queries.some(q => q.table === "organizations")).toBe(false);
  });
  it("does not fall back to another workspace for unpublished or unknown pages", async () => {
    const db = databaseMock(() => ({ data: { id: "wrong-workspace" } })); mocks.admin.mockReturnValue(db); mocks.page.mockResolvedValue(null);
    expect((await POST(request("/p/not-public"))).status).toBe(200);
    expect(db.queries).toEqual([]);
  });
});
