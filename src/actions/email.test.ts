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
import { approveSensitiveEmail, createEmailCampaign, queueEmailCampaign, sendEmailCampaignBatch, setEmailSensitivity, transitionEmailCampaign } from "./email";

const ID = "44444444-4444-4444-8444-444444444444";
type Item = { id: string; status: string; created_by: string | null; approved_by: string | null; metadata: Record<string, unknown> | null; audience_segment_id?: string | null; submitted_by?: string | null; is_sensitive?: boolean; sensitive_approved_by?: string | null };
type SettingsRow = { can_flag_sensitive: string[]; sensitive_approver_roles: string[] };

function setup(item: Item | null, options: { updated?: boolean; segment?: boolean; settings?: SettingsRow } = {}) {
  const db = databaseMock((q: Query): QueryResult => {
    if (q.table === "email_campaigns" && q.operation === "update") return { data: options.updated === false ? null : { id: ID } };
    if (q.table === "email_campaigns" && q.operation === "insert") return { data: null, error: null };
    if (q.table === "email_campaigns") return { data: item };
    if (q.table === "audience_segments" || q.table === "campaigns") return { data: options.segment === false ? null : { id: "x" } };
    if (q.table === "leads") return { data: [{ id: "lead", email: "reader@example.com" }], count: 1 };
    if (q.table === "workspace_settings") return { data: options.settings ?? null };
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
  it("submits a draft as the signed-in user and leaves the submitter to the database", async () => {
    const { db, admin } = setup({ id: ID, status: "draft", created_by: null, approved_by: null, metadata: { source: "newsletter" } });
    expect(await transition("review")).toEqual({ ok: true });
    // The trigger sets submitted_by/submitted_at from auth.uid(); the client sends no submitter.
    expect(campaignUpdate(db)?.payload).toEqual({ status: "review" });
    expect(admin.queries.some((q) => q.table === "email_campaigns")).toBe(false);
    expect(campaignUpdate(db)?.filters).toContainEqual({ method: "eq", column: "status", value: "draft" });
  });
  it("stops the submitter approving a draft that has no creator", async () => {
    const { db } = setup({ id: ID, status: "review", created_by: null, approved_by: null, metadata: { submitted_by: "reviewer" } });
    expect(await transition("approved")).toEqual({ ok: false, error: "A different workspace reviewer must approve this email." });
    expect(campaignUpdate(db)).toBeUndefined();
  });
  it("refuses to submit without a signed-in user", async () => {
    mocks.user.id = null;
    const { db, admin } = setup({ id: ID, status: "draft", created_by: "author", approved_by: null, metadata: {} });
    expect(await transition("review")).toEqual({ ok: false, error: "Sign in again to change this email campaign." });
    expect(campaignUpdate(db)).toBeUndefined();
    expect(admin.queries).toHaveLength(0);
  });
  it("stops the submitter recorded in the submitted_by column approving", async () => {
    setup({ id: ID, status: "review", created_by: "author", approved_by: null, submitted_by: "reviewer", metadata: {} });
    expect(await transition("approved")).toEqual({ ok: false, error: "A different workspace reviewer must approve this email." });
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

describe("sensitive campaigns (REN-414)", () => {
  const flag = (sensitive: boolean) => setEmailSensitivity(null, form({ id: ID, sensitive: String(sensitive) }));
  const signOff = () => approveSensitiveEmail(null, form({ id: ID }));
  const settingsReads = (db: ReturnType<typeof databaseMock>) => db.queries.filter((q) => q.table === "workspace_settings");
  // Author, submitter and first approver are three different people; the caller defaults to "reviewer".
  const inReview: Item = { id: ID, status: "review", created_by: "author", submitted_by: "submitter", approved_by: null, metadata: {}, is_sensitive: false, sensitive_approved_by: null };
  const approvedItem: Item = { ...inReview, status: "approved", approved_by: "approver" };
  const awaiting: Item = { ...approvedItem, is_sensitive: true };
  const signedOff: Item = { ...awaiting, sensitive_approved_by: "senior" };

  describe("flagging", () => {
    it("lets an allowed reviewer flag a campaign, writing only the flag through their own client", async () => {
      const { db, admin } = setup(inReview);
      expect(await flag(true)).toEqual({ ok: true });
      const update = campaignUpdate(db);
      expect(update?.payload).toEqual({ is_sensitive: true });
      expect(update?.filters).toEqual(expect.arrayContaining([
        { method: "eq", column: "status", value: "review" },
        { method: "eq", column: "is_sensitive", value: false },
      ]));
      expect(admin.queries.some((q) => q.table === "email_campaigns")).toBe(false);
    });
    it.each([
      ["author", { created_by: "reviewer" }],
      ["submitter", { submitted_by: "reviewer" }],
      ["submitter recorded in legacy metadata", { submitted_by: null, metadata: { submitted_by: "reviewer" } }],
    ])("refuses the %s", async (_who, override) => {
      const { db } = setup({ ...inReview, ...override });
      expect(await flag(true)).toEqual({ ok: false, error: "The campaign's author or submitter can't flag or unflag it." });
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it("refuses a role outside the workspace's flagging roles", async () => {
      mocks.role.mockResolvedValue("member");
      const { db } = setup(inReview);
      expect((await flag(true)).error).toMatch(/Only owner, admin, marketing manager or leadership roles/);
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it("refuses without a signed-in user and writes nothing", async () => {
      mocks.user.id = null;
      const { db, admin } = setup(inReview);
      expect(await flag(true)).toEqual({ ok: false, error: "Sign in again to change this email campaign." });
      expect(campaignUpdate(db)).toBeUndefined();
      expect(admin.queries).toHaveLength(0);
    });
    it("refuses to flag a sent campaign", async () => {
      const { db } = setup({ ...approvedItem, status: "sent" });
      expect(await flag(true)).toEqual({ ok: false, error: "A sent campaign can't be flagged or unflagged." });
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it("notes held deliveries when a sending campaign is flagged (the database pauses it)", async () => {
      const { db, admin } = setup({ ...approvedItem, status: "scheduled" });
      expect(await flag(true)).toEqual({ ok: true });
      expect(campaignUpdate(db)?.payload).toEqual({ is_sensitive: true });
      expect(admin.queries[0]).toMatchObject({ table: "email_campaign_deliveries", operation: "update", payload: { error: "Campaign flagged sensitive; awaiting senior sign-off." } });
    });
    it("needs the same permission to clear the flag", async () => {
      const { db } = setup({ ...awaiting, created_by: "reviewer" });
      expect((await flag(false)).ok).toBe(false);
      expect(campaignUpdate(db)).toBeUndefined();
      mocks.role.mockResolvedValue("member");
      setup(awaiting);
      expect((await flag(false)).ok).toBe(false);
      mocks.role.mockResolvedValue("leadership");
      const allowed = setup(awaiting);
      expect(await flag(false)).toEqual({ ok: true });
      expect(campaignUpdate(allowed.db)?.payload).toEqual({ is_sensitive: false });
    });
    it("refuses to flag twice", async () => {
      setup(awaiting);
      expect(await flag(true)).toEqual({ ok: false, error: "This campaign is already flagged sensitive." });
    });
    it("follows a change to the workspace's flagging roles", async () => {
      setup(inReview, { settings: { can_flag_sensitive: ["owner"], sensitive_approver_roles: ["owner", "admin"] } });
      expect((await flag(true)).error).toMatch(/Only owner roles/);
      mocks.role.mockResolvedValue("member");
      setup(inReview, { settings: { can_flag_sensitive: ["member"], sensitive_approver_roles: ["owner", "admin"] } });
      expect(await flag(true)).toEqual({ ok: true });
    });
  });

  describe("senior sign-off", () => {
    beforeEach(() => { mocks.role.mockResolvedValue("owner"); mocks.user.id = "senior"; });
    it("records the signed-in senior approver through their own client", async () => {
      const { db, admin } = setup(awaiting);
      expect(await signOff()).toEqual({ ok: true });
      const update = campaignUpdate(db);
      expect(update?.payload).toEqual({ sensitive_approved_by: "senior" });
      expect(update?.filters).toEqual(expect.arrayContaining([
        { method: "eq", column: "is_sensitive", value: true },
        { method: "is", column: "sensitive_approved_by", value: null },
      ]));
      expect(admin.queries).toHaveLength(0);
    });
    it("refuses a role outside the senior approver roles", async () => {
      mocks.role.mockResolvedValue("marketing_manager");
      const { db } = setup(awaiting);
      expect(await signOff()).toEqual({ ok: false, error: "The senior sign-off needs owner or admin role." });
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it.each(["author", "submitter", "approver"])("refuses the %s, even as an owner", async (who) => {
      mocks.user.id = who;
      const { db } = setup(awaiting);
      expect(await signOff()).toEqual({ ok: false, error: "The senior sign-off must come from someone other than the author, submitter and first approver." });
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it("refuses before the first approval", async () => {
      setup({ ...inReview, is_sensitive: true });
      expect(await signOff()).toEqual({ ok: false, error: "Give the senior sign-off after the campaign's first approval." });
    });
    it("refuses a campaign that isn't sensitive", async () => {
      setup(approvedItem);
      expect(await signOff()).toEqual({ ok: false, error: "Only a sensitive campaign takes a senior sign-off." });
    });
    it("refuses without a signed-in user and writes nothing", async () => {
      mocks.user.id = null;
      const { db, admin } = setup(awaiting);
      expect(await signOff()).toEqual({ ok: false, error: "Sign in again to change this email campaign." });
      expect(campaignUpdate(db)).toBeUndefined();
      expect(admin.queries).toHaveLength(0);
    });
    it("follows a change to the senior approver roles", async () => {
      const settings = { can_flag_sensitive: ["owner"], sensitive_approver_roles: ["leadership"] };
      setup(awaiting, { settings });
      expect((await signOff()).error).toBe("The senior sign-off needs leadership role.");
      mocks.role.mockResolvedValue("leadership");
      setup(awaiting, { settings });
      expect(await signOff()).toEqual({ ok: true });
    });
  });

  describe("blocked until both approvals exist", () => {
    beforeEach(() => { mocks.user.id = "queuer"; });
    it("refuses to queue an approved campaign awaiting senior sign-off", async () => {
      const { db, admin } = setup(awaiting);
      expect(await queueEmailCampaign(ID)).toEqual({ ok: false, error: "Awaiting senior sign-off from owner or admin. A sensitive campaign can't be queued or sent until then." });
      expect(admin.queries).toHaveLength(0);
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it("names the workspace's configured approver roles", async () => {
      setup(awaiting, { settings: { can_flag_sensitive: ["owner"], sensitive_approver_roles: ["owner", "leadership"] } });
      expect((await queueEmailCampaign(ID)).error).toMatch(/from owner or leadership\./);
    });
    it("queues once the senior sign-off is given", async () => {
      const { admin } = setup(signedOff);
      expect((await queueEmailCampaign(ID)).ok).toBe(true);
      expect(admin.queries.some((q) => q.operation === "upsert")).toBe(true);
    });
    it("refuses to send a batch while awaiting senior sign-off", async () => {
      const { db } = setup({ ...awaiting, status: "scheduled" });
      expect((await sendEmailCampaignBatch(ID)).error).toMatch(/^Awaiting senior sign-off/);
      expect(campaignUpdate(db)).toBeUndefined();
      expect(mocks.batch).not.toHaveBeenCalled();
    });
    it("sends a batch once signed off", async () => {
      mocks.batch.mockResolvedValue({ processed: 1, sent: 1, failed: 0, pending: 0 });
      setup({ ...signedOff, status: "scheduled" });
      expect((await sendEmailCampaignBatch(ID)).ok).toBe(true);
      expect(mocks.batch).toHaveBeenCalled();
    });
    it("refuses to resume a campaign that was flagged while sending", async () => {
      const { db } = setup({ ...awaiting, status: "paused", metadata: { paused_from: "scheduled" } });
      expect((await transition("scheduled")).error).toMatch(/^Awaiting senior sign-off/);
      expect(campaignUpdate(db)).toBeUndefined();
    });
    it("resumes it once signed off", async () => {
      const { db } = setup({ ...signedOff, status: "paused", metadata: { paused_from: "scheduled" } });
      expect(await transition("scheduled")).toEqual({ ok: true });
      expect(campaignUpdate(db)?.payload).toMatchObject({ status: "scheduled" });
    });
    it("keeps a campaign flagged after its first approval blocked until the second", async () => {
      mocks.user.id = "reviewer";
      setup(approvedItem);
      expect(await flag(true)).toEqual({ ok: true });
      mocks.user.id = "queuer";
      setup({ ...approvedItem, is_sensitive: true });
      expect((await queueEmailCampaign(ID)).ok).toBe(false);
      mocks.role.mockResolvedValue("owner"); mocks.user.id = "senior";
      setup({ ...approvedItem, is_sensitive: true });
      expect(await signOff()).toEqual({ ok: true });
      mocks.role.mockResolvedValue("marketing_manager"); mocks.user.id = "queuer";
      setup({ ...approvedItem, is_sensitive: true, sensitive_approved_by: "senior" });
      expect((await queueEmailCampaign(ID)).ok).toBe(true);
    });
  });

  it("leaves campaigns that aren't flagged exactly as before, without reading the role settings", async () => {
    mocks.user.id = "queuer";
    const queued = setup(approvedItem);
    expect((await queueEmailCampaign(ID)).ok).toBe(true);
    expect(settingsReads(queued.db)).toHaveLength(0);
    mocks.batch.mockResolvedValue({ processed: 1, sent: 1, failed: 0, pending: 0 });
    const sending = setup({ ...approvedItem, status: "scheduled" });
    expect((await sendEmailCampaignBatch(ID)).ok).toBe(true);
    expect(settingsReads(sending.db)).toHaveLength(0);
    const resumed = setup({ ...approvedItem, status: "paused", metadata: { paused_from: "scheduled" } });
    expect(await transition("scheduled")).toEqual({ ok: true });
    expect(campaignUpdate(resumed.db)?.payload).toEqual({ status: "scheduled", metadata: {} });
    expect(settingsReads(resumed.db)).toHaveLength(0);
  });
});
