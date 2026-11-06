import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn(), redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: vi.fn().mockResolvedValue("org-a") }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/ai/provider", () => ({ completeWithConfiguredProvider: vi.fn() }));
vi.mock("@/lib/audience/access", () => ({ requireReviewer: vi.fn().mockResolvedValue(undefined) }));
import { saveLeadNotes, setLeadQualified, setLeadStage } from "./leads";
import { createLeadFromCommunityItem } from "./community";

/** Keep in step with the GRANT in 20261103000000_leads_column_grants.sql. */
const GRANTED_LEAD_COLUMNS = ["funnel_stage", "is_converted", "is_qualified", "score", "score_reason", "notes", "owner_id"];
const LEAD = "6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f";
const ITEM = "0ae379a3-9723-4780-869a-51dbee4dc256";

afterEach(() => vi.clearAllMocks());

function setup(rpc = async () => ({ data: null as unknown, error: null })) {
  const db = databaseMock(() => ({ data: { is_qualified: false, is_converted: false }, error: null }));
  const rpcSpy = vi.fn(rpc);
  mocks.client.mockResolvedValue({ ...db, rpc: rpcSpy, auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } });
  return { db, rpc: rpcSpy };
}

const leadWrites = (db: ReturnType<typeof setup>["db"]) => db.queries.filter((q) => q.table === "leads" && q.operation !== "select");

// Members may only update the granted CRM columns, and can't insert or
// delete leads; any other client write fails with permission denied.
describe("client lead writes stay within the column grants", () => {
  it.each([
    ["setLeadStage", () => setLeadStage(LEAD, "converted")],
    ["saveLeadNotes", () => { const form = new FormData(); form.set("notes", "Called on Monday."); return saveLeadNotes(LEAD, form); }],
    ["saveLeadNotes clearing the owner", () => { const form = new FormData(); form.set("owner_cleared", "1"); return saveLeadNotes(LEAD, form); }],
    ["setLeadQualified", () => setLeadQualified(LEAD, true)],
  ])("%s updates only granted columns", async (_name, run) => {
    const { db } = setup();
    expect(await run()).toEqual({ ok: true });
    const writes = leadWrites(db);
    expect(writes).toHaveLength(1);
    expect(writes[0].operation).toBe("update");
    for (const column of Object.keys(writes[0].payload as Record<string, unknown>)) expect(GRANTED_LEAD_COLUMNS).toContain(column);
  });

  it("creates a lead from a community item through the database function, not a direct insert", async () => {
    const { db, rpc } = setup(async () => ({ data: LEAD, error: null }));
    const form = new FormData();
    form.set("id", ITEM);
    await createLeadFromCommunityItem(form);
    expect(rpc).toHaveBeenCalledWith("community_item_create_lead", { p_community_id: ITEM });
    expect(leadWrites(db)).toEqual([]);
    expect(mocks.redirect).toHaveBeenCalledWith(`/leads/${LEAD}`);
  });
});
