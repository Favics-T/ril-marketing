import { beforeEach, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  sync: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/content/publishing", () => ({ syncPublication: mocks.sync }));
import { processContentPublishingBatch } from "./content-publishing";
beforeEach(() => vi.clearAllMocks());
it("isolates interactive checks to their workspace and keeps checking deliveries if one recurring plan fails", async () => {
  const database = databaseMock((query) => ({
    data:
      query.table === "recurring_content"
        ? [
            { id: "bad", next_due: "date" },
            { id: "good", next_due: "date" },
          ]
        : [{ organization_id: "org", content_asset_id: "asset" }],
  }));
  mocks.rpc
    .mockResolvedValueOnce({ error: { message: "Temporary failure" } })
    .mockResolvedValueOnce({ data: "draft" });
  mocks.sync.mockResolvedValue("Still queued");
  mocks.admin.mockReturnValue({ ...database, rpc: mocks.rpc });
  expect(await processContentPublishingBatch(20, "org")).toEqual({
    checked: 1,
    failed: 0,
    recurringPrepared: 1,
    recurringFailed: 1,
  });
  expect(mocks.sync).toHaveBeenCalledWith("org", "asset");
  for (const query of database.queries)
    expect(query.filters).toContainEqual({
      method: "eq",
      column: "organization_id",
      value: "org",
    });
});
it("does not resend posts when a delivery check fails", async () => {
  const database = databaseMock((query) => ({
    data:
      query.table === "recurring_content"
        ? []
        : [{ organization_id: "org", content_asset_id: "asset" }],
  }));
  mocks.admin.mockReturnValue(database);
  mocks.sync.mockRejectedValue(new Error("Provider unavailable"));
  expect(await processContentPublishingBatch()).toMatchObject({
    checked: 0,
    failed: 1,
  });
  expect(mocks.sync).toHaveBeenCalledTimes(1);
});
