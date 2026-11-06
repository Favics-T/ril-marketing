import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ org: vi.fn(), client: vi.fn(), channels: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/content/connected-channels", () => ({ getConnectedChannelOptions: mocks.channels }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createManualAsset, updateContentDraft } from "./content";
beforeEach(() => {
  vi.resetAllMocks(); mocks.org.mockResolvedValue("workspace"); mocks.channels.mockResolvedValue([["x", "X"]]);
});
function form(channel: string) { const data = new FormData(); data.set("title", "Authored content"); data.set("body", "The team's saved source copy"); data.set("channel", channel); return data; }
describe("content destination validation", () => {
  it("rejects a forged or disconnected channel before creating content", async () => {
    expect(await createManualAsset(form("instagram"))).toMatchObject({ ok: false, error: expect.stringContaining("connected channel") });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["", "x"])("creates an authorized draft for channel %s without publishing", async channel => {
    const database = databaseMock(() => ({ data: { id: "asset" } })); mocks.client.mockResolvedValue(database);
    expect(await createManualAsset(form(channel))).toMatchObject({ ok: true });
    expect(database.queries[0].payload).toMatchObject({ organization_id: "workspace", channel: channel || null, status: "editing" });
    expect(database.queries[0].table).toBe("content_assets");
  });
  it("allows editing existing disconnected copy while rejecting a newly chosen disconnected channel", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const database = databaseMock(() => ({ data: { status: "editing", channel: "linkedin", metadata: {}, updated_at: "2026-10-21T10:00:00Z" } }));
    mocks.client.mockResolvedValue({ ...database, rpc });
    expect(await updateContentDraft("asset", null, form("instagram"))).toMatchObject({ ok: false, error: expect.stringContaining("no longer connected") });
    expect(rpc).not.toHaveBeenCalled();
    expect(await updateContentDraft("asset", null, form("linkedin"))).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith("save_content_draft", expect.objectContaining({ p_asset: "asset" }));
  });
});
