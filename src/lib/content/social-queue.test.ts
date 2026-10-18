import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { listSocialQueue } from "./social-queue";
beforeEach(() => vi.clearAllMocks());
describe("social queue boundaries", () => {
  it("scopes every list to the caller workspace, validates filters and paginates", async () => {
    const database = databaseMock(() => ({ data: [{ id: "post" }], count: 42 }));
    mocks.client.mockResolvedValue(database);
    expect(await listSocialQueue("workspace", { stage: "scheduled", platform: "x", page: "2" })).toMatchObject({ total: 42, page: 2 });
    expect(database.queries[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "workspace" },
      { method: "eq", column: "status", value: "scheduled" },
      { method: "range", column: 20, value: 39 },
      { method: "or", column: "platform.in.(x,twitter),and(platform.is.null,channel.in.(x,twitter))", value: undefined },
    ]));
  });
  it("never interpolates unknown filters into PostgREST expressions", async () => {
    const database = databaseMock(() => ({ data: [], count: 0 })); mocks.client.mockResolvedValue(database);
    expect(await listSocialQueue("workspace", { platform: "x),id.neq.null", stage: "invalid", page: "-2" })).toMatchObject({ platform: "all", stage: "all", page: 1 });
    expect(JSON.stringify(database.queries)).not.toContain("id.neq.null");
  });
  it("includes analysing content in published results and surfaces query failures", async () => {
    const database = databaseMock(() => ({ data: [] })); mocks.client.mockResolvedValue(database);
    await listSocialQueue("workspace", { stage: "published" });
    expect(database.queries[0].filters).toContainEqual({ method: "in", column: "status", value: ["published", "analysing"] });
    mocks.client.mockResolvedValue(databaseMock(() => ({ error: { message: "private diagnostic" } })));
    await expect(listSocialQueue("workspace")).rejects.toThrow("Could not load social posts");
  });
});
