import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query, type QueryResult } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), org: vi.fn(), role: vi.fn(), requireReviewer: vi.fn(), user: { id: "reviewer" as string | null }, config: vi.fn(), batch: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/organization", () => ({ requireOrganizationId: mocks.org }));
vi.mock("@/lib/audience/access", async () => {
  const guards = await vi.importActual<typeof import("@/lib/audience/guards")>("@/lib/audience/guards");
  return { getUserRole: mocks.role, isReviewerRole: guards.isReviewerRole, requireReviewer: mocks.requireReviewer };
});
vi.mock("@/lib/integrations/resend", () => ({ getResendConfig: mocks.config }));
vi.mock("@/jobs/email-delivery", () => ({ processEmailDeliveryBatch: mocks.batch }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createEmailCampaign, queueEmailCampaign, transitionEmailCampaign } from "./email";

const ID = "44444444-4444-4444-8444-444444444444";
type Item = { id: string; status: string; created_by: string | null; approved_by: string | null; metadata: Record<string, unknown> | null; audience_segment_id?: string | null };

function setup(item: Item | null, options: { updated?: boolean; segment?: boolean } = {}) {
  const db = databaseMock((q: Query): QueryResult => {
    if (q.table === "email_campaigns" && q.operation === "update") return { data: options.updated === false ? null : { id: ID } };
    if (q.table === "email_campaigns" && q.operation === "insert") return { data: null, error: null };
    if (q.table === "email_campaigns") return { data: item };
    if (q.table === "audience_segments" || q.table === "campaigns") return { data: options.segment === false ? null : { id: "x" } };
    if (q.table === "leads") return { data: [{ id: "lead", email: "reader@example.com" }], count: 1 };
    return { data: null };
  });
  const admin = databaseMock((q: Query): QueryResult => q.operation === "upsert" ? { data: [{ id: "delivery" }] } : q.head ? { count: 1 } : { data: null });
  mocks.client.mockResolvedValue({ ...db, auth: { getUser: async () => ({ data: { user: mocks.user.id ? { id: mocks.user.id } : null } }) } });
  mocks.admin.mockReturnValue(admin);
  return { db, admin };
}
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
const transition = (to: string) => transitionEmailCampaign(null, form({ id: ID, to }));
const campaignUpdate = (db: ReturnType<typeof databaseMock>) => db.queries.find((q) => q.table === "email_campaigns" && q.operation === "update");

beforeEach(() => {
  mocks.org.mockResolvedValue("org");
  mocks.role.mockResolvedValue("marketing_manager");
  mocks.user.id = "reviewer";
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT ${path}`); });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "x".repeat(32));
  mocks.config.mockResolvedValue({ apiKey: "test", fromName: "Test", fromEmail: "sender@example.com", webhookSecret: "secret" });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network calls in these tests."); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("transitionEmailCampaign returns refusals instead of throwing", () => {
  it("shows the self-approval message to the author", async () => {
    const { db } = setup({ id: ID, status: "review", created_by: "reviewer", approved_by: null, metadata: {} });
    expect(await transition("approved")).toEqual({ ok: false, error: "A different workspace reviewer must approve this email." });
    expect(campaignUpdate(db)).toBeUndefined();
  });
  it("refuses an approver without a reviewer role", async () => {
    mocks.role.mockResolvedValue("member");
    setup({ id: ID, status: "review", created_by: "author", approved_by: null, metadata: {} });
    expect((await transition("approved")).error).toMatch(/owner, admin, marketing manager or leadership/);
  });
  it("refuses a status change the campaign can't make", async () => {
    setup({ id: ID, status: "draft", created_by: "author", approved_by: null, metadata: {} });
    expect(await transition("approved")).toEqual({ ok: false, error: "That email campaign can’t make this status change." });
  });
  it("reports a missing campaign", async () => {
    setup(null);
    expect(await transition("review")).toEqual({ ok: false, error: "Email campaign not found." });
  });
  it("reports invalid input and workspace errors", async () => {
    setup(null);
    expect((await transitionEmailCampaign(null, form({ id: "nope", to: "approved" }))).ok).toBe(false);
    mocks.org.mockRejectedValue(new Error("Join a workspace first."));
    expect(await transition("review")).toEqual({ ok: false, error: "Join a workspace first." });
  });
  it("reports a campaign that changed status during the request", async () => {
    setup({ id: ID, status: "review", created_by: "author", approved_by: null, metadata: {} }, { updated: false });
    expect((await transition("approved")).error).toMatch(/changed while you were working/);
  });
});

describe("separation of duties", () => {
  it("records who submitted a draft for review", async () => {
    const { db } = setup({ id: ID, status: "draft", created_by: null, approved_by: null, metadata: { source: "newsletter" } });
    expect(await transition("review")).toEqual({ ok: true });
    expect(campaignUpdate(db)?.payload).toEqual({ status: "review", metadata: { source: "newsletter", submitted_by: "reviewer" } });
    expect(campaignUpdate(db)?.filters).toContainEqual({ method: "eq", column: "status", value: "draft" });
  });
  it("stops the submitter approving a draft that has no creator", async () => {
    const { db } = setup({ id: ID, status: "review", created_by: null, approved_by: null, metadata: { submitted_by: "reviewer" } });
    expect(await transition("approved")).toEqual({ ok: false, error: "A different workspace reviewer must approve this email." });
    expect(campaignUpdate(db)).toBeUndefined();
  });
  it("stops the submitter approving even when someone else created it", async () => {
    setup({ id: ID, status: "review", created_by: "author", approved_by: null, metadata: { submitted_by: "reviewer" } });
    expect((await transition("approved")).ok).toBe(false);
  });
  it("lets a different reviewer approve and records them", async () => {
    const { db } = setup({ id: ID, status: "review", created_by: null, approved_by: null, metadata: { submitted_by: "submitter" } });
    expect(await transition("approved")).toEqual({ ok: true });
    expect(campaignUpdate(db)?.payload).toEqual({ status: "approved", approved_by: "reviewer" });
  });

  const approved = { id: ID, status: "approved", created_by: null, approved_by: "approver", metadata: {}, audience_segment_id: null };
  it("stops the approver queuing their own approval", async () => {
    mocks.user.id = "approver";
    const { admin } = setup(approved);
    expect(await queueEmailCampaign(ID)).toEqual({ ok: false, error: "A workspace reviewer other than the author and the approver must queue this campaign." });
    expect(admin.queries).toHaveLength(0);
  });
  it("stops the author queuing", async () => {
    mocks.user.id = "author";
    setup({ ...approved, created_by: "author" });
    expect((await queueEmailCampaign(ID)).ok).toBe(false);
  });
  it("refuses a campaign with no recorded approver", async () => {
    setup({ ...approved, approved_by: null });
    expect(await queueEmailCampaign(ID)).toEqual({ ok: false, error: "This campaign has no recorded approver, so it can’t be queued." });
  });
  it("lets a third person queue without sending anything", async () => {
    const { admin } = setup(approved);
    const result = await queueEmailCampaign(ID);
    expect(result.ok).toBe(true);
    expect(admin.queries.some((q) => q.operation === "upsert")).toBe(true);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("pause and resume", () => {
  it.each(["draft", "review", "approved"])("refuses to pause a %s campaign", async (status) => {
    const { db } = setup({ id: ID, status, created_by: "author", approved_by: null, metadata: {} });
    expect(await transition("paused")).toEqual({ ok: false, error: "That email campaign can’t make this status change." });
    expect(campaignUpdate(db)).toBeUndefined();
  });
  it("records where a sending campaign was paused from and holds its deliveries", async () => {
    const { db, admin } = setup({ id: ID, status: "scheduled", created_by: "author", approved_by: "approver", metadata: {} });
    expect(await transition("paused")).toEqual({ ok: true });
    expect(campaignUpdate(db)?.payload).toEqual({ status: "paused", metadata: { paused_from: "scheduled" } });
    expect(admin.queries[0]).toMatchObject({ table: "email_campaign_deliveries", operation: "update" });
  });
  it("resumes a campaign paused while sending back to sending", async () => {
    const { db, admin } = setup({ id: ID, status: "paused", created_by: "author", approved_by: "approver", metadata: { paused_from: "scheduled", delivery_problem: { failed: 1, attempted: 1 } } });
    expect(await transition("scheduled")).toEqual({ ok: true });
    expect(campaignUpdate(db)?.payload).toEqual({ status: "scheduled", metadata: { delivery_problem: { failed: 1, attempted: 1 } } });
    expect(admin.queries.some((q) => q.table === "email_campaign_deliveries")).toBe(true);
  });
  it("returns an approved campaign paused before this change to approved, not sending", async () => {
    const { db, admin } = setup({ id: ID, status: "paused", created_by: "author", approved_by: "approver", metadata: {} });
    await transition("scheduled");
    expect(campaignUpdate(db)?.payload).toMatchObject({ status: "approved" });
    expect(admin.queries).toHaveLength(0);
  });
  it("returns a paused draft with no approver to draft", async () => {
    const { db } = setup({ id: ID, status: "paused", created_by: "author", approved_by: null, metadata: {} });
    await transition("scheduled");
    expect(campaignUpdate(db)?.payload).toMatchObject({ status: "draft" });
  });
});

describe("createEmailCampaign", () => {
  const valid = { name: "Founder invite", subject: "Join us", preview_text: "", body: "Join the next founder cohort.", campaign_id: "", audience_segment_id: "" };
  it("returns validation errors instead of throwing", async () => {
    setup(null);
    expect((await createEmailCampaign(null, form({ ...valid, body: "short" }))).ok).toBe(false);
  });
  it("returns an error for a segment outside the workspace", async () => {
    setup(null, { segment: false });
    expect(await createEmailCampaign(null, form({ ...valid, audience_segment_id: ID }))).toEqual({ ok: false, error: "Choose a campaign and audience segment from this workspace." });
  });
  it("saves and returns to the email page", async () => {
    const { db } = setup(null);
    await expect(createEmailCampaign(null, form(valid))).rejects.toThrow("NEXT_REDIRECT /email");
    expect(db.queries.find((q) => q.operation === "insert")?.payload).toMatchObject({ name: "Founder invite", created_by: "reviewer" });
  });
});
