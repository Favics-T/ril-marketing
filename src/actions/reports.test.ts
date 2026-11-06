import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ org: vi.fn(), client: vi.fn(), generate: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audience/access", () => ({ getUserRole: vi.fn(), requireReviewer: vi.fn() }));
vi.mock("@/lib/reports/generate", () => ({ createMarketingReport: mocks.generate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { createReportDraft } from "./reports";

function form(start = "2026-09-01", end = "2026-09-30") {
  const data = new FormData();
  data.set("period_type", "monthly"); data.set("period_start", start); data.set("period_end", end);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.org.mockResolvedValue("workspace");
  mocks.client.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "author" } } }) } });
});
describe("report form feedback", () => {
  it("rejects a reversed date range without generating a report", async () => {
    expect(await createReportDraft(null, form("2026-09-30", "2026-09-01"))).toMatchObject({ error: "End date must be on or after the start date." });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("passes the selected dates and authenticated workspace to draft generation", async () => {
    expect(await createReportDraft(null, form())).toEqual({ ok: true });
    expect(mocks.generate).toHaveBeenCalledWith("workspace", "monthly", "2026-09-01", "2026-09-30", "author");
    expect(mocks.revalidate).toHaveBeenCalledWith("/reports");
  });
  it("keeps the form recoverable without exposing internal errors", async () => {
    mocks.generate.mockRejectedValue(new Error("private upstream details"));
    const result = await createReportDraft(null, form());
    expect(result.error).toContain("try again");
    expect(result.error).not.toContain("private");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not generate when workspace access fails", async () => {
    mocks.org.mockRejectedValue(new Error("unauthorized"));
    expect(await createReportDraft(null, form())).toHaveProperty("error");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
