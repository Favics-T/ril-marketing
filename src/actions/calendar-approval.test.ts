import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ client: vi.fn(), org: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { transitionAsset } from "./content";
function form(to: string, time?: string) { const fd = new FormData(); fd.set("to", to); fd.set("expected_updated_at", "2026-10-15T10:00:00Z"); if (time) fd.set("scheduled_for", time); return fd; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.org.mockResolvedValue("org");
  const db = databaseMock(() => ({data: {updated_at: "2026-10-15T10:00:00Z"}}));
  mocks.client.mockResolvedValue({...db, rpc: mocks.rpc}); mocks.rpc.mockResolvedValue({data: {status: "scheduled", message: "Saved"}, error: null});
});
describe("content transition action", () => {
  it("passes the exact version and publishing instant to the atomic workflow", async () => {
    const time = new Date(Date.now()+86400000).toISOString();
    expect((await transitionAsset("asset", form("scheduled", time))).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("workflow_transition_asset", expect.objectContaining({p_asset: "asset", p_expected: "2026-10-15T10:00:00Z", p_to: "scheduled", p_schedule: time}));
  });
  it.each(["invalid", "2026-10-15T10:00"])("rejects ambiguous or invalid time %s", async time => {expect((await transitionAsset("asset",form("scheduled",time))).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();});
  it.each(["Choose a future publishing time.", "This action requires a reviewer role.", "Use the provider schedule controls for this post.", "Only the named second reviewer can give this approval.", "This content changed. Refresh before trying again."])("surfaces database rejection: %s", async message => {
    mocks.rpc.mockResolvedValueOnce({error:{message}}); expect(await transitionAsset("asset",form("approved"))).toMatchObject({ok:false,error:message});
  });
  it("passes a named second reviewer and shows the first approval result", async () => {
    const fd=form("approved");fd.set("second_reviewer_id","20000000-0000-4000-8000-000000000003");
    mocks.rpc.mockResolvedValueOnce({data:{status:"review",message:"First approval saved. The named reviewer must approve next."}});
    expect(await transitionAsset("asset",fd)).toMatchObject({ok:true,message:expect.stringContaining("named reviewer")});
    expect(mocks.rpc).toHaveBeenCalledWith("workflow_transition_asset",expect.objectContaining({p_second:fd.get("second_reviewer_id")}));
  });
  it("rejects unknown statuses",async()=>{expect((await transitionAsset("asset",form("invented"))).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();});
});
