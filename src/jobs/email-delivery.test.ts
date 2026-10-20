import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock, type Query } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/integrations/resend", () => ({ getResendConfig: mocks.config }));
import { processEmailDeliveryBatch } from "./email-delivery";

const lead = { id: "lead", organization_id: "org", email: "optin@example.com", name: "Test", marketing_consent: true, email_unsubscribed_at: null, email_suppressed_at: null };
const campaign = { id: "campaign", organization_id: "org", status: "scheduled", delivery_authorized_at: "2026-10-01", subject: "Update", preview_text: "", body: "Approved content", name: "Test" };
const metadata = { nurture: true, nurture_sequence_id: "sequence", nurture_enrollment_id: "enrollment", nurture_step: 1 };

function setup(options: { sequence?: string; enrollment?: string; revoked?: boolean; countError?: boolean; readError?: boolean; nurture?: boolean } = {}) {
  const db = databaseMock((q: Query) => {
    if (q.operation !== "select") return { data: q.columns ? { id: "delivery" } : null, error: null };
    if (q.table === "email_campaigns") {
      if (q.single) return options.readError ? { error: { message: "Database unavailable" } } : { data: { ...campaign, metadata: options.nurture === false ? {} : metadata } };
      return { data: q.columns === "id" ? [{ id: "campaign" }] : [campaign] };
    }
    if (q.table === "leads") return { data: q.single ? { ...lead, marketing_consent: !options.revoked } : [lead] };
    if (q.table === "nurture_sequences") return { data: { status: options.sequence ?? "active", created_by: "author", approved_by: "reviewer" } };
    if (q.table === "nurture_enrollments") return { data: { status: options.enrollment ?? "active", current_step: 1, lead_id: "lead", sequence_id: "sequence" } };
    if (q.head) return options.countError ? { count: null, error: { message: "Count failed" } } : { count: options.sequence === "paused" || options.readError ? 1 : 0 };
    return { data: [{ id: "delivery", organization_id: "org", campaign_id: "campaign", lead_id: "lead", attempts: 0, unsubscribe_token_hash: "hash" }] };
  });
  mocks.admin.mockReturnValue(db);
  return db;
}

type Outcome = { status: string; error: string | null; updated_at: string };
function settleSetup({ remaining, outcomes, nurture = false }: { remaining: number; outcomes: Outcome[]; nurture?: boolean }) {
  const db = databaseMock((q: Query) => {
    if (q.operation !== "select") return { data: q.columns ? { id: "updated" } : null, error: null };
    if (q.table === "email_campaigns") {
      if (q.single) return { data: { ...campaign, metadata: nurture ? metadata : { source: "newsletter" } } };
      return { data: q.columns === "id" ? [{ id: "campaign" }] : [campaign] };
    }
    if (q.table === "leads") return { data: q.single ? lead : [lead] };
    if (q.table === "nurture_sequences") return { data: { status: "active", created_by: "author", approved_by: "reviewer" } };
    if (q.table === "nurture_enrollments") return { data: { status: "active", current_step: 1, lead_id: "lead", sequence_id: "sequence" } };
    if (q.head) return { count: remaining };
    if (q.columns === "status,error,updated_at") return { data: outcomes };
    return { data: [{ id: "delivery", organization_id: "org", campaign_id: "campaign", lead_id: "lead", attempts: 0, unsubscribe_token_hash: "hash" }] };
  });
  mocks.admin.mockReturnValue(db);
  return db;
}
const campaignUpdates = (db: ReturnType<typeof databaseMock>) => db.queries.filter((q) => q.table === "email_campaigns" && q.operation === "update");
const failedRows = (count: number, at = "2026-10-20T10:00:00Z") => Array.from({ length: count }, (_, i) => ({ status: "failed", error: `Error ${i}`, updated_at: at.replace("10:00", `10:${String(i).padStart(2, "0")}`) }));
const sentRows = (count: number) => Array.from({ length: count }, () => ({ status: "delivered", error: null, updated_at: "2026-10-20T09:00:00Z" }));

