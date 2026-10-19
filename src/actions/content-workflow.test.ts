import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), reviewer: vi.fn(), rpc: vi.fn(), finish: vi.fn(), config: vi.fn(), update: vi.fn(), draft: vi.fn(), posts: vi.fn(), ai: vi.fn(), sync: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: async () => "org" }));
vi.mock("@/lib/audience/access", () => ({ requireReviewer: mocks.reviewer }));
vi.mock("@/lib/content/publishing", () => ({ syncPublication: mocks.sync }));
vi.mock("@/lib/ai/provider", () => ({ completeWithConfiguredProvider: mocks.ai }));
vi.mock("@/actions/wordpress", () => ({ scheduleApprovedBlog: vi.fn() }));
vi.mock("@/lib/integrations/wordpress", () => ({ getWordPressConfig: mocks.config, updatePostSchedule: mocks.update, setPostDraft: mocks.draft, getPostsByIds: mocks.posts, assertSchedulable: vi.fn() }));
import { changeCalendarSchedule, recoverCalendarSchedule, suggestContentTimes } from "./content-workflow";
const assetId = "30000000-0000-4000-8000-000000000001";
const expected = "2026-10-15T10:00:00Z";
const future = () => new Date(Date.now() + 86400000).toISOString();
function setup() {
  const db = databaseMock(query => ({data: query.table === "content_schedule_changes" ? {id:"change", publication_id:"publication", scheduled_for:future()} : query.table === "publications" ? {external_id:"42"} : query.columns?.includes("published_at") ? [] : {id:assetId,status:"scheduled",updated_at:expected,metadata:{publishing:{provider:"wordpress"}}}}));
  mocks.client.mockResolvedValue({...db,rpc:mocks.rpc});
  return db;
}
beforeEach(() => {
  vi.clearAllMocks(); setup(); mocks.reviewer.mockResolvedValue("owner"); mocks.admin.mockReturnValue({rpc:mocks.finish});
  mocks.config.mockResolvedValue({siteUrl:"https://example.org"}); mocks.rpc.mockResolvedValue({data:{provider:"wordpress",change_id:"change",post_id:"42"}});
  mocks.finish.mockResolvedValue({error:null}); mocks.update.mockResolvedValue({id:42,status:"future"}); mocks.draft.mockResolvedValue({id:42,status:"draft"}); mocks.ai.mockResolvedValue(null);
});
describe("calendar provider orchestration", () => {
  it("checks the workspace reviewer before reserving or changing any provider post", async () => {
    mocks.reviewer.mockRejectedValueOnce(new Error("Reviewer required"));
    expect(await changeCalendarSchedule({assetId,expected,at:future()})).toMatchObject({ok:false,error:"Reviewer required"});
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not contact WordPress after a stale version or rejected approval", async () => {
    expect((await changeCalendarSchedule({assetId,expected:"2020-01-01T00:00:00Z",at:future()})).ok).toBe(false);
    mocks.rpc.mockResolvedValueOnce({error:{message:"Recorded approval required"}});
    expect((await changeCalendarSchedule({assetId,expected,at:future()})).ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("finishes only with the confirmed provider receipt", async () => {
    expect((await changeCalendarSchedule({assetId,expected,at:future()})).ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(),42,expect.any(Date));
    expect(mocks.finish).toHaveBeenCalledWith("finish_content_schedule",{p_change:"change",p_receipt:{id:42,status:"future"}});
  });
  it("keeps an uncertain provider update pending for recovery", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Timeout"));
    expect(await changeCalendarSchedule({assetId,expected,at:future()})).toMatchObject({ok:false,pending:true,error:expect.stringContaining("Recover schedule")});
    expect(mocks.finish).not.toHaveBeenCalled();
  });
  it("requires WordPress to confirm draft before completing unscheduling", async () => {
    expect((await changeCalendarSchedule({assetId,expected,at:null})).ok).toBe(true);
    expect(mocks.draft).toHaveBeenCalledWith(expect.anything(),42);
    expect(mocks.finish).toHaveBeenCalledWith("finish_content_schedule",expect.objectContaining({p_receipt:{id:42,status:"draft"}}));
  });
  it("preserves an already published post during recovery and reconciles delivery", async () => {
    mocks.posts.mockResolvedValueOnce([{id:42,status:"publish"}]);
    expect(await recoverCalendarSchedule(assetId)).toMatchObject({ok:false,error:expect.stringContaining("already published")});
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith("abort_content_schedule",expect.objectContaining({p_change:"change"}));
    expect(mocks.sync).toHaveBeenCalledWith("org",assetId);
  });
  it("offers explicitly labelled available slots when AI is not connected", async () => {
    const result = await suggestContentTimes(assetId);
    expect(result.source).toBe("history"); expect(result.slots).toHaveLength(3);
    expect(result.message).toMatch(/AI is not connected/);
  });
});