describe("campaign outcome after a batch", () => {
  it("pauses a finished campaign whose every send failed and records why", async () => {
    const db = settleSetup({ remaining: 0, outcomes: failedRows(3) });
    await processEmailDeliveryBatch();
    const [update] = campaignUpdates(db);
    expect(update.payload).toEqual({ status: "paused", metadata: { source: "newsletter", paused_from: "scheduled", delivery_problem: { failed: 3, attempted: 3, last_error: "Error 2", detected_at: expect.any(String) } } });
    expect(update.filters).toContainEqual({ method: "eq", column: "status", value: "scheduled" });
    expect(campaignUpdates(db).some((q) => (q.payload as { status?: string }).status === "sent")).toBe(false);
    expect(db.queries.some((q) => q.table === "email_campaign_deliveries" && q.operation === "update" && (q.payload as { error?: string }).error === "Campaign paused automatically after repeated send failures.")).toBe(true);
  });
  it("pauses mid-run once five or more sends failed and they are at least half", async () => {
    const db = settleSetup({ remaining: 40, outcomes: [...failedRows(5), ...sentRows(3)] });
    await processEmailDeliveryBatch();
    expect(campaignUpdates(db)[0].payload).toMatchObject({ status: "paused" });
  });
  it("keeps sending mid-run while failures are below the threshold", async () => {
    const db = settleSetup({ remaining: 40, outcomes: [...failedRows(4), ...sentRows(1)] });
    await processEmailDeliveryBatch();
    expect(campaignUpdates(db)).toHaveLength(0);
  });
  it("marks a finished campaign sent when only a few sends failed", async () => {
    const db = settleSetup({ remaining: 0, outcomes: [...failedRows(2), ...sentRows(8)] });
    await processEmailDeliveryBatch();
    expect(campaignUpdates(db).map((q) => q.payload)).toEqual([{ status: "sent" }]);
  });
});

beforeEach(() => {
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "x".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
  mocks.config.mockResolvedValue({ apiKey: "test", fromName: "Test", fromEmail: "sender@example.com", webhookSecret: "test" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "message" }), { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("email delivery authorization at send time", () => {
  it.each(["paused", "draft"])("holds retries when the nurture sequence is %s", async (sequence) => {
    const db = setup({ sequence });
    expect((await processEmailDeliveryBatch()).pending).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.queries.some(q => q.payload && !Array.isArray(q.payload) && q.payload.status === "queued" && q.payload.attempts === 0)).toBe(true);
  });
  it.each(["cancelled", "completed", "suppressed"])("does not send for a %s enrollment", async (enrollment) => {
    setup({ enrollment });
    expect((await processEmailDeliveryBatch()).sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rechecks consent after the recipient list was loaded", async () => {
    setup({ revoked: true, nurture: false });
    expect((await processEmailDeliveryBatch()).sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends an active approved step with an idempotency key and unsubscribe link", async () => {
    setup();
    expect((await processEmailDeliveryBatch()).sent).toBe(1);
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "ril-delivery-delivery" }), body: expect.stringContaining("/api/email/unsubscribe") }));
  });
  it("defers database errors instead of cancelling the recipient", async () => {
    const db = setup({ readError: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await processEmailDeliveryBatch()).pending).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.queries.some(q => q.payload && !Array.isArray(q.payload) && q.payload.status === "cancelled")).toBe(false);
    consoleError.mockRestore();
  });
  it("does not mark a campaign complete when its remaining-delivery count fails", async () => {
    const db = setup({ countError: true });
    await processEmailDeliveryBatch();
    expect(db.queries.some(q => q.table === "email_campaigns" && q.operation === "update")).toBe(false);
  });
  it("still marks a nurture step sent when its delivery failed", async () => {
    const db = settleSetup({ remaining: 0, outcomes: [{ status: "failed", error: "Rejected", updated_at: "2026-10-20T10:00:00Z" }], nurture: true });
    await processEmailDeliveryBatch();
    expect(campaignUpdates(db).map((q) => q.payload)).toEqual([{ status: "sent" }]);
  });
  it("limits interrupted-send recovery to the requested workspace and campaign", async () => {
    const db = setup();
    await processEmailDeliveryBatch({ organizationId: "org", campaignId: "campaign" });
    expect(db.queries[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "organization_id", value: "org" },
      { method: "eq", column: "campaign_id", value: "campaign" },
    ]));
  });
});
